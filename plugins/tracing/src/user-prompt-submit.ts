import { getConfig } from "./config.js";
import { defaultPrivacyPath, parseTracingCommand, submitPreference } from "./tracing-policy.js";

export async function handlePromptSubmit(
  input: {
    session_id: string;
    turn_id: string;
    cwd: string;
    prompt: string;
  },
  privacyPath = defaultPrivacyPath(),
) {
  const command = parseTracingCommand(input.prompt);
  try {
    const config = await getConfig({ home: process.env.HOME!, cwd: input.cwd, env: process.env });
    const result = await submitPreference(
      privacyPath,
      input.session_id,
      input.turn_id,
      config.enabled,
      command,
    );
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
