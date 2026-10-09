import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Client } from "langsmith";
import { trackIncrementalDelivery } from "../src/incremental-delivery.js";
import { staleTurnRecovery } from "../src/stale-turn-recovery.js";
import { cleanupStalePluginState } from "../src/stale-state-cleanup.js";
import { stableRunId } from "../src/trace-delivery.js";
import { prepareTurnCapture, recordToolHook, turnCaptureDirectory } from "../src/tool-capture.js";
import type { LocalTraceServer } from "./models/incremental-trace.js";
import { createIncrementalTraceServer } from "./incremental-trace-server.js";

let home: string;
let sessions: string;
let transcript: string;
let local: LocalTraceServer;
let client: Client;
const sessionId = "00000000-0000-0000-0000-000000000001";
const currentId = "00000000-0000-0000-0000-000000000002";
const turn = "recovery-turn";
const start = Date.parse("2026-01-01T00:00:00Z");

async function removeCreated(directory: string) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await removeCreated(file);
    else await fs.unlink(file);
  }
  await fs.rmdir(directory);
}

async function age(directory: string) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await age(file);
    await fs.utimes(file, start / 1000, start / 1000);
  }
}

async function partial(mode = "metadata", configured = true, metadataThreadId = sessionId) {
  const rootId = stableRunId(sessionId, transcript, turn, "root");
  const toolId = stableRunId(sessionId, transcript, turn, "tool:call");
  const metadata = {
    thread_id: metadataThreadId,
    turn_id: turn,
    ls_tracing_mode: mode,
    ...(mode === "full" && configured
      ? { repository_url: "https://example.test/configured", ls_attribution_identifier: "author" }
      : {}),
  };
  const tracked = trackIncrementalDelivery(
    client,
    [],
    transcript,
    turn,
    false,
    undefined,
    undefined,
    sessionId,
  );
  const root = {
    id: rootId,
    name: "openai.codex",
    run_type: "chain" as const,
    project_name: "original-project",
    start_time: start,
    trace_id: rootId,
    dotted_order: "root",
    inputs: {},
    extra: { metadata },
  };
  await tracked.createRun(root);
  await tracked.createRun({
    ...root,
    id: toolId,
    name: "exec",
    run_type: "tool",
    parent_run_id: rootId,
    dotted_order: "root.tool",
    end_time: start + 1000,
    outputs: { result: "ready" },
  });
  if (mode === "full") {
    await fs.writeFile(
      transcript,
      [
        {
          timestamp: new Date(start).toISOString(),
          type: "session_meta",
          payload: { id: sessionId, cwd: home },
        },
        {
          timestamp: new Date(start).toISOString(),
          type: "event_msg",
          payload: { type: "task_started", turn_id: turn },
        },
      ]
        .map((value) => JSON.stringify(value))
        .join("\n") + "\n",
    );
    await recordToolHook(
      {
        session_id: sessionId,
        turn_id: turn,
        transcript_path: transcript,
        hook_event_name: "PostToolUse",
        cwd: home,
        prompt: "",
        tool_use_id: "call",
        tool_name: "exec",
        tool_input: { command: "echo ready" },
        tool_response: "ready",
      },
      "full",
    );
    await prepareTurnCapture(transcript, turn, "full");
  }
  await age(sessions);
  return { rootId, toolId };
}

async function cleanup(clients = [client]) {
  await cleanupStalePluginState(path.join(sessions, "current.jsonl"), currentId, {
    now: start + 2 * 60 * 60 * 1000 + 1,
    privacyPath: path.join(home, "privacy.json"),
    recover: staleTurnRecovery(clients),
  });
}

function holdRecoveryRead() {
  const started = Promise.withResolvers<void>();
  const blocked = Promise.withResolvers<void>();
  const readRun = client.readRun.bind(client);
  client.readRun = async (...args) => {
    started.resolve();
    await blocked.promise;
    return readRun(...args);
  };
  return { started: started.promise, release: blocked.resolve };
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "stale-recovery-test-"));
  sessions = path.join(home, "sessions");
  await fs.mkdir(sessions);
  transcript = path.join(sessions, `rollout-2026-01-01T00-00-00-${sessionId}.jsonl`);
  local = await createIncrementalTraceServer();
  client = new Client({
    apiUrl: local.apiUrl,
    apiKey: "recovery-test-key",
    autoBatchTracing: false,
  });
});

afterEach(async () => {
  await local.close();
  await removeCreated(home);
});

