import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "langsmith";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { convertToRunTree } from "../src/trace.js";
import { loadTurnStates } from "../src/trace-delivery-store.js";
import { ignoreMissingFile } from "../src/utils/files.js";
import * as traceDeliveryStore from "../src/trace-delivery-store.js";
import { TURN_CAPTURE_PLAN, TURN_CAPTURE_TRANSCRIPT } from "../src/tool-capture-constants.js";
import { recordToolHook, turnCaptureDirectory } from "../src/tool-capture.js";
import type { ReconciliationMetadata, TracingHookInput } from "../src/models/tool-capture.js";
import type { TurnMode } from "../src/models/tracing-policy.js";
import type { ResolvedGitAttribution } from "../src/metadata-models.js";
import { resolveGitAttribution } from "../src/metadata.js";
import {
  INCREMENTAL_TRACE_TEST,
  SYNTHETIC_REPOSITORY_A,
  SYNTHETIC_REPOSITORY_B,
} from "./constants/incremental-trace.js";
import type { LocalTraceServer, SyntheticTranscriptEvent } from "./models/incremental-trace.js";
import { createIncrementalTraceServer } from "./incremental-trace-server.js";

vi.mock("../src/metadata.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/metadata.js")>();
  return { ...actual, resolveGitAttribution: vi.fn() };
});

let local: LocalTraceServer;
let client: Client;
let testRoot: string;
let transcriptPath: string;
let privacyPath: string;
let captureDirectory: string;
const gitLookups = new Map<string, ResolvedGitAttribution>();

function transcriptEvents(): SyntheticTranscriptEvent[] {
  const start = Date.parse("2026-10-08T12:00:00.000Z");
  const event = (seconds: number, type: string, payload: Record<string, unknown>) => ({
    timestamp: new Date(start + seconds * 1000).toISOString(),
    type,
    payload,
  });
  return [
    event(0, "session_meta", {
      id: INCREMENTAL_TRACE_TEST.sessionId,
      cwd: INCREMENTAL_TRACE_TEST.rootCwd,
      originator: "synthetic-test",
      cli_version: "0.160.0",
      source: "cli",
      model_provider: "openai",
    }),
    event(1, "event_msg", { type: "task_started", turn_id: INCREMENTAL_TRACE_TEST.turnId }),
    event(2, "turn_context", { cwd: INCREMENTAL_TRACE_TEST.rootCwd, model: "synthetic-model" }),
    event(3, "response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: INCREMENTAL_TRACE_TEST.requestSecret }],
    }),
    event(4, "response_item", {
      type: "function_call",
      name: "exec_command",
      arguments: JSON.stringify({
        command: INCREMENTAL_TRACE_TEST.toolInputSecret,
        cwd: INCREMENTAL_TRACE_TEST.toolCwd,
      }),
      call_id: INCREMENTAL_TRACE_TEST.toolId,
    }),
  ];
}

async function installTranscript(mode: TurnMode) {
  const content = `${transcriptEvents()
    .map((event) => JSON.stringify(event))
    .join("\n")}\n`;
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

function convert(event: TracingHookInput["hook_event_name"]) {
  const hook = hookInput(event);
  return convertToRunTree(hook, {
    hook,
    client,
    projectName: INCREMENTAL_TRACE_TEST.projectName,
    privacyPath,
    metadata: { unrelated: INCREMENTAL_TRACE_TEST.unrelatedMetadata },
  });
}

function runNamed(name: string) {
  const run = [...local.runs.values()].find((candidate) => candidate.name === name);
  if (run === undefined) throw new Error(`Run ${name} was not delivered`);
  return run;
}

async function turnState() {
  return (await loadTurnStates(transcriptPath)).get(INCREMENTAL_TRACE_TEST.turnId);
}

function expectUniqueCreates() {
  const ids = local
    .requestsFor("POST")
    .map((request) => request.body?.id)
    .filter((id): id is string => typeof id === "string");
  expect(new Set(ids).size).toBe(ids.length);
}

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "incremental-trace-test-"));
  transcriptPath = path.join(testRoot, "lifecycle.jsonl");
  privacyPath = path.join(testRoot, "privacy.json");
  captureDirectory = turnCaptureDirectory(transcriptPath, INCREMENTAL_TRACE_TEST.turnId);
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
  const capturedFiles = (await fs.readdir(captureDirectory).catch(ignoreMissingFile)) ?? [];
  for (const file of capturedFiles) await fs.unlink(path.join(captureDirectory, file));
  await fs.rmdir(captureDirectory).catch(ignoreMissingFile);
  for (const file of await fs.readdir(testRoot)) await fs.unlink(path.join(testRoot, file));
  await fs.rmdir(testRoot);
});

