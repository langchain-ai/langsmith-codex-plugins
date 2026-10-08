import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "langsmith";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { convertToRunTree } from "../src/trace.js";
import { loadTurnStates } from "../src/trace-delivery-store.js";
import * as traceDeliveryStore from "../src/trace-delivery-store.js";
import { TURN_CAPTURE_PLAN, TURN_CAPTURE_TRANSCRIPT } from "../src/tool-capture-constants.js";
import { recordToolHook, turnCaptureDirectory } from "../src/tool-capture.js";
import type { TraceConversionOptions } from "../src/models/trace-delivery.js";
import type { ReconciliationMetadata, TracingHookInput } from "../src/models/tool-capture.js";
import type { TurnMode } from "../src/models/tracing-policy.js";
import type { ResolvedGitAttribution } from "../src/metadata-models.js";
import { resolveGitAttribution } from "../src/git.js";
import {
  INCREMENTAL_TRACE_TEST,
  SYNTHETIC_REPOSITORY_A,
  SYNTHETIC_REPOSITORY_B,
} from "./constants/incremental-trace.js";
import type { LocalTraceServer, SyntheticTranscriptEvent } from "./models/incremental-trace.js";
import { createIncrementalTraceServer } from "./incremental-trace-server.js";

vi.mock("../src/git.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/git.js")>();
  return { ...actual, resolveGitAttribution: vi.fn() };
});

let local: LocalTraceServer;
let client: Client;
let testRoot: string;
let transcriptPath: string;
let privacyPath: string;
const gitLookups = new Map<string, ResolvedGitAttribution>();

function transcriptEvents(): SyntheticTranscriptEvent[] {
  return [
    {
      timestamp: "2026-10-08T12:00:00.000Z",
      type: "session_meta",
      payload: {
        id: INCREMENTAL_TRACE_TEST.sessionId,
        cwd: INCREMENTAL_TRACE_TEST.rootCwd,
        originator: "synthetic-test",
        cli_version: "0.160.0",
        source: "cli",
        model_provider: "openai",
      },
    },
    {
      timestamp: "2026-10-08T12:00:01.000Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: INCREMENTAL_TRACE_TEST.turnId },
    },
    {
      timestamp: "2026-10-08T12:00:02.000Z",
      type: "turn_context",
      payload: { cwd: INCREMENTAL_TRACE_TEST.rootCwd, model: "synthetic-model" },
    },
    {
      timestamp: "2026-10-08T12:00:03.000Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: INCREMENTAL_TRACE_TEST.requestSecret }],
      },
    },
    {
      timestamp: "2026-10-08T12:00:04.000Z",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({
          command: INCREMENTAL_TRACE_TEST.toolInputSecret,
          cwd: INCREMENTAL_TRACE_TEST.toolCwd,
        }),
        call_id: INCREMENTAL_TRACE_TEST.toolId,
      },
    },
  ];
}

async function installTranscript(mode: TurnMode) {
  const content = `${transcriptEvents()
    .map((event) => JSON.stringify(event))
    .join("\n")}\n`;
  await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
  await fs.mkdir(path.dirname(privacyPath), { recursive: true });
  await fs.writeFile(transcriptPath, content);
  await fs.writeFile(
    privacyPath,
    JSON.stringify({
      version: 1,
      threads: {
        [INCREMENTAL_TRACE_TEST.sessionId]: {
          turns: { [INCREMENTAL_TRACE_TEST.turnId]: mode },
        },
      },
    }),
  );
  return content;
}

function hookInput(hookEventName: TracingHookInput["hook_event_name"]): TracingHookInput {
  return {
    session_id: INCREMENTAL_TRACE_TEST.sessionId,
    turn_id: INCREMENTAL_TRACE_TEST.turnId,
    transcript_path: transcriptPath,
    hook_event_name: hookEventName,
    cwd: INCREMENTAL_TRACE_TEST.rootCwd,
    prompt: "",
    tool_use_id: INCREMENTAL_TRACE_TEST.toolId,
    tool_name: "exec_command",
    tool_input: {
      command: INCREMENTAL_TRACE_TEST.toolInputSecret,
      cwd: INCREMENTAL_TRACE_TEST.toolCwd,
    },
    tool_response: { stdout: INCREMENTAL_TRACE_TEST.toolOutputSecret },
  };
}

function optionsFor(hook: TracingHookInput): TraceConversionOptions {
  return {
    hook,
    client,
    projectName: INCREMENTAL_TRACE_TEST.projectName,
    privacyPath,
    metadata: { unrelated: INCREMENTAL_TRACE_TEST.unrelatedMetadata },
  };
}

