import "./utils/mock-memfs.js";
import * as fs from "node:fs/promises";
import { Client } from "langsmith";
import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { loadTurnStates } from "../src/trace-delivery-store.js";
import { submitPreference } from "../src/tracing-policy.js";
import type { RolloutEventsOptions, TraceRunExtra } from "./models/trace-delivery.js";
import type { LocalTraceServer } from "./models/incremental-trace.js";
import { createIncrementalTraceServer } from "./incremental-trace-server.js";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000002";
const PROJECT_NAME = "local-project";
const ROLLOUT = "/workspace/repo/rollout.jsonl";
const PRIVACY = "/workspace/privacy.json";
const SESSIONS_ROOT = "/workspace/sessions";
const PARENT_THREAD = "parent-thread-id";
const PARENT_TURN = "parent-turn-id";
const CHILD_THREAD = "child-thread-id";
const CHILD_TURN = "child-turn-id";
let deliveryServer: LocalTraceServer | undefined;

function startDeliveryServer() {
  return createIncrementalTraceServer({
    defaultProjectName: "default",
    postStatus: 202,
    projectIdForName: (name) => (name === PROJECT_NAME ? PROJECT_ID : DEFAULT_PROJECT_ID),
  });
}

function rolloutEvents(options: RolloutEventsOptions) {
  const threadId = options.threadId ?? "thread-id";
  const turnId = options.turnId ?? "turn-id";
  const start = Date.parse("2026-04-23T00:00:00.000Z");
  const event = (offset: number, type: string, payload: Record<string, unknown>) => ({
    timestamp: new Date(start + offset).toISOString(),
    type,
    payload,
  });
  return [
    event(0, "session_meta", {
      id: threadId,
      cwd: "/workspace/repo",
      source:
        options.parentThreadId == null
          ? "cli"
          : { subagent: { thread_spawn: { parent_thread_id: options.parentThreadId } } },
      model_provider: "openai",
    }),
    ...((options.started ?? true)
      ? [
          event(1000, "event_msg", {
            type: "task_started",
            turn_id: turnId,
          }),
        ]
      : []),
    event(1100, "turn_context", { cwd: "/workspace/repo", model: "test" }),
    event(1200, "response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: `${threadId} question` }],
    }),
    ...(options.childThreadId
      ? [
          event(1300, "response_item", {
            type: "function_call",
            name: "spawn_agent",
            call_id: "spawn-child",
            arguments: "{}",
          }),
          event(1400, "response_item", {
            type: "function_call_output",
            call_id: "spawn-child",
            output: JSON.stringify({ agent_id: options.childThreadId }),
          }),
        ]
      : []),
    event(2000, "response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: `${threadId} answer` }],
    }),
    event(2500, "event_msg", {
      type: "turn_complete",
      turn_id: turnId,
    }),
  ];
}

