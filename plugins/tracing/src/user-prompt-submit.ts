import { uploadingReplicaCount, type UploadCredential } from "@langchain/plugins-base/auth";
import {
  matchPromptCommand,
  promptCommandResponse,
  runPromptCommand,
  type PromptCommandHandler,
  type PromptCommandNotices,
  type PromptCommandResponse,
} from "@langchain/plugins-base/plugin";
import { applySetup, toSdkReplicas, type SetupState } from "@langchain/plugins-base/settings";
import { getConfig } from "./config.js";
import { loginNotices } from "./login-notice.js";
import {
  CODEX_CONFIG_DIRECTORY,
  DEFAULT_LANGSMITH_API_URL,
  EVIDENCE_FAILURE_PREFIX,
  EVIDENCE_REPAIR_HINT,
  LOCKED_MUTE_REPLY,
  MASTER_DISABLED_REPLY,
  MODE_METADATA,
  MUTED_REPLY_STATE,
  NOTICE_KIND_MANAGED,
  PREFERENCE_REPLY,
  PREFERENCE_REPLY_STATE,
  PREFERENCE_REPLY_WARNING,
  PREFERENCE_WARNING_PREFIX,
  PROMPT_COMMANDS,
  SENTENCE_END,
  STRICT_NOTICE_KINDS,
  TRACING_COMMANDS,
  UNMUTED_REPLY_STATE,
} from "./constants.js";
import type { Config, LoadedConfig } from "./models/config.js";
import type {
  CommandContext,
  PromptCommandName,
  PromptSubmitInput,
  TurnEvidence,
} from "./models/hook-input.js";
import type { TracingCommand } from "./models/tracing-policy.js";
import { homeDirectory } from "./utils/home.js";
import { showNotices } from "./notices.js";
import {
  defaultPrivacyPath,
  muteLocked,
  previewTurnMode,
  submitPreference,
} from "./tracing-policy.js";
import { loginRefusal, uploadAuth, uploadCredential } from "./tracing-engine.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function endSentence(text: string): string {
  return text.endsWith(SENTENCE_END) ? text : `${text}${SENTENCE_END}`;
}

function signInKind(kind: UploadCredential["kind"] | undefined): SetupState["signIn"] {
  if (kind === undefined) return "none";
  return kind === "login" ? "login" : "api-key";
}

function setupState(config: LoadedConfig, sessionId: string): SetupState {
  const credential = uploadCredential(config);
  const auth = uploadAuth(config);
  const paused = loginNotices(homeDirectory(), config, credential).find(({ kind }) =>
    STRICT_NOTICE_KINDS.includes(kind),
  );
  const problem = config.managedConfigProblem ?? paused?.text ?? loginRefusal(config, credential);
  return {
    enabled: config.enabled,
    muted: previewTurnMode(defaultPrivacyPath(), sessionId, config) === MODE_METADATA,
    project: config.project,
    ...(config.agent_id === undefined ? {} : { agentId: config.agent_id }),
    apiUrl: auth?.apiUrl ?? config.api_url ?? DEFAULT_LANGSMITH_API_URL,
    signIn: signInKind(auth?.kind),
    replicaCount:
      auth === undefined ? 0 : uploadingReplicaCount(toSdkReplicas(config.replicas), credential),
    ...(problem === undefined ? {} : { credentialProblem: problem }),
  };
}

function withTurnFailure(reply: string, turn: TurnEvidence): string {
  return turn.failure === undefined ? reply : `${endSentence(reply)} ${endSentence(turn.failure)}`;
}

async function setupReply(argumentText: string, { input, turn }: CommandContext): Promise<string> {
  const reply = await applySetup(argumentText, {
    home: homeDirectory(),
    harnessDirectory: CODEX_CONFIG_DIRECTORY,
    readState: async () =>
      setupState(
        await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env }),
        input.session_id,
      ),
  }).catch(errorText);
  return withTurnFailure(reply, turn);
}

function preferenceReply(command: TracingCommand, { turn }: CommandContext): string {
  if (turn.failure !== undefined) return `${endSentence(turn.failure)} ${EVIDENCE_REPAIR_HINT}`;
  const { config, warning } = turn;
  if (muteLocked(config) && command === "unmute") return LOCKED_MUTE_REPLY;
  const state = command === "mute" ? MUTED_REPLY_STATE : UNMUTED_REPLY_STATE;
  let reason = PREFERENCE_REPLY.replace(PREFERENCE_REPLY_STATE, state);
  if (config.managedConfigProblem !== undefined) reason += ` ${config.managedConfigProblem}`;
  else if (!config.enabled) reason += ` ${MASTER_DISABLED_REPLY}`;
  if (warning) reason += ` ${PREFERENCE_REPLY_WARNING} ${endSentence(warning)}`;
  return reason;
}

const COMMAND_HANDLERS: Record<PromptCommandName, PromptCommandHandler<CommandContext>> = {
  mute: (_argumentText, context) => preferenceReply("mute", context),
  unmute: (_argumentText, context) => preferenceReply("unmute", context),
  setup: setupReply,
};

function preferenceCommand(name: PromptCommandName | undefined): TracingCommand | undefined {
  return TRACING_COMMANDS.find((command) => command === name);
}

async function saveTurnEvidence(
  input: PromptSubmitInput,
  command: TracingCommand | undefined,
): Promise<TurnEvidence> {
  let config: Config | undefined;
  try {
    config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
    const result = await submitPreference(defaultPrivacyPath(), {
      sessionId: input.session_id,
      turnId: input.turn_id,
      enabled: config.enabled,
      command,
      defaultMuted: config.defaultMuted,
      mutedLocked: muteLocked(config),
    });
    return { config, warning: result.warning };
  } catch (error) {
    return { config, failure: `${EVIDENCE_FAILURE_PREFIX} ${errorText(error)}` };
  }
}

function logTurnProblem(turn: TurnEvidence): void {
  if (turn.failure !== undefined) console.error(turn.failure);
  else if (turn.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${turn.warning}`);
}

async function promptNotices(config: Config): Promise<PromptCommandNotices> {
  const login = loginNotices(homeDirectory(), config, uploadCredential(config));
  const expired = login.find(({ kind }) => STRICT_NOTICE_KINDS.includes(kind));
  if (expired && config.strict_auth) return { blockReason: expired.text };
  const managed = config.managedConfigWarnings ?? [];
  const notices = await showNotices(homeDirectory(), config, [
    ...(managed.length === 0 ? [] : [{ kind: NOTICE_KIND_MANAGED, text: managed.join("\n") }]),
    ...login,
  ]);
  return { systemMessages: notices };
}

function plainPromptResponse({
  blockReason,
  systemMessages = [],
}: PromptCommandNotices): PromptCommandResponse | undefined {
  if (blockReason !== undefined) return { decision: "block", reason: blockReason };
  return systemMessages.length === 0 ? undefined : { systemMessage: systemMessages.join("\n") };
}

export async function handlePromptSubmit(
  input: PromptSubmitInput,
): Promise<PromptCommandResponse | undefined> {
  const command = matchPromptCommand(input.prompt, PROMPT_COMMANDS);
  const turn = await saveTurnEvidence(input, preferenceCommand(command?.name));
  if (command === undefined) {
    logTurnProblem(turn);
    if (turn.config === undefined) return undefined;
    return plainPromptResponse(await promptNotices(turn.config));
  }
  const reply = await runPromptCommand(command, COMMAND_HANDLERS, { input, turn });
  const config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
  return promptCommandResponse(reply, await promptNotices(config));
}