function runNamed(name: string) {
  const run = [...local.runs.values()].find((candidate) => candidate.name === name);
  if (run === undefined) throw new Error(`Run ${name} was not delivered`);
  return run;
}

function writeRequests() {
  return local.requests.filter(
    (request) => request.method === "POST" || request.method === "PATCH",
  );
}

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "incremental-trace-test-"));
  transcriptPath = path.join(testRoot, ".codex", "sessions", "lifecycle.jsonl");
  privacyPath = path.join(testRoot, ".codex", "langsmith-state.privacy.json");
  gitLookups.clear();
  gitLookups.set(INCREMENTAL_TRACE_TEST.toolCwd, SYNTHETIC_REPOSITORY_B);
  vi.mocked(resolveGitAttribution).mockImplementation(async (cwd) =>
    cwd == null ? undefined : gitLookups.get(cwd),
  );
  local = await createIncrementalTraceServer();
  client = new Client({
    apiUrl: local.apiUrl,
    apiKey: INCREMENTAL_TRACE_TEST.apiKey,
    autoBatchTracing: false,
    hideInputs: false,
    hideOutputs: false,
    hideMetadata: false,
  });
});

afterEach(async () => {
  await local.close();
  const captureDirectory = turnCaptureDirectory(transcriptPath, INCREMENTAL_TRACE_TEST.turnId);
  const capturedFiles = await fs.readdir(captureDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const file of capturedFiles) await fs.unlink(path.join(captureDirectory, file));
  await fs.rmdir(captureDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  const sessionsDirectory = path.dirname(transcriptPath);
  for (const file of await fs.readdir(sessionsDirectory))
    await fs.unlink(path.join(sessionsDirectory, file));
  await fs.unlink(privacyPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  for (const directory of [path.dirname(transcriptPath), path.dirname(privacyPath), testRoot]) {
    await fs.rmdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
});

it("uploads a tool early then patches the same root and tool runs with final repository metadata", async () => {
  const original = await installTranscript("full");
  await recordToolHook(hookInput("PreToolUse"), "full");
  const post = hookInput("PostToolUse");
  await convertToRunTree(
    { transcript_path: post.transcript_path, turn_id: post.turn_id },
    optionsFor(post),
  );

  const earlyRoot = runNamed("openai.codex");
  const earlyTool = runNamed("exec_command");
  expect(earlyRoot.end_time).toBeUndefined();
  expect(earlyRoot.outputs).toBeUndefined();
  expect(earlyTool.outputs).toMatchObject({
    output: { stdout: INCREMENTAL_TRACE_TEST.toolOutputSecret },
  });
  expect(writeRequests().filter((request) => request.method === "POST")).toHaveLength(2);

  const stop = hookInput("Stop");
  await convertToRunTree(
    { transcript_path: stop.transcript_path, turn_id: stop.turn_id },
    optionsFor(stop),
  );

  const root = runNamed("openai.codex");
  const tool = runNamed("exec_command");
  const writes = writeRequests();
  const postedIds = writes
    .filter((request) => request.method === "POST")
    .map((request) => request.body?.id)
    .filter((id): id is string => typeof id === "string");
  expect(new Set(postedIds).size).toBe(postedIds.length);
  expect([...local.runs.values()].map((run) => run.name).sort()).toEqual([
    "exec_command",
    "openai.codex",
    "openai.codex.turn",
  ]);
  expect(
    writes.some((request) => request.method === "PATCH" && request.pathname === `/runs/${root.id}`),
  ).toBe(true);
  expect(
    writes.some((request) => request.method === "PATCH" && request.pathname === `/runs/${tool.id}`),
  ).toBe(true);
  expect(root.id).toBe(earlyRoot.id);
  expect(tool.id).toBe(earlyTool.id);
  expect(root.extra).toMatchObject({
    metadata: {
      repository_url: INCREMENTAL_TRACE_TEST.repoBUrl,
      git_branch: INCREMENTAL_TRACE_TEST.branchB,
      unrelated: INCREMENTAL_TRACE_TEST.unrelatedMetadata,
    },
  });
  expect(tool.extra).toMatchObject({
    metadata: {
      repository_url: INCREMENTAL_TRACE_TEST.repoBUrl,
      git_branch: INCREMENTAL_TRACE_TEST.branchB,
      unrelated: INCREMENTAL_TRACE_TEST.unrelatedMetadata,
    },
  });
  expect(await fs.readFile(transcriptPath, "utf8")).toBe(original);
  expect((await loadTurnStates(transcriptPath)).get(INCREMENTAL_TRACE_TEST.turnId)).toBe(
    "uploaded",
  );
});
