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

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

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
  const event = (timestamp: string, type: string, payload: Record<string, unknown>) => ({
    timestamp,
    type,
    payload,
  });
  const events = [
    event("2026-04-23T00:00:00.000Z", "session_meta", {
      id: threadId,
      cwd: "/workspace/repo",
      source:
        options.parentThreadId == null
          ? "cli"
          : { subagent: { thread_spawn: { parent_thread_id: options.parentThreadId } } },
      model_provider: "openai",
    }),
  ];
  if (options.started ?? true) {
    events.push(
      event("2026-04-23T00:00:01.000Z", "event_msg", {
        type: "task_started",
        turn_id: turnId,
      }),
    );
  }
  events.push(
    event("2026-04-23T00:00:01.100Z", "turn_context", { cwd: "/workspace/repo", model: "test" }),
    event("2026-04-23T00:00:01.200Z", "response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: `${threadId} question` }],
    }),
  );
  if (options.childThreadId) {
    events.push(
      event("2026-04-23T00:00:01.300Z", "response_item", {
        type: "function_call",
        name: "spawn_agent",
        call_id: "spawn-child",
        arguments: "{}",
      }),
      event("2026-04-23T00:00:01.400Z", "response_item", {
        type: "function_call_output",
        call_id: "spawn-child",
        output: JSON.stringify({ agent_id: options.childThreadId }),
      }),
    );
  }
  events.push(
    event("2026-04-23T00:00:02.000Z", "response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: `${threadId} answer` }],
    }),
    event("2026-04-23T00:00:02.500Z", "event_msg", {
      type: "turn_complete",
      turn_id: turnId,
    }),
  );
  return events;
}

async function writeRollout(file = ROLLOUT, options: RolloutEventsOptions = {}) {
  vol.fromJSON({ [file]: "" });
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
  const requests = [...deliveryServer!.runAttempts];
  const root = requests.find(([, attempts]) => isSubagentRun(attempts[0], threadId));
  if (root == null) return new Map<string, Record<string, unknown>>();
  const rootRun = root[1][0];
  return new Map(
    requests
      .filter(([id, attempts]) => {
        const run = attempts[0];
        return (
          id === root[0] ||
          (run.trace_id === rootRun.trace_id &&
            typeof run.dotted_order === "string" &&
            run.dotted_order.startsWith(`${rootRun.dotted_order}.`))
        );
      })
      .map(([id, attempts]) => [id, attempts[0]]),
  );
}

function epochMilliseconds(value: unknown) {
  return new Date(value as string | number).getTime();
}

function expectTopologyRetries(firstRuns: Map<string, Record<string, unknown>>) {
  for (const [id, first] of firstRuns) {
    const attempts = deliveryServer!.runAttempts.get(id)!;
    expect(deliveryServer!.conflicts).toContain(id);
    expect(attempts).toHaveLength(2);
    expect(attempts[1].trace_id).toBe(first.trace_id);
    expect(attempts[1].parent_run_id).toBe(first.parent_run_id);
    expect(attempts[1].dotted_order).toBe(first.dotted_order);
  }
}

function client() {
  return new Client({
    apiUrl: deliveryServer!.apiUrl,
    apiKey: "local-test-key",
    autoBatchTracing: false,
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

beforeEach(() => {
  vol.reset();
  vol.mkdirSync("/workspace/repo", { recursive: true });
  vol.mkdirSync("/workspace", { recursive: true });
  vol.mkdirSync(SESSIONS_ROOT, { recursive: true });
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
  deliveryServer = await startDeliveryServer();
  deliveryServer.setDelayMs(80);
  deliveryServer.setFailWrites(true);
  await writeRollout();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tracingClient = client();

  await expect(upload(ROLLOUT, "turn-id", tracingClient)).rejects.toThrow();
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map());

  deliveryServer.setFailWrites(false);
  const start = Date.now();
  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(Date.now() - start).toBeGreaterThanOrEqual(60);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "uploaded"]]));
});