it("finishes stranded muted runs in their original project without needing a transcript", async () => {
  const { rootId, toolId } = await partial();
  await cleanup();
  expect(local.runs.get(rootId)?.error).toContain("interrupted");
  expect(local.runs.get(toolId)?.outputs).toEqual({ result: "ready" });
  for (const id of [rootId, toolId]) {
    expect(new Date(local.runs.get(id)?.end_time as string).getTime()).toBe(start + 1000);
    expect(local.runs.get(id)?.session_id).toBe(local.projectId);
  }
  expect(await fs.readdir(sessions)).toEqual([]);
});

it("reconciles configured Git from the saved copy when the original is gone", async () => {
  const { rootId, toolId } = await partial("full");
  await fs.unlink(transcript);
  await cleanup();
  for (const id of [rootId, toolId]) {
    expect(local.runs.get(id)?.extra).toMatchObject({
      metadata: {
        repository_url: "https://example.test/configured",
        ls_attribution_identifier: "author",
      },
    });
    expect(local.runs.get(id)?.end_time).toBeDefined();
  }
  expect(await fs.readdir(sessions)).toEqual([]);
});

it("keeps retry records for a rejected patch and finishes them on the next scan", async () => {
  const { rootId } = await partial();
  local.failNextPatch = true;
  await cleanup();
  expect((await fs.readdir(sessions)).some((name) => name.includes("incremental"))).toBe(true);
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  await age(sessions);
  await cleanup();
  expect(local.runs.get(rootId)?.end_time).toBeDefined();
  expect(await fs.readdir(sessions)).toEqual([]);
});

it("does not use another credential or recover a recently active session", async () => {
  const { rootId } = await partial();
  const other = new Client({
    apiUrl: local.apiUrl,
    apiKey: "other-test-key",
    autoBatchTracing: false,
  });
  await cleanup([other]);
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  await fs.writeFile(
    path.join(home, "privacy.json"),
    JSON.stringify({
      version: 1,
      threads: {
        [sessionId]: { turns: { [turn]: "metadata" }, lastActivityAt: start + 2 * 60 * 60 * 1000 },
      },
    }),
  );
  await cleanup();
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  expect(local.requests.filter((request) => request.method === "PATCH")).toEqual([]);
});

it("recovers subagent runs whose tracing metadata names the parent thread", async () => {
  const { rootId } = await partial("metadata", true, "parent-session");
  await age(sessions);
  await cleanup();
  expect(local.runs.get(rootId)?.end_time).toBeDefined();
});

it("fills missing root Git from a captured tool before closing every run", async () => {
  const repository = path.join(home, "repository");
  await fs.mkdir(repository);
  execFileSync("git", ["init", "--quiet", repository]);
  execFileSync("git", [
    "-C",
    repository,
    "remote",
    "add",
    "origin",
    "https://github.com/example/recovered",
  ]);
  execFileSync("git", ["-C", repository, "config", "user.name", "Recovery User"]);
  const { rootId, toolId } = await partial("full", false);
  const directory = turnCaptureDirectory(transcript, turn);
  const record = (await fs.readdir(directory)).find((file) => file.endsWith(".end.json"))!;
  const file = path.join(directory, record);
  const tool = JSON.parse(await fs.readFile(file, "utf8"));
  await fs.writeFile(
    file,
    JSON.stringify({ ...tool, input: { workdir: repository, cmd: "git status" } }),
  );
  await age(sessions);
  await cleanup();
  for (const id of [rootId, toolId]) {
    expect(local.runs.get(id)?.extra).toMatchObject({
      metadata: {
        repository_url: "https://github.com/example/recovered",
        ls_attribution_identifier: "Recovery User",
      },
    });
  }
  expect(await fs.readdir(sessions)).toEqual([path.basename(transcript)]);
});

it("retains state when a closed run silently refuses its required final update", async () => {
  const { rootId } = await partial();
  for (const run of local.runs.values()) run.end_time = new Date(start).toISOString();
  client.updateRun = async () => {};
  await cleanup();
  expect((await fs.readdir(sessions)).some((name) => name.includes("incremental"))).toBe(true);
  expect(local.runs.get(rootId)?.error).toBeUndefined();
}, 15000);

it("keeps the original redacted snapshot unchanged while recovering", async () => {
  await partial("full");
  const snapshot = path.join(turnCaptureDirectory(transcript, turn), "transcript.jsonl");
  const before = await fs.readFile(snapshot, "utf8");
  await fs.appendFile(
    transcript,
    JSON.stringify({
      timestamp: new Date(start).toISOString(),
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec",
        call_id: "private-call",
        arguments: JSON.stringify({ cmd: "CONFIDENTIAL_EXACT" }),
      },
    }) + "\n",
  );
  await age(sessions);
  local.failNextPatch = true;
  await cleanup();
  expect(await fs.readFile(snapshot, "utf8")).toBe(before);
});

