import { Client } from "langsmith";
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

  await convertToRunTree(content, {
    client: new Client({ apiKey: config.api_key, apiUrl: config.api_url }),
    projectName: config.project,
    metadata: config.metadata,
    replicas: config.replicas,
  });
}

runHook();
