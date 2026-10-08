import { createServer } from "node:http";
import * as fs from "node:fs/promises";
import { Client } from "langsmith";
import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { loadTurnStates } from "../src/trace-delivery-store.js";
import { submitPreference } from "../src/tracing-policy.js";
import type { RolloutEventsOptions } from "./models/trace-delivery.js";

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
let deliveryServer: Awaited<ReturnType<typeof startDeliveryServer>> | undefined;

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

async function startDeliveryServer() {
  let failWrites = false;
  let delayMs = 0;
  const runs = new Map<string, Record<string, unknown>>();
  const requests = new Map<string, Record<string, unknown>[]>();
  const projectReads: string[] = [];
  const conflicts: string[] = [];
  const server = createServer(async (request, response) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/sessions") {
      const projectName = url.searchParams.get("name") ?? "default";
      projectReads.push(projectName);
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify([
          {
            id: projectName === PROJECT_NAME ? PROJECT_ID : DEFAULT_PROJECT_ID,
            name: projectName,
          },
        ]),
      );
      return;
    }
    if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
      const run = runs.get(url.pathname.slice("/runs/".length));
      response.statusCode = run ? 200 : 404;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(run ?? { detail: "missing" }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/runs") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const run = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      const id = String(run.id);
      const projectName =
        typeof run.session_name === "string"
          ? run.session_name
          : typeof run.project_name === "string"
            ? run.project_name
            : "default";
      const attempts = requests.get(id) ?? [];
      attempts.push(run);
      requests.set(id, attempts);
      if (failWrites) {
        response.statusCode = 400;
        response.end("synthetic failure");
      } else if (runs.has(id)) {
        conflicts.push(id);
        response.statusCode = 409;
        response.end("duplicate run");
      } else {
        runs.set(id, {
          ...run,
          session_id: projectName === PROJECT_NAME ? PROJECT_ID : DEFAULT_PROJECT_ID,
        });
        response.statusCode = 202;
        response.end();
      }
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local test address");
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    runs,
    requests,
    projectReads,
    conflicts,
    setFailWrites(value: boolean) {
      failWrites = value;
    },
    setDelayMs(value: number) {
      delayMs = value;
    },
  };
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

function epochMilliseconds(value: unknown) {
  return new Date(value as string | number).getTime();
}

function client() {
  return new Client({
    apiUrl: deliveryServer!.url,
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
    await new Promise<void>((resolve, reject) =>
      deliveryServer!.server.close((error) => (error ? reject(error) : resolve())),
    );
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
  for (const attempts of deliveryServer.requests.values()) {
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
  expect(deliveryServer.requests.size).toBe(0);

  await submitPreference(PRIVACY, "thread-id", "turn-id", true, "unmute");
  await upload(ROLLOUT, "turn-id", tracingClient);
  expect(deliveryServer.requests.size).toBe(0);
});