it("retries a sent turn after acknowledgement fails and checks real duplicate responses", async () => {
  deliveryServer = await startDeliveryServer();
  await writeRollout(ROLLOUT, { started: false, turnId: "turn-id" });
  const tracingClient = client();
  const append = vi.spyOn(fs, "appendFile").mockRejectedValueOnce(new Error("synthetic crash"));

  await expect(upload(ROLLOUT, "turn-id", tracingClient)).rejects.toThrow("synthetic crash");
  append.mockRestore();
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map());
  const storedRuns = [...deliveryServer.runs.values()];
  expect(storedRuns.length).toBeGreaterThan(0);

  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "uploaded"]]));
  expect(deliveryServer.projectReads.length).toBeGreaterThan(0);
  expect(new Set(deliveryServer.projectReads)).toEqual(new Set([PROJECT_NAME]));
  for (const attempts of deliveryServer.runAttempts.values()) {
    expect(attempts).toHaveLength(2);
    expect(attempts[0].id).toBe(attempts[1].id);
    expect(attempts[0].trace_id).toBe(attempts[1].trace_id);
    expect(attempts[0].dotted_order).toBe(attempts[1].dotted_order);
    expect(epochMilliseconds(attempts[0].start_time)).toBe(
      epochMilliseconds(attempts[1].start_time),
    );
    expect(epochMilliseconds(attempts[0].end_time)).toBe(epochMilliseconds(attempts[1].end_time));
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
  deliveryServer = await startDeliveryServer();
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
    [...deliveryServer.runAttempts].map(([id, attempts]) => [id, attempts[0]]),
  );
  expect(firstChildRuns.size).toBeGreaterThan(1);

  await upload(parentFile, PARENT_TURN, tracingClient, SESSIONS_ROOT);

  expect(await loadTurnStates(childFile)).toEqual(new Map([[CHILD_TURN, "uploaded"]]));
  expect(await loadTurnStates(parentFile)).toEqual(new Map([[PARENT_TURN, "uploaded"]]));
  expectTopologyRetries(firstChildRuns);
});

it("keeps nested child topology when the child retries after a lost parent acknowledgement", async () => {
  deliveryServer = await startDeliveryServer();
  const { parentFile, childFile } = await writeSubagentRollouts();
  const tracingClient = client();

  await upload(parentFile, PARENT_TURN, tracingClient, SESSIONS_ROOT);
  const firstChildRuns = subagentRuns(CHILD_THREAD);
  expect(firstChildRuns.size).toBeGreaterThan(1);
  await fs.unlink(`${childFile}.langsmith`);

  await upload(childFile, CHILD_TURN, tracingClient, SESSIONS_ROOT);

  expect(await loadTurnStates(childFile)).toEqual(new Map([[CHILD_TURN, "uploaded"]]));
  expectTopologyRetries(firstChildRuns);
});

it("keeps muted nested child order when the child retries after a lost acknowledgement", async () => {
  deliveryServer = await startDeliveryServer();
  const { parentFile, childFile } = await writeSubagentRollouts();
  await submitPreference(PRIVACY, PARENT_THREAD, "mute-command-turn", true, "mute");
  await submitPreference(PRIVACY, PARENT_THREAD, PARENT_TURN, true);
  const tracingClient = client();

  await upload(parentFile, PARENT_TURN, tracingClient, SESSIONS_ROOT);
  const firstChildRuns = subagentRuns(CHILD_THREAD);
  expect(firstChildRuns.size).toBeGreaterThan(1);
  for (const first of firstChildRuns.values()) {
    expect(first.extra).toMatchObject({ metadata: { ls_tracing_mode: "metadata" } });
  }
  await fs.unlink(`${childFile}.langsmith`);

  await upload(childFile, CHILD_TURN, tracingClient, SESSIONS_ROOT);

  expectTopologyRetries(firstChildRuns);
  for (const id of firstChildRuns.keys()) {
    const attempts = deliveryServer.runAttempts.get(id)!;
    expect(attempts[1].extra).toMatchObject({ metadata: { ls_tracing_mode: "metadata" } });
  }
});

it("rejects a conflict when the stored run belongs to another project", async () => {
  deliveryServer = await startDeliveryServer();
  await writeRollout();
  const tracingClient = client();
  await upload(ROLLOUT, "turn-id", tracingClient);
  const retryFile = "/workspace/repo/second-rollout.jsonl";
  await writeRollout(retryFile);
  const firstRun = deliveryServer.runs.values().next().value as Record<string, unknown>;
  firstRun.session_id = "00000000-0000-0000-0000-000000000002";

  await expect(upload(retryFile, "turn-id", tracingClient)).rejects.toThrow();
  expect(await loadTurnStates(retryFile)).toEqual(new Map());
});

it("keeps muted turns skipped after the preference changes", async () => {
  deliveryServer = await startDeliveryServer();
  await writeRollout();
  await submitPreference(PRIVACY, "thread-id", "turn-id", false);
  const tracingClient = client();

  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(await loadTurnStates(ROLLOUT)).toEqual(new Map([["turn-id", "off"]]));
  expect(deliveryServer.runAttempts.size).toBe(0);

  await submitPreference(PRIVACY, "thread-id", "turn-id", true, "unmute");
  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(deliveryServer.runAttempts.size).toBe(0);
});