it("does not recover a turn after the native transcript resumes during verification", async () => {
  const { rootId } = await partial();
  const read = holdRecoveryRead();
  const pendingCleanup = cleanup();
  await read.started;
  await fs.appendFile(
    transcript,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "event_msg",
      payload: { type: "task_started", turn_id: "resumed-turn" },
    }) + "\n",
  );
  read.release();
  await pendingCleanup;
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  expect((await fs.readdir(sessions)).some((name) => name.includes("incremental"))).toBe(true);
});

it("does not recover a turn after a new rollout for the same session appears", async () => {
  const { rootId } = await partial();
  const read = holdRecoveryRead();
  const pendingCleanup = cleanup();
  await read.started;
  const newDateDirectory = path.join(sessions, "2026", "01", "02");
  await fs.mkdir(newDateDirectory, { recursive: true });
  await fs.writeFile(
    path.join(newDateDirectory, `rollout-2026-01-02T00-00-00-${sessionId}.jsonl`),
    `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
  );
  read.release();
  await pendingCleanup;
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  expect((await fs.readdir(sessions)).some((name) => name.includes("incremental"))).toBe(true);
});

it("does not recover a turn after a native writer lock appears during verification", async () => {
  const { rootId } = await partial();
  const read = holdRecoveryRead();
  const pendingCleanup = cleanup();
  await read.started;
  const writerLocks = path.join(home, "thread-writer-locks");
  await fs.mkdir(writerLocks);
  await fs.writeFile(path.join(writerLocks, `${sessionId}.lock`), "");
  read.release();
  await pendingCleanup;
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  expect((await fs.readdir(sessions)).some((name) => name.includes("incremental"))).toBe(true);
});

it("closes existing runs conservatively when both transcript copies are missing", async () => {
  const { rootId, toolId } = await partial("full");
  await fs.unlink(transcript);
  await fs.unlink(path.join(turnCaptureDirectory(transcript, turn), "transcript.jsonl"));
  await age(sessions);
  await cleanup();
  for (const id of [rootId, toolId]) expect(local.runs.get(id)?.end_time).toBeDefined();
  expect(await fs.readdir(sessions)).toEqual([]);
});

it("waits for the original redaction policy before recovering a turn", async () => {
  const { rootId } = await partial();
  const policy = "a".repeat(64);
  for (const name of await fs.readdir(sessions)) {
    const file = path.join(sessions, name);
    const checkpoint = JSON.parse(await fs.readFile(file, "utf8"));
    checkpoint.recovery.redactionPolicy = policy;
    await fs.writeFile(file, JSON.stringify(checkpoint));
  }
  await age(sessions);
  await cleanup();
  expect(local.runs.get(rootId)?.end_time).toBeUndefined();
  await cleanupStalePluginState(path.join(sessions, "current.jsonl"), currentId, {
    now: start + 2 * 60 * 60 * 1000 + 1,
    privacyPath: path.join(home, "privacy.json"),
    recover: staleTurnRecovery([client], undefined, policy),
  });
  expect(local.runs.get(rootId)?.end_time).toBeDefined();
});

it("makes bounded progress through a session larger than one recovery batch", async () => {
  const { rootId } = await partial();
  const tracked = trackIncrementalDelivery(client, [], transcript, turn, false);
  for (let index = 0; index < 100; index++) {
    await tracked.createRun({
      id: stableRunId(sessionId, transcript, turn, `tool:extra-${index}`),
      name: "exec",
      run_type: "tool",
      project_name: "original-project",
      inputs: {},
      start_time: start,
      end_time: start + 1000,
      trace_id: rootId,
      parent_run_id: rootId,
      dotted_order: `root.extra-${index}`,
      extra: { metadata: { thread_id: sessionId, turn_id: turn, ls_tracing_mode: "metadata" } },
    });
  }
  await age(sessions);
  await cleanup();
  expect([...local.runs.values()].filter((run) => run.end_time != null)).toHaveLength(100);
  await age(sessions);
  await cleanup();
  expect([...local.runs.values()].every((run) => run.end_time != null)).toBe(true);
  expect(await fs.readdir(sessions)).toEqual([]);
});

it("expires verified completed records without their old credentials or parent identity", async () => {
  const tracked = trackIncrementalDelivery(client, [], transcript, turn);
  await tracked.createRun({
    id: stableRunId(sessionId, transcript, turn, "root"),
    name: "subagent",
    run_type: "chain",
    project_name: "original-project",
    inputs: {},
    start_time: start,
    end_time: start + 1000,
    extra: {
      metadata: { thread_id: "parent-session", turn_id: turn, ls_tracing_mode: "metadata" },
    },
  });
  await age(sessions);
  await cleanup([]);
  expect(await fs.readdir(sessions)).toEqual([]);
});
