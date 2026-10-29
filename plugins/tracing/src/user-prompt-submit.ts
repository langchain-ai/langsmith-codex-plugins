import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "./config.js";
import { loginNotices } from "./login-notice.js";
import {
  CAPTURE_FLAG_FILE,
  CAPTURE_FLAG_KEEP_MS,
  LOCKED_MUTE_REPLY,
  NOTICE_KIND_MANAGED,
  STRICT_NOTICE_KINDS,
  PREFERENCE_WARNING_PREFIX,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { PromptSubmitInput } from "./models/hook-input.js";
import { homeDirectory } from "./utils/home.js";
import { showNotices } from "./notices.js";
import { recordHookFiring } from "./sidecar.js";
import {
  defaultPrivacyPath,
  muteLocked,
  parseTracingCommand,
  submitPreference,
} from "./tracing-policy.js";
import { engineStorageRoot, uploadCredential } from "./tracing-engine.js";

export async function handlePromptSubmit(input: PromptSubmitInput) {
  const command = parseTracingCommand(input.prompt);
  try {
    const config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
    await syncCaptureFlag(config).catch(() => undefined);
    await recordHookFiring(config, input).catch(() => undefined);
    const mutedLocked = muteLocked(config);
    const result = await submitPreference(defaultPrivacyPath(), {
      sessionId: input.session_id,
      turnId: input.turn_id,
      enabled: config.enabled,
      command,
      defaultMuted: config.defaultMuted,
      mutedLocked,
    });
    if (!command) {
      if (result.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${result.warning}`);
      const login = loginNotices(homeDirectory(), config, uploadCredential(config));
      const expired = login.find(({ kind }) => STRICT_NOTICE_KINDS.includes(kind));
      if (expired && config.strict_auth) return { decision: "block", reason: expired.text };
      const managed = config.managedConfigWarnings ?? [];
      const notices = await showNotices(homeDirectory(), config, [
        ...(managed.length === 0 ? [] : [{ kind: NOTICE_KIND_MANAGED, text: managed.join("\n") }]),
        ...login,
      ]);
      return notices.length === 0 ? undefined : { systemMessage: notices.join("\n") };
    }
    if (mutedLocked && command === "unmute")
      return { decision: "block", reason: LOCKED_MUTE_REPLY };
    let reason = `Thread tracing ${command === "mute" ? "muted (metadata-only)" : "unmuted (full content)"}. Preference saved for the next turn; the current turn is unchanged.`;
    if (config.managedConfigProblem !== undefined) reason += ` ${config.managedConfigProblem}`;
    else if (!config.enabled)
      reason += " Master tracing is disabled; this preference does not enable it.";
    if (result.warning) reason += ` Warning: ${result.warning}.`;
    return { decision: "block", reason };
  } catch (error) {
    const failure = `Could not save tracing preference/turn evidence: ${error instanceof Error ? error.message : String(error)}`;
    if (!command) {
      console.error(failure);
      return;
    }
    return {
      decision: "block",
      reason: `${failure}. Repair the privacy file or permissions and retry. Command blocked; no model turn was started.`,
    };
  }
}

async function syncCaptureFlag(config: Config): Promise<void> {
  const root = engineStorageRoot(homeDirectory());
  const flag = join(root, CAPTURE_FLAG_FILE);
  if (config.enabled && config.capture_hook_outputs) {
    await mkdir(root, { recursive: true });
    return writeFile(flag, "");
  }
  const { mtimeMs } = await stat(flag);
  if (Date.now() - mtimeMs > CAPTURE_FLAG_KEEP_MS) await rm(flag, { force: true });
}
