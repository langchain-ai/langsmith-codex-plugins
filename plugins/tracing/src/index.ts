import { isSea } from "node:sea";
import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import { LS_INTEGRATION_VERSION } from "./constants.js";
import { runInstall } from "./install.js";
import { SEA_EXECUTABLE_NAME } from "./sea-constants.js";
import { updateFromGitHub } from "./updater.js";
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

const invocationArguments = process.argv.slice(1);

const USAGE = `Usage:
  ${SEA_EXECUTABLE_NAME} --install [--project] [--tag VERSION]
  ${SEA_EXECUTABLE_NAME} --print [--project]
  ${SEA_EXECUTABLE_NAME} --update
  ${SEA_EXECUTABLE_NAME} --version

Options:
  --help, -h     Show this help and exit
  --version, -v  Print the installed version and exit
  --install      Install this binary and register the Codex hooks
  --print        Print the hooks file --install would write, and change nothing
  --project      Use .codex/hooks.json in the current directory
  --tag VERSION  Install a published release instead of this binary
  --update       Replace the installed binary with the newest release`;

const KNOWN_FLAGS = new Set([
  "--help",
  "-h",
  "--version",
  "-v",
  "--install",
  "--print",
  "--project",
  "--tag",
  "--update",
]);

function wasInvokedWith(flag: string): boolean {
  return invocationArguments.includes(flag);
}

function unknownFlags(): string[] {
  return invocationArguments.filter((arg) => arg.startsWith("-") && !KNOWN_FLAGS.has(arg));
}

export async function runUpdate(): Promise<void> {
  try {
    const result = await updateFromGitHub({ currentVersion: LS_INTEGRATION_VERSION ?? "0.0.0" });
    console.log(result.status === "updated" ? `updated to ${result.version}` : result.status);
  } catch (error) {
    console.error(`update failed: ${error}`);
    process.exitCode = 1;
  }
}

const unrecognised = unknownFlags();

if (wasInvokedWith("--help") || wasInvokedWith("-h")) {
  console.log(USAGE);
} else if (wasInvokedWith("--version") || wasInvokedWith("-v")) {
  console.log(LS_INTEGRATION_VERSION ?? "development");
} else if (unrecognised.length > 0) {
  console.error(`unknown option: ${unrecognised[0]}`);
  console.error(USAGE);
  process.exitCode = 1;
} else if (wasInvokedWith("--install") || wasInvokedWith("--print")) {
  runInstall({
    source: isSea() ? process.execPath : undefined,
    currentVersion: LS_INTEGRATION_VERSION,
    argv: invocationArguments,
  });
} else if (wasInvokedWith("--update")) {
  runUpdate();
} else {
  runHook();
}
