import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { LS_INTEGRATION_VERSION } from "./constants.js";
import { runInstall } from "./install.js";
import { binary } from "./binary.js";
import { UNKNOWN_VERSION } from "./binary-constants.js";
import { usage } from "./messages.js";
import { standaloneBinaryRegistered } from "./stand-down.js";
import { warnOnceAboutStandaloneBinary } from "./standalone-warning.js";
import { toSdkReplicas } from "./shared-config.js";
import { convertToRunTree } from "./trace.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import { flagValue, unknownFlags, wasInvokedWith } from "./utils/argv.js";
import { runningCompiledBinary } from "./utils/runningCompiledBinary.js";
import { readStdin } from "./utils/stdin.js";

async function runHook() {
  const content = await readStdin<{
    session_id: string;
    turn_id: string;
    transcript_path: string;
    hook_event_name: "Stop" | "UserPromptSubmit";
    cwd: string;
    prompt: string;
  }>();

  const registered = await standaloneBinaryRegistered();

  if (content.hook_event_name === "UserPromptSubmit") {
    const result = registered ? undefined : await handlePromptSubmit(content);
    const systemMessage = await warnOnceAboutStandaloneBinary(registered);
    const output = systemMessage ? { ...result, systemMessage } : result;
    if (output) console.log(JSON.stringify(output));
    return;
  }
  if (registered) return;
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

const invocationArguments = process.argv.slice(1);
const invoked = (flag: string) => wasInvokedWith(invocationArguments, flag);

const USAGE = usage(binary.target.executableName);

async function runUpdate(): Promise<void> {
  try {
    const result = await binary.update({
      currentVersion: LS_INTEGRATION_VERSION ?? UNKNOWN_VERSION,
    });
    console.log(result.status === "updated" ? `updated to ${result.version}` : result.status);
  } catch (error) {
    console.error(`update failed: ${error}`);
    process.exitCode = 1;
  }
}

const unrecognised = unknownFlags(invocationArguments);

if (invoked("--help") || invoked("-h")) {
  console.log(USAGE);
} else if (invoked("--version") || invoked("-v")) {
  console.log(LS_INTEGRATION_VERSION ?? "development");
} else if (unrecognised.length > 0) {
  console.error(`unknown option: ${unrecognised[0]}`);
  console.error(USAGE);
  process.exitCode = 1;
} else if (invoked("--install") || invoked("--print")) {
  runInstall({
    source: runningCompiledBinary() ? process.execPath : undefined,
    currentVersion: LS_INTEGRATION_VERSION,
    projectScoped: invoked("--project"),
    print: invoked("--print"),
    tag: flagValue(invocationArguments, "--tag"),
  });
} else if (invoked("--update")) {
  runUpdate();
} else {
  runHook();
}
