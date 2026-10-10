import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { LS_INTEGRATION_VERSION } from "./constants.js";
import { binary } from "./binary.js";
import { tracingFailed, usage } from "./messages.js";
import { toSdkReplicas } from "@langchain/plugins-base/settings";
import * as os from "node:os";
import { convertToRunTree } from "./trace.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import {
  captureCodexRun,
  clearCodexToolCapture,
  createCodexTracingSession,
  handleCodexToolHook,
  runCodexEngineWorker,
} from "./tracing-engine.js";
import { readCapturedTools } from "./tool-capture.js";
import type { TracingHookInput } from "./models/tracing-hook.js";
import { unknownFlags, wasInvokedWith } from "./utils/argv.js";
import { readStdin } from "./utils/stdin.js";

async function runHook() {
  const content = await readStdin<TracingHookInput>();

  if (content.hook_event_name === "UserPromptSubmit") {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
    const config = await getConfig({ home, cwd: content.cwd, env: process.env });
    const result = await handlePromptSubmit(content, undefined, config);
    if (!result && config.enabled) {
      const context = createCodexTracingSession(config, content.session_id, content.cwd, home);
      if (context) {
        try {
          await context.session.wake();
        } catch (error) {
          console.error(`Codex session recovery failed: ${error}`);
        }
      }
    }
    if (result) console.log(JSON.stringify(result));
    return;
  }
  if (content.hook_event_name === "PreToolUse" || content.hook_event_name === "PostToolUse") {
    const config = await getConfig({ home: process.env.HOME!, cwd: content.cwd, env: process.env });
    const anonymizer = config.redact
      ? createSecretAnonymizer(
          config.redact_extra_rules ? { extraRules: config.redact_extra_rules } : undefined,
        )
      : undefined;
    await handleCodexToolHook(content, config, anonymizer);
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

  const engine = createCodexTracingSession(config, content.session_id, content.cwd);
  if (!engine) throw new Error("Shared Codex tracing is unavailable; refusing direct upload");
  const capturedTools = await readCapturedTools(content.transcript_path, content.turn_id);
  await convertToRunTree(content, {
    client,
    projectName: config.project,
    metadata: config.metadata,
    replicas: toSdkReplicas(config.replicas),
    parentRunTree,
    captureRun: (run, capture) => captureCodexRun(engine, run, capture),
    capturedToolIds: new Set(
      capturedTools.filter((tool) => tool.endedAt != null).map((tool) => tool.id),
    ),
  });
  await clearCodexToolCapture(content.transcript_path, content.turn_id);
}

const invocationArguments = process.argv.slice(1);
const invoked = (flag: string) => wasInvokedWith(invocationArguments, flag);

const USAGE = usage(binary.target.executableName);

const unrecognised = unknownFlags(invocationArguments);

if (invoked("--help") || invoked("-h")) {
  console.log(USAGE);
} else if (invoked("--version") || invoked("-v")) {
  console.log(LS_INTEGRATION_VERSION ?? "development");
} else if (invoked("--engine-worker")) {
  const flagIndex = process.argv.indexOf("--engine-worker");
  const sessionId = process.argv[flagIndex + 1];
  const cwd = process.argv[flagIndex + 2];
  if (!sessionId || !cwd) {
    console.error("shared trace worker needs a session ID and working directory");
    process.exitCode = 1;
  } else {
    runCodexEngineWorker(sessionId, cwd).catch((error: unknown) => {
      console.error(tracingFailed(error));
      process.exitCode = 1;
    });
  }
} else if (unrecognised.length > 0) {
  console.error(`unknown option: ${unrecognised[0]}`);
  console.error(USAGE);
  process.exitCode = 1;
} else {
  runHook().catch((error: unknown) => {
    console.error(tracingFailed(error));
  });
}