it("uploads a tool early then patches the same root and tool runs with final repository metadata", async () => {
  const original = await installTranscript("full");
  await recordToolHook(hookInput("PreToolUse"), "full");
  await convert("PostToolUse");

  const earlyRoot = runNamed("openai.codex");
  const earlyTool = runNamed("exec_command");
  expect(earlyRoot.end_time).toBeUndefined();
  expect(earlyRoot.outputs).toBeUndefined();
  expect(earlyTool.outputs).toMatchObject({
    output: { stdout: INCREMENTAL_TRACE_TEST.toolOutputSecret },
  });
  expect(local.requestsFor("POST")).toHaveLength(2);

  await convert("Stop");

  const root = runNamed("openai.codex");
  const tool = runNamed("exec_command");
  const writes = local.requestsFor();
  expectUniqueCreates();
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
  for (const run of [root, tool]) {
    expect(run.extra).toMatchObject({
      metadata: {
        repository_url: INCREMENTAL_TRACE_TEST.repoBUrl,
        git_branch: INCREMENTAL_TRACE_TEST.branchB,
        unrelated: INCREMENTAL_TRACE_TEST.unrelatedMetadata,
      },
    });
  }
  expect(await fs.readFile(transcriptPath, "utf8")).toBe(original);
  expect(await turnState()).toBe("uploaded");
});

it("preserves a configured root repository while reconciling the tool's own repository", async () => {
  await installTranscript("full");
  gitLookups.set(INCREMENTAL_TRACE_TEST.rootCwd, SYNTHETIC_REPOSITORY_A);
  await convert("PostToolUse");
  const responses = [
    { type: "function_call_output", call_id: INCREMENTAL_TRACE_TEST.toolId, output: "done" },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: "done" }] },
  ];
  for (const payload of responses) {
    await fs.appendFile(
      transcriptPath,
      JSON.stringify({ timestamp: "2026-10-08T12:00:05.000Z", type: "response_item", payload }) +
        "\n",
    );
  }
  await convert("Stop");
  expect(runNamed("openai.codex").extra).toMatchObject({
    metadata: { repository_url: INCREMENTAL_TRACE_TEST.repoAUrl },
  });
  expect(runNamed("exec_command").extra).toMatchObject({
    metadata: { repository_url: INCREMENTAL_TRACE_TEST.repoBUrl },
  });
});

it("keeps a pre-only tool pending at Stop and reconciles its late result exactly once", async () => {
  const original = await installTranscript("full");
  await recordToolHook(hookInput("PreToolUse"), "full");

  await convert("Stop");

  const openRoot = runNamed("openai.codex");
  const writesBeforePost = local.requestsFor().length;
  expect(openRoot.end_time).toBeUndefined();
  expect(await turnState()).toBeUndefined();

  await convert("PostToolUse");

  const completedRoot = runNamed("openai.codex");
  const tool = runNamed("exec_command");
  expect(completedRoot.id).toBe(openRoot.id);
  expect(tool.outputs).toMatchObject({
    output: { stdout: INCREMENTAL_TRACE_TEST.toolOutputSecret },
  });
  expect(local.requestsFor().length).toBeGreaterThan(writesBeforePost);
  expect(await turnState()).toBe("uploaded");
  expect(await fs.readFile(transcriptPath, "utf8")).toBe(original);

  const writesAfterCompletion = local.requestsFor();
  await convert("PostToolUse");
  expect(local.requestsFor()).toEqual(writesAfterCompletion);
});

it("uses the saved full-mode snapshot when the host transcript disappears before Stop", async () => {
  await installTranscript("full");
  await recordToolHook(hookInput("PreToolUse"), "full");
  await convert("PostToolUse");

  const snapshotPath = `${captureDirectory}/${TURN_CAPTURE_TRANSCRIPT}`;
  await expect(fs.stat(snapshotPath)).resolves.toBeDefined();
  await fs.unlink(transcriptPath);

  await convert("Stop");

  expect(runNamed("openai.codex").end_time).toBeDefined();
  expect(runNamed("exec_command").outputs).toMatchObject({
    output: { stdout: INCREMENTAL_TRACE_TEST.toolOutputSecret },
  });
  expect(await turnState()).toBe("uploaded");
});

