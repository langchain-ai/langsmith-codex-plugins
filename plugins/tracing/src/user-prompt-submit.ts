import { getConfig } from "./config.js";
import { defaultPrivacyPath, parseTracingCommand, submitPreference } from "./tracing-policy.js";
import { withTurnCaptureLock } from "./tool-capture.js";
import type { PromptSubmitInput } from "./models/tool-capture.js";

export async function handlePromptSubmit(
  input: PromptSubmitInput,
  privacyPath = defaultPrivacyPath(),
) {
  const command = parseTracingCommand(input.prompt);
  try {
    const config = await getConfig({ home: process.env.HOME!, cwd: input.cwd, env: process.env });
    const savePreference = () =>
      submitPreference(
        privacyPath,
        input.session_id,
        input.turn_id,
        config.enabled,
        command,
        config.defaultMuted,
      );
    const result = input.transcript_path
      ? await withTurnCaptureLock(input.transcript_path, savePreference)
      : await savePreference();
    if (!command) {
      if (result.warning) console.error(`Tracing preference warning: ${result.warning}`);
      return;
    }
    let reason = `Thread tracing ${command === "mute" ? "muted (metadata-only)" : "unmuted (full content)"}. Preference saved for the next turn; the current turn is unchanged.`;
    if (!config.enabled)
      reason += " Master tracing is disabled; this preference does not enable it.";
    if (result.warning) reason += ` Warning: ${result.warning}.`;
    return { decision: "block", reason };
  } catch (error) {
    // Never let a control reach the model, or accept work without durable evidence.
    return {
      decision: "block",
      reason: `Could not save tracing preference/turn evidence: ${error instanceof Error ? error.message : String(error)}. Repair the privacy file or permissions and retry. Command/prompt blocked; no model turn was started.`,
    };
  }
}
