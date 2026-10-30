import { commandReplyContext } from "@langchain/plugins-base/plugin";
import { getConfig } from "./config.js";
import { loginNotices } from "./login-notice.js";
import {
  EVIDENCE_FAILURE_PREFIX,
  EVIDENCE_REPAIR_HINT,
  LOCKED_MUTE_REPLY,
  MASTER_DISABLED_REPLY,
  MUTED_REPLY_STATE,
  NOTICE_KIND_MANAGED,
  PREFERENCE_REPLY,
  PREFERENCE_REPLY_STATE,
  PREFERENCE_REPLY_WARNING,
  REPLY_SEPARATOR,
  STRICT_NOTICE_KINDS,
  PREFERENCE_WARNING_PREFIX,
  UNMUTED_REPLY_STATE,
  USER_PROMPT_SUBMIT_EVENT,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { PromptSubmitInput } from "./models/hook-input.js";
import type { PromptSubmitOutput } from "./models/hook-output.js";
import type { TurnEvidence } from "./models/prompt-submit.js";
import type { TracingCommand } from "./models/tracing-policy.js";
import { endSentence } from "./utils/endSentence.js";
import { errorText } from "./utils/errorText.js";
import { homeDirectory } from "./utils/home.js";
import { showNotices } from "./notices.js";
import { parseSetupCommand, runSetup } from "./setup.js";
import {
  defaultPrivacyPath,
  muteLocked,
  parseTracingCommand,
  submitPreference,
} from "./tracing-policy.js";
import { uploadCredential } from "./tracing-engine.js";

function preferenceReply(
  command: TracingCommand,
  config: Config,
  mutedLocked: boolean,
  warning: string | undefined,
): string {
  if (mutedLocked && command === "unmute") return LOCKED_MUTE_REPLY;
  const state = command === "mute" ? MUTED_REPLY_STATE : UNMUTED_REPLY_STATE;
  let reason = PREFERENCE_REPLY.replace(PREFERENCE_REPLY_STATE, state);
  if (config.managedConfigProblem !== undefined) reason += ` ${config.managedConfigProblem}`;
  else if (!config.enabled) reason += ` ${MASTER_DISABLED_REPLY}`;
  if (warning) reason += ` ${PREFERENCE_REPLY_WARNING} ${endSentence(warning)}`;
  return reason;
}

async function saveTurnEvidence(
  input: PromptSubmitInput,
  command: TracingCommand | undefined,
): Promise<TurnEvidence> {
  let config: Config | undefined;
  try {
    config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
    const mutedLocked = muteLocked(config);
    const result = await submitPreference(defaultPrivacyPath(), {
      sessionId: input.session_id,
      turnId: input.turn_id,
      enabled: config.enabled,
      command,
      defaultMuted: config.defaultMuted,
      mutedLocked,
    });
    if (command)
      return { config, reply: preferenceReply(command, config, mutedLocked, result.warning) };
    if (result.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${result.warning}`);
    return { config };
  } catch (error) {
    const failure = `${EVIDENCE_FAILURE_PREFIX} ${errorText(error)}`;
    if (!command) return { config, failure };
    return { config, failure, reply: `${endSentence(failure)} ${EVIDENCE_REPAIR_HINT}` };
  }
}

async function setupReply(
  input: PromptSubmitInput,
  setupArguments: string,
  failure: string | undefined,
): Promise<string> {
  const reply = await runSetup(input.cwd, input.session_id, setupArguments);
  return failure === undefined ? reply : `${endSentence(reply)} ${endSentence(failure)}`;
}

function strictReason(reply: string | undefined, refusal: string): string {
  if (reply === undefined || reply.includes(refusal)) return reply ?? refusal;
  return `${reply}${REPLY_SEPARATOR}${refusal}`;
}

function promptSubmitOutput(
  notices: string[],
  reply: string | undefined,
): PromptSubmitOutput | undefined {
  const unrepeated = notices.filter((notice) => !reply?.includes(notice));
  if (unrepeated.length === 0 && reply === undefined) return undefined;
  return {
    ...(unrepeated.length === 0 ? {} : { systemMessage: unrepeated.join("\n") }),
    ...(reply === undefined
      ? {}
      : {
          hookSpecificOutput: {
            hookEventName: USER_PROMPT_SUBMIT_EVENT,
            additionalContext: commandReplyContext(reply),
          },
        }),
  };
}

async function finishPrompt(
  config: Config,
  reply: string | undefined,
): Promise<PromptSubmitOutput | undefined> {
  const login = loginNotices(homeDirectory(), config, uploadCredential(config));
  const expired = login.find(({ kind }) => STRICT_NOTICE_KINDS.includes(kind));
  if (expired && config.strict_auth)
    return { decision: "block", reason: strictReason(reply, expired.text) };
  const managed = config.managedConfigWarnings ?? [];
  const notices = await showNotices(homeDirectory(), config, [
    ...(managed.length === 0 ? [] : [{ kind: NOTICE_KIND_MANAGED, text: managed.join("\n") }]),
    ...login,
  ]);
  return promptSubmitOutput(notices, reply);
}

export async function handlePromptSubmit(
  input: PromptSubmitInput,
): Promise<PromptSubmitOutput | undefined> {
  const command = parseTracingCommand(input.prompt);
  const setupArguments = parseSetupCommand(input.prompt);
  const evidence = await saveTurnEvidence(input, command);
  if (setupArguments === undefined) {
    if (evidence.reply === undefined && evidence.failure !== undefined)
      console.error(evidence.failure);
    if (evidence.config === undefined) return promptSubmitOutput([], evidence.reply);
    return finishPrompt(evidence.config, evidence.reply);
  }
  const reply = await setupReply(input, setupArguments, evidence.failure);
  const config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
  return finishPrompt(config, reply);
}