it("keeps the reconciliation plan and capture after a failed patch then retries with the saved metadata", async () => {
  await installTranscript("full");
  await recordToolHook(hookInput("PreToolUse"), "full");
  await convert("PostToolUse");

  const rootId = runNamed("openai.codex").id;
  local.failPatchRunIds.add(rootId);
  await expect(convert("Stop")).rejects.toThrow();

  expect(await turnState()).toBeUndefined();
  await expect(fs.stat(captureDirectory)).resolves.toBeDefined();
  const planPath = `${captureDirectory}/${TURN_CAPTURE_PLAN}`;
  const savedPlan = JSON.parse(await fs.readFile(planPath, "utf8")) as ReconciliationMetadata;
  expect(savedPlan.root.repository_url).toBe(INCREMENTAL_TRACE_TEST.repoBUrl);
  expect(savedPlan.tools[INCREMENTAL_TRACE_TEST.toolId]?.repository_url).toBe(
    INCREMENTAL_TRACE_TEST.repoBUrl,
  );

  gitLookups.set(INCREMENTAL_TRACE_TEST.toolCwd, SYNTHETIC_REPOSITORY_A);
  await convert("Stop");

  for (const name of ["openai.codex", "exec_command"]) {
    expect(runNamed(name).extra).toMatchObject({
      metadata: { repository_url: INCREMENTAL_TRACE_TEST.repoBUrl },
    });
  }
  expect(await turnState()).toBe("uploaded");
  await expect(fs.stat(captureDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  const rootPatches = local.requestsFor("PATCH", `/runs/${rootId}`);
  expect(rootPatches).toHaveLength(2);
  expectUniqueCreates();
});

it("reuses the saved final run after Stop loses its local acknowledgement", async () => {
  await installTranscript("full");
  await convert("PostToolUse");

  const acknowledge = vi
    .spyOn(traceDeliveryStore, "markTurnHandled")
    .mockRejectedValueOnce(new Error("synthetic local acknowledgement failure"));
  try {
    await expect(convert("Stop")).rejects.toThrow("synthetic local acknowledgement failure");
  } finally {
    acknowledge.mockRestore();
  }

  const root = runNamed("openai.codex");
  const firstPatch = local.requestsFor("PATCH", `/runs/${root.id}`)[0];
  expect(firstPatch?.body?.end_time).toBeDefined();
  await convert("Stop");

  const rootPatches = local.requestsFor("PATCH", `/runs/${root.id}`);
  expect(rootPatches).toHaveLength(1);
  expect(local.runs.get(root.id)?.end_time).toBe(firstPatch?.body?.end_time);
  expect(await turnState()).toBe("uploaded");
});

it.each(["metadata", "off"] as const)(
  "keeps %s-mode tool content out of captures and requests",
  async (mode) => {
    await installTranscript(mode);
    await recordToolHook(hookInput("PreToolUse"), mode);
    await convert("PostToolUse");

    const captureFiles = (await fs.readdir(captureDirectory).catch(ignoreMissingFile)) ?? [];
    const ownedCapture = await Promise.all(
      captureFiles.map(async (file) => [
        file,
        await fs.readFile(path.join(captureDirectory, file), "utf8"),
      ]),
    );
    const payload = JSON.stringify({ requests: local.requests, capture: ownedCapture });
    expect(payload).not.toContain(INCREMENTAL_TRACE_TEST.requestSecret);
    expect(payload).not.toContain(INCREMENTAL_TRACE_TEST.toolInputSecret);
    expect(payload).not.toContain(INCREMENTAL_TRACE_TEST.toolOutputSecret);

    if (mode === "metadata") {
      expect(local.runs.size).toBeGreaterThan(0);
      expect(ownedCapture.length).toBeGreaterThan(0);
      expect(JSON.stringify(ownedCapture)).not.toContain('"input":');
      expect(JSON.stringify(ownedCapture)).not.toContain('"output":');
    } else {
      expect(local.runs.size).toBe(0);
      expect(ownedCapture).toEqual([]);
    }
  },
);
