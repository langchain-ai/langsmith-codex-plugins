import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { LS_INTEGRATION_VERSION } from "./constants.js";
import { binary } from "./binary.js";
import { tracingFailed, usage } from "./messages.js";
import { toSdkReplicas } from "./shared-config.js";
import { digestFor } from "./utils/serialization.js";
import { isRecord } from "./utils/objects.js";
import { defaultPrivacyPath, savedTurnMode } from "./tracing-policy.js";
import type { TracingHookInput } from "./models/tool-capture.js";
import { convertToRunTree } from "./trace.js";
import { recordToolHook, readTranscript } from "./tool-capture.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import { unknownFlags, wasInvokedWith } from "./utils/argv.js";
import { readStdin } from "./utils/stdin.js";

async function runHook() {
  const content = await readStdin<TracingHookInput>();

  if (content.hook_event_name === "UserPromptSubmit") {
    const result = await handlePromptSubmit(content);
    if (result) console.log(JSON.stringify(result));
    return;
  }
  if (!["PreToolUse", "PostToolUse", "Stop"].includes(content.hook_event_name)) return;
  const config = await getConfig({ home: process.env.HOME!, cwd: content.cwd, env: process.env });

  // Skip entirely if tracing is disabled
  if (!config.enabled) return;

  const anonymizer = config.redact
    ? createSecretAnonymizer(
        config.redact_extra_rules ? { extraRules: config.redact_extra_rules } : undefined,
      )
    : undefined;

  if (content.hook_event_name === "PreToolUse" || content.hook_event_name === "PostToolUse") {
    const meta = (await readTranscript(content.transcript_path, content.turn_id)).find(
      (event) => event.type === "session_meta",
    );
    if (
      meta?.type === "session_meta" &&
      (meta.payload.id !== content.session_id ||
        meta.payload.thread_source === "subagent" ||
        (isRecord(meta.payload.source) && meta.payload.source.subagent != null))
    )
      return;
  }

  if (content.hook_event_name === "PreToolUse") {
    const mode = savedTurnMode(defaultPrivacyPath(), content.session_id, content.turn_id);
    await recordToolHook(content, mode, anonymizer);
    return;
  }

  const client = new Client({
    apiKey: config.api_key,
    apiUrl: config.api_url,
    anonymizer,
    hideMetadata: anonymizer,
    autoBatchTracing: false,
  });
  const replicas = toSdkReplicas(config.replicas)?.map((replica) => ({
    ...replica,
    client: new Client({
      apiKey: replica.apiKey ?? config.api_key,
      apiUrl: replica.apiUrl ?? config.api_url,
      anonymizer,
      hideMetadata: anonymizer,
      autoBatchTracing: false,
    }),
  }));

  // (Optionally) reconstruct the distributed parent so Codex runs attach to the target trace.
  const parentRunTree = config.parent_headers
    ? RunTree.fromHeaders(config.parent_headers, {
        client,
        project_name: config.project,
      })
    : undefined;

  const redactionPolicy = digestFor({ redact: config.redact, rules: config.redact_extra_rules });
  await convertToRunTree(content, {
    redactionPolicy,
    hook: content,
    redactCapture: anonymizer,
    client,
    projectName: config.project,
    metadata: config.metadata,
    replicas,
    parentRunTree,
  });
}

const invocationArguments = process.argv.slice(1);
const invoked = (flag: string) => wasInvokedWith(invocationArguments, flag);

const USAGE = usage(binary.target.executableName);

const unrecognised = unknownFlags(invocationArguments);

if (invoked("--help") || invoked("-h")) {
  console.log(USAGE);
} else if (invoked("--version") || invoked("-v")) {
  console.log(LS_INTEGRATION_VERSION ?? "development");
} else if (unrecognised.length > 0) {
  console.error(`unknown option: ${unrecognised[0]}`);
  console.error(USAGE);
  process.exitCode = 1;
} else {
  runHook().catch((error: unknown) => {
    console.error(tracingFailed(error));
  });
}
