import * as fs from "node:fs";
import { Client, RunTree } from "langsmith";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import { getConfig } from "./config.js";
import {
  enqueuePendingMode,
  getThreadMode,
  linkThreadRoot,
  setThreadMode,
  snapshotCurrentTurnMode,
} from "./state.js";
import { convertToRunTree } from "./trace.js";
import { readStdin } from "./utils/stdin.js";

type CommonInput = {
  session_id?: string;
  thread_id?: string;
  transcript_path: string | null;
  turn_id?: string;
  prompt_id?: string;
};
type StopInput = CommonInput & { hook_event_name: "Stop" };
type PromptInput = CommonInput & { hook_event_name: "UserPromptSubmit"; prompt: string };
type HookInput = StopInput | PromptInput;

function transcript(input: CommonInput): Record<string, unknown>[] {
  if (input.transcript_path == null) return [];
  try {
    return fs
      .readFileSync(input.transcript_path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function inputThread(input: CommonInput): string {
  return input.thread_id ?? input.session_id ?? "unknown";
}

function resolveRoot(input: CommonInput): string {
  const thread = inputThread(input);
  const first = transcript(input).find((line) => line.type === "session_meta");
  const payload = first?.payload as Record<string, unknown> | undefined;
  const source = payload?.source as
    | { subagent?: { thread_spawn?: { parent_thread_id?: unknown } } }
    | undefined;
  const parent =
    source?.subagent?.thread_spawn?.parent_thread_id ??
    (payload?.thread_source === "subagent" ? payload.parent_thread_id : undefined);
  if (typeof parent === "string") {
    try {
      linkThreadRoot(thread, parent);
    } catch {}
    return parent;
  }
  return thread;
}

function commandOutput(reason: string): void {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

export async function handleUserPromptSubmit(input: PromptInput): Promise<boolean> {
  const root = resolveRoot(input);
  const command = /^\/trace (on|off|status)$/.exec(input.prompt)?.[1];
  const config = await getConfig();
  if (command != null) {
    if (command === "on") setThreadMode(root, "full");
    if (command === "off") setThreadMode(root, "metadata");
    if (!config.enabled) {
      commandOutput("LangSmith tracing is disabled by configuration for this thread.");
    } else {
      commandOutput(
        getThreadMode(root) === "full"
          ? "LangSmith tracing is on for this thread."
          : "LangSmith tracing is off for this thread (metadata only).",
      );
    }
    return true;
  }
  try {
    if (input.turn_id != null) snapshotCurrentTurnMode(root, input.turn_id);
    else enqueuePendingMode(root);
  } catch {}

  return false;
}

async function handleStop(content: StopInput) {
  const config = await getConfig();
  if (!config.enabled || content.transcript_path == null) return;
  const anonymizer = config.redact
    ? createSecretAnonymizer(
        config.redact_extra_rules ? { extraRules: config.redact_extra_rules } : undefined,
      )
    : undefined;
  const client = new Client({ apiKey: config.api_key, apiUrl: config.api_url, anonymizer });
  const traceHeader = config.parent_headers?.["langsmith-trace"];
  const parentRunTree = traceHeader
    ? RunTree.fromHeaders(config.parent_headers!, { client, project_name: config.project })
    : undefined;
  await convertToRunTree(
    { transcript_path: content.transcript_path, turn_id: content.turn_id ?? null },
    {
      client,
      projectName: config.project,
      metadata: config.metadata,
      replicas: config.replicas,
      parentRunTree,
      failClosedMissingSnapshot: true,
    },
  );
}

export async function runHook() {
  const content = await readStdin<HookInput>();
  if (content.hook_event_name === "UserPromptSubmit") await handleUserPromptSubmit(content);
  else await handleStop(content);
}

runHook();
