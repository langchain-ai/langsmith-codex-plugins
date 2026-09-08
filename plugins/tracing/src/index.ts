import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { toSdkReplicas } from "./shared-config.js";
import { convertToRunTree } from "./trace.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import { readStdin } from "./utils/stdin.js";

export async function runHook() {
  const content = await readStdin<{
    session_id: string;
    turn_id: string;
    transcript_path: string;
    hook_event_name: "Stop" | "UserPromptSubmit";
    cwd: string;
    prompt: string;
  }>();

  if (content.hook_event_name === "UserPromptSubmit") {
    const result = await handlePromptSubmit(content);
    if (result) console.log(JSON.stringify(result));
    return;
  }
  if (content.hook_event_name !== "Stop") return;
  const config = await getConfig({ home: process.env.HOME!, cwd: content.cwd, env: process.env });

  // Skip entirely if tracing is disabled
  if (!config.enabled) return;

  // Redact secrets before upload (on by default). The anonymizer is set on the
  // single Client, so it also covers replica destinations, which reuse it.
  const anonymizer = config.redact
    ? createSecretAnonymizer(
        config.redact_extra_rules ? { extraRules: config.redact_extra_rules } : undefined,
      )
    : undefined;

  const client = new Client({
    apiKey: config.api_key,
    apiUrl: config.api_url,
    anonymizer,
    hideMetadata: anonymizer,
  });

  // (Optionally) reconstruct the distributed parent so Codex runs attach to the target trace.
  const parentRunTree = config.parent_headers
    ? RunTree.fromHeaders(config.parent_headers, {
        client,
        project_name: config.project,
      })
    : undefined;

  await convertToRunTree(content, {
    client,
    projectName: config.project,
    metadata: config.metadata,
    replicas: toSdkReplicas(config.replicas),
    parentRunTree,
  });
}

runHook();