async function writeRollout(file = ROLLOUT, options: RolloutEventsOptions = {}) {
  const events = rolloutEvents(options);
  await fs.writeFile(file, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

async function writeSubagentRollouts() {
  const parentFile = `${SESSIONS_ROOT}/rollout-${PARENT_THREAD}.jsonl`;
  const childFile = `${SESSIONS_ROOT}/rollout-${CHILD_THREAD}.jsonl`;
  await writeRollout(parentFile, {
    threadId: PARENT_THREAD,
    turnId: PARENT_TURN,
    childThreadId: CHILD_THREAD,
  });
  await writeRollout(childFile, {
    threadId: CHILD_THREAD,
    turnId: CHILD_TURN,
    parentThreadId: PARENT_THREAD,
  });
  return { parentFile, childFile };
}

function isSubagentRun(run: Record<string, unknown>, threadId: string) {
  const metadata = (run.extra as TraceRunExtra | undefined)?.metadata;
  return metadata?.ls_subagent_id === threadId;
}

function subagentRuns(threadId: string) {
  const firstRuns = [...deliveryServer!.runAttempts].map(([id, [run]]) => [id, run] as const);
  const root = firstRuns.find(([, run]) => isSubagentRun(run, threadId));
  if (root == null) return new Map<string, Record<string, unknown>>();
  const [rootId, rootRun] = root;
  return new Map(
    firstRuns.filter(
      ([id, run]) =>
        id === rootId ||
        (run.trace_id === rootRun.trace_id &&
          typeof run.dotted_order === "string" &&
          run.dotted_order.startsWith(`${rootRun.dotted_order}.`)),
    ),
  );
}

function expectPersistedTopology(firstRuns: Map<string, Record<string, unknown>>) {
  for (const [id, first] of firstRuns) {
    const attempts = deliveryServer!.runAttempts.get(id)!;
    expect(deliveryServer!.conflicts).not.toContain(id);
    expect(attempts).toHaveLength(1);
    const stored = deliveryServer!.runs.get(id)!;
    expect(stored.trace_id).toBe(first.trace_id);
    expect(stored.parent_run_id ?? undefined).toBe(first.parent_run_id ?? undefined);
    expect(stored.dotted_order).toBe(first.dotted_order);
  }
}

function client() {
  return new Client({
    apiUrl: deliveryServer!.apiUrl,
    apiKey: "local-test-key",
    autoBatchTracing: false,
    callerOptions: { maxRetries: 0 },
  });
}

async function upload(
  file = ROLLOUT,
  turnId: string | null = "turn-id",
  clientValue = client(),
  sessionsRoot?: string,
) {
  return convertToRunTree(
    { transcript_path: file, turn_id: turnId },
    { client: clientValue, projectName: PROJECT_NAME, privacyPath: PRIVACY, sessionsRoot },
  );
}

beforeEach(async () => {
  vol.reset();
  vol.mkdirSync("/workspace/repo", { recursive: true });
  vol.mkdirSync(SESSIONS_ROOT, { recursive: true });
  deliveryServer = await startDeliveryServer();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vol.reset();
  if (deliveryServer) {
    await deliveryServer.close();
    deliveryServer = undefined;
  }
});

it("waits for a slow endpoint and leaves failed turns pending for retry", async () => {
  deliveryServer!.setFailWrites(true);
  await writeRollout();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tracingClient = client();

  await expect(upload(ROLLOUT, "turn-id", tracingClient)).rejects.toThrow();
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map());

  deliveryServer!.setFailWrites(false);
  deliveryServer!.setDelayMs(80);
  const start = Date.now();
  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(Date.now() - start).toBeGreaterThanOrEqual(60);
  expect(deliveryServer!.runs.size).toBeGreaterThan(0);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "uploaded"]]));
}, 15_000);

it("reuses sent runs after acknowledgement fails and rejects a real duplicate", async () => {
  await writeRollout(ROLLOUT, { started: false, turnId: "turn-id" });
  const tracingClient = client();
  const append = vi.spyOn(fs, "appendFile").mockRejectedValueOnce(new Error("synthetic crash"));

  await expect(upload(ROLLOUT, "turn-id", tracingClient)).rejects.toThrow("synthetic crash");
  append.mockRestore();
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map());
  const storedRuns = [...deliveryServer!.runs.values()];
  expect(storedRuns.length).toBeGreaterThan(0);

  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "uploaded"]]));
  expect(deliveryServer!.runs.size).toBe(storedRuns.length);
  for (const [id, attempts] of deliveryServer!.runAttempts) {
    expect(attempts).toHaveLength(1);
    expect(attempts[0].id).toBe(id);
  }

  const first = storedRuns[0];
  await expect(
    tracingClient.createRun({
      id: String(first.id),
      name: String(first.name),
      run_type: String(first.run_type),
      inputs: {},
      project_name: PROJECT_NAME,
    }),
  ).rejects.toMatchObject({ status: 409 });
});

