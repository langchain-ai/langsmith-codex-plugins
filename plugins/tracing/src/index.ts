import { Client } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { convertToRunTree } from "./trace.js";
import { readStdin } from "./utils/stdin.js";

export async function runHook() {
  const content = await readStdin<{
    session_id: string;
    turn_id: string;
    transcript_path: string;
    hook_event_name: "Stop";
  }>();

  const config = await getConfig();

  // Skip entirely if tracing is disabled
  if (!config.enabled) return;

  // Redact secrets before upload (on by default). The anonymizer is set on the
  // single Client, so it also covers replica destinations, which reuse it.
  const anonymizer = config.redact
    ? createSecretAnonymizer(
        config.redact_extra_rules ? { extraRules: config.redact_extra_rules } : undefined,
      )
    : undefined;

  await convertToRunTree(content, {
    client: new Client({
      apiKey: config.api_key,
      apiUrl: config.api_url,
      anonymizer,
    }),
    projectName: config.project,
    metadata: config.metadata,
    replicas: config.replicas,
  });
}

runHook();