it("keeps the first child topology when a parent retries after a lost child acknowledgement", async () => {
  const { parentFile, childFile } = await writeSubagentRollouts();
  const tracingClient = client();
  const appendFile = fs.appendFile.bind(fs);
  const append = vi
    .spyOn(fs, "appendFile")
    .mockImplementation((file, data, options) =>
      String(file) === `${childFile}.langsmith`
        ? Promise.reject(new Error("synthetic child acknowledgement failure"))
        : appendFile(file, data, options),
    );

  await expect(upload(childFile, CHILD_TURN, tracingClient, SESSIONS_ROOT)).rejects.toThrow(
    "synthetic child acknowledgement failure",
  );
  append.mockRestore();
  expect(await loadTurnStates(childFile)).toEqual(new Map());
  const firstChildRuns = new Map(
    [...deliveryServer!.runAttempts].map(([id, attempts]) => [id, attempts[0]]),
  );
  expect(firstChildRuns.size).toBeGreaterThan(1);

  await upload(parentFile, PARENT_TURN, tracingClient, SESSIONS_ROOT);

  expect(await loadTurnStates(childFile)).toEqual(new Map([[CHILD_TURN, "uploaded"]]));
  expect(await loadTurnStates(parentFile)).toEqual(new Map([[PARENT_TURN, "uploaded"]]));
  expectPersistedTopology(firstChildRuns);
});

async function retryChildAfterParentUpload(muted = false) {
  const { parentFile, childFile } = await writeSubagentRollouts();
  if (muted) {
    await submitPreference(PRIVACY, PARENT_THREAD, "mute-command-turn", true, "mute");
    await submitPreference(PRIVACY, PARENT_THREAD, PARENT_TURN, true);
  }
  const tracingClient = client();

  await upload(parentFile, PARENT_TURN, tracingClient, SESSIONS_ROOT);
  const firstChildRuns = subagentRuns(CHILD_THREAD);
  expect(firstChildRuns.size).toBeGreaterThan(1);
  if (muted) {
    for (const first of firstChildRuns.values()) {
      expect(first.extra).toMatchObject({ metadata: { ls_tracing_mode: "metadata" } });
    }
  }
  await fs.unlink(`${childFile}.langsmith`);

  await upload(childFile, CHILD_TURN, tracingClient, SESSIONS_ROOT);

  expectPersistedTopology(firstChildRuns);
  if (muted) {
    for (const id of firstChildRuns.keys()) {
      expect(deliveryServer!.runs.get(id)).toMatchObject({
        extra: { metadata: { ls_tracing_mode: "metadata" } },
      });
    }
  } else {
    expect(await loadTurnStates(childFile)).toEqual(new Map([[CHILD_TURN, "uploaded"]]));
  }
}

it("keeps nested child topology when the child retries after a lost parent acknowledgement", async () => {
  await retryChildAfterParentUpload();
});

it("keeps muted nested child order when the child retries after a lost acknowledgement", async () => {
  await retryChildAfterParentUpload(true);
});

it("rejects a conflict when the stored run belongs to another project", async () => {
  await writeRollout();
  const tracingClient = client();
  await upload(ROLLOUT, "turn-id", tracingClient);
  const retryFile = "/workspace/repo/second-rollout.jsonl";
  await writeRollout(retryFile);
  const firstRun = deliveryServer!.runs.values().next().value as Record<string, unknown>;
  firstRun.session_id = "00000000-0000-0000-0000-000000000002";

  await expect(upload(retryFile, "turn-id", tracingClient)).rejects.toThrow();
  expect(await loadTurnStates(retryFile)).toEqual(new Map());
});

it("keeps muted turns skipped after the preference changes", async () => {
  await writeRollout();
  await submitPreference(PRIVACY, "thread-id", "turn-id", false);
  const tracingClient = client();

  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "off"]]));
  expect(deliveryServer!.runAttempts.size).toBe(0);

  await submitPreference(PRIVACY, "thread-id", "turn-id", true, "unmute");
  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(deliveryServer!.runAttempts.size).toBe(0);
});
