import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Client } from "langsmith";
import { trackIncrementalDelivery } from "../src/incremental-delivery.js";
import type { LocalTraceServer } from "./models/incremental-trace.js";
import { createIncrementalTraceServer } from "./incremental-trace-server.js";

let local: LocalTraceServer;
let temporaryDirectory: string;
let rolloutFile: string;
let client: Client;
let errors: unknown[];

function tracedClient(finalize = true) {
  const client = new Client({
    apiUrl: local.apiUrl,
    apiKey: "local-test-key",
    autoBatchTracing: false,
    hideInputs: false,
    hideOutputs: false,
    hideMetadata: false,
  });
  return trackIncrementalDelivery(client, errors, rolloutFile, "turn-key", finalize);
}

function runConfig(overrides: Record<string, unknown> = {}) {
  const id = String(overrides.id ?? randomUUID());
  return {
    id,
    name: "exec",
    run_type: "tool",
    project_name: "incremental-test",
    inputs: { command: "echo ready" },
    start_time: 1_700_000_000_123,
    parent_run_id: randomUUID(),
    trace_id: randomUUID(),
    dotted_order: `1700000000123.${id}`,
    extra: { metadata: { repository_url: "https://example.test/root" } },
    ...overrides,
  } as Parameters<Client["createRun"]>[0];
}

async function checkpointPath() {
  const name = (await fs.readdir(temporaryDirectory)).find((entry) => entry.endsWith(".json"));
  if (!name) throw new Error("Incremental delivery checkpoint was not written");
  return path.join(temporaryDirectory, name);
}

beforeEach(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "incremental-delivery-"));
  rolloutFile = path.join(
    temporaryDirectory,
    "rollout-2026-10-08T10-45-47-5a845dc8-6cc9-4d50-84a2-ceab5b50d19d.jsonl",
  );
  local = await createIncrementalTraceServer();
  errors = [];
  client = tracedClient();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await local.close();
  for (const entry of await fs.readdir(temporaryDirectory)) {
    const entryPath = path.join(temporaryDirectory, entry);
    const stat = await fs.stat(entryPath);
    if (stat.isDirectory()) await fs.rmdir(entryPath);
    else await fs.unlink(entryPath);
  }
  await fs.rmdir(temporaryDirectory);
});

it("posts a partial run then patches the same id with its original topology", async () => {
  const partial = runConfig();
  await client.createRun(partial);
  await client.createRun(partial);
  await client.createRun({
    ...partial,
    name: "exec_command",
    start_time: Number(partial.start_time) + 9000,
    dotted_order: "late-stop-order",
    parent_run_id: randomUUID(),
    outputs: { stdout: "ready" },
    end_time: Number(partial.start_time) + 12000,
  });
  const writes = local.requestsFor();
  expect(writes.map((request) => request.method)).toEqual(["POST", "PATCH"]);
  expect(writes[1].pathname).toBe(`/runs/${partial.id}`);
  expect(local.runs.get(String(partial.id))).toMatchObject({
    id: partial.id,
    name: partial.name,
    run_type: partial.run_type,
    start_time: partial.start_time,
    parent_run_id: partial.parent_run_id,
    trace_id: partial.trace_id,
    dotted_order: partial.dotted_order,
    outputs: { stdout: "ready" },
  });
});

it("retries a failed create with its saved parent and ordering", async () => {
  const initial = runConfig();
  local.failNextPost = true;
  await expect(client.createRun(initial)).rejects.toThrow();
  await client.createRun({
    ...initial,
    parent_run_id: randomUUID(),
    trace_id: randomUUID(),
    dotted_order: "different-order",
    start_time: Number(initial.start_time) + 1000,
  });
  expect(local.runs.size).toBe(1);
  expect(local.runs.get(String(initial.id))).toMatchObject({
    parent_run_id: initial.parent_run_id,
    trace_id: initial.trace_id,
    dotted_order: initial.dotted_order,
    start_time: initial.start_time,
  });
}, 15_000);

it.each([false, true])("waits until Stop to patch a partial run (existing: %s)", async (seeded) => {
  const partial = runConfig({ outputs: { stdout: "ready" } });
  if (seeded) local.seedRun({ ...partial }, String(partial.project_name));
  const partialClient = tracedClient(false);
  local.failNextPatch = true;
  await partialClient.createRun(partial);
  await partialClient.createRun({ ...partial, inputs: { command: "echo still running" } });
  expect(local.requestsFor("PATCH")).toHaveLength(0);
  local.failNextPatch = false;

  await client.createRun({
    ...partial,
    outputs: { stdout: "completed" },
    end_time: Number(partial.start_time) + 12000,
  });
  expect(local.requestsFor().map((request) => request.method)).toEqual(["POST", "PATCH"]);
  expect(local.runs.get(String(partial.id))?.outputs).toEqual({ stdout: "completed" });
});

it("keeps large metadata and completion time off a partial create", async () => {
  const configuredValue = `configured-${"c".repeat(4096)}`;
  const environmentValue = `environment-${"e".repeat(4096)}`;
  const environmentMetadata = { environment_large_metadata: environmentValue };
  vi.stubEnv("LANGSMITH_CODEX_METADATA", JSON.stringify(environmentMetadata));
  const configuredMetadata = {
    thread_id: "thread-1",
    turn_id: "turn-1",
    ls_trace_schema_version: "coding-agent-v1",
    ls_integration: "openai-codex",
    ls_agent_type: "root",
    ls_tracing_mode: "full",
    configured_large_metadata: configuredValue,
    ...environmentMetadata,
  };
  const partialClient = tracedClient(false);
  const partial = runConfig({
    extra: { metadata: configuredMetadata },
    outputs: { stdout: "ready" },
    end_time: 1_700_000_002_000,
  });
  await partialClient.createRun(partial);

  const post = local.requestsFor("POST")[0];
  expect(post?.body?.outputs).toEqual({ stdout: "ready" });
  expect(post?.body).not.toHaveProperty("end_time");
  expect(post?.body?.extra).not.toHaveProperty("metadata.configured_large_metadata");
  expect(post?.body?.extra).not.toHaveProperty("metadata.environment_large_metadata");
  expect(JSON.stringify(post?.body)).not.toContain(configuredValue);
  expect(JSON.stringify(post?.body)).not.toContain(environmentValue);
  expect(JSON.stringify(post?.body)).not.toContain("LANGSMITH_CODEX_METADATA");

  const finalClient = tracedClient();
  const endTime = 1_700_000_004_000;
  await finalClient.createRun({ ...partial, end_time: endTime });

  const patch = local.requestsFor("PATCH")[0];
  expect(patch?.body?.end_time).toBe(endTime);
  expect(patch?.body?.extra).toMatchObject({ metadata: configuredMetadata });
});

it.each([
  {
    name: "a successful patch becomes visible",
    fault: { staleNextSuccessfulPatchReads: 1 },
    partial: false,
  },
  { name: "a conflicting patch is verified", fault: { loseNextPatchAck: true }, partial: true },
])("acknowledges final metadata only after $name", async ({ fault, partial }) => {
  const initialClient = tracedClient(!partial);
  const initial = runConfig({ extra: { metadata: { status: "running" } } });
  await initialClient.createRun(initial);
  Object.assign(local, fault);
  const finalRun = {
    ...initial,
    extra: { metadata: { status: "completed" } },
    outputs: { result: "done" },
    end_time: Number(initial.start_time) + 12000,
  };
  await client.createRun(finalRun);
  expect(local.requestsFor("GET", `/runs/${initial.id}`)).toHaveLength(3);
  expect(local.runs.get(String(initial.id))?.extra).toMatchObject({
    metadata: { status: "completed" },
  });
  await client.createRun(finalRun);
  expect(local.requestsFor("PATCH")).toHaveLength(1);
});

it("retries a run lookup while the newly created run is not indexed", async () => {
  const partialClient = tracedClient(false);
  const partial = runConfig();
  await partialClient.createRun(partial);
  local.hideRunReads(String(partial.id), 2);

  const finalClient = tracedClient();
  await finalClient.createRun({
    ...partial,
    outputs: { indexed: true },
    end_time: Number(partial.start_time) + 12000,
  });
  expect(
    local.requests
      .slice(
        0,
        local.requests.findIndex((request) => request.method === "PATCH"),
      )
      .filter((request) => request.method === "GET" && request.pathname === `/runs/${partial.id}`),
  ).toHaveLength(3);
  expect(local.runs.get(String(partial.id))?.outputs).toEqual({ indexed: true });
});

it("leaves a failed patch unacknowledged so the same payload retries", async () => {
  const partial = runConfig();
  await client.createRun(partial);
  const finalRun = { ...partial, outputs: { answer: 42 }, end_time: 1_700_000_004_000 };
  local.failNextPatch = true;
  await expect(client.createRun(finalRun)).rejects.toThrow();
  await client.createRun(finalRun);
  expect(local.requestsFor("PATCH")).toHaveLength(2);
  expect(errors).toHaveLength(1);
});

it("recovers a duplicate create by validating the stored run and sending a patch", async () => {
  const initial = runConfig({ outputs: { partial: true } });
  const runId = String(initial.id);
  local.seedRun({ ...initial }, String(initial.project_name));
  await client.createRun({ ...initial, outputs: { final: true }, end_time: 1_700_000_004_000 });
  expect(local.requestsFor().map((request) => request.method)).toEqual(["POST", "PATCH"]);
  expect(local.requestsFor("GET", `/runs/${runId}`).length).toBeGreaterThan(0);
  expect(local.requestsFor("GET", "/sessions").length).toBeGreaterThan(0);
  expect(local.runs.get(runId)?.outputs).toEqual({ final: true });
});

it.each(["parent_run_id", "session_id"])(
  "rejects a conflicting run with a different %s",
  async (field) => {
    const proposed = runConfig();
    const existing = local.seedRun({ ...proposed }, String(proposed.project_name));
    existing[field] = randomUUID();
    await expect(client.createRun(proposed)).rejects.toThrow("Could not verify the existing run");
    expect(local.requestsFor("PATCH")).toHaveLength(0);
    expect(errors).toHaveLength(1);
  },
);

it("fails closed when its checkpoint is corrupt", async () => {
  const partial = runConfig();
  await client.createRun(partial);
  const checkpointFile = await checkpointPath();
  await fs.writeFile(checkpointFile, "{");
  await expect(client.createRun({ ...partial, outputs: { done: true } })).rejects.toThrow(
    "Incremental delivery checkpoint is corrupt",
  );
  expect(local.requestsFor("PATCH")).toHaveLength(0);
  expect(errors).toHaveLength(1);
  expect(await fs.readFile(checkpointFile, "utf8")).toBe("{");
});

function privateExtra(metadata: Record<string, unknown>) {
  return {
    metadata: { private_value: "must not reach the wire" },
    toJSON: () => ({ metadata: { ...metadata, ls_tracing_mode: "metadata" } }),
  };
}

it("keeps privacy output and unrelated root metadata through a final patch", async () => {
  const initial = runConfig({
    parent_run_id: randomUUID(),
    run_type: "chain",
    extra: privateExtra({ repository_url: "[masked]", status: "running" }),
  });
  await client.createRun(initial);
  const finalRun = {
    ...initial,
    outputs: { text: "done" },
    end_time: 1_700_000_004_000,
    extra: privateExtra({ repository_url: "[masked-final]", status: "completed" }),
  };
  await client.createRun(finalRun as Parameters<Client["createRun"]>[0]);
  const patch = local.requestsFor("PATCH")[0];
  expect(patch?.body?.extra).toMatchObject({
    metadata: {
      repository_url: "[masked-final]",
      status: "completed",
      ls_tracing_mode: "metadata",
    },
  });
  expect(patch?.body?.extra).not.toHaveProperty("metadata.preserved");
  expect(JSON.stringify(patch?.body)).not.toContain("must not reach the wire");
  const checkpointFile = await checkpointPath();
  const checkpoint = await fs.readFile(checkpointFile, "utf8");
  expect(JSON.parse(checkpoint).recovery.metadata).toEqual({
    ls_tracing_mode: "metadata",
  });
  expect(checkpoint).not.toContain("outputs");
  expect(checkpoint).not.toContain("must not reach the wire");
  expect((await fs.stat(checkpointFile)).mode & 0o777).toBe(0o600);
});

it("lets a tool replace inherited repository metadata with its own repository", async () => {
  const initial = runConfig({
    extra: { metadata: { repository_url: "https://example.test/root", custom_field: "keep" } },
  });
  await client.createRun(initial);
  await client.createRun({
    ...initial,
    extra: { metadata: { repository_url: "https://example.test/tool" } },
    outputs: { result: "done" },
  });
  const patch = local.requestsFor("PATCH")[0];
  expect(patch?.body?.extra).toMatchObject({
    metadata: { repository_url: "https://example.test/tool", custom_field: "keep" },
  });
});

it("does not restore server-only metadata during a muted-run patch", async () => {
  const proposed = runConfig({
    run_type: "chain",
    extra: privateExtra({ status: "completed" }),
  });
  local.seedRun(
    {
      ...proposed,
      extra: { metadata: { server_only_secret: "never restore this" } },
    } as unknown as Record<string, unknown>,
    String(proposed.project_name),
  );
  await client.createRun({ ...proposed, end_time: 1_700_000_004_000 });
  const patch = local.requestsFor("PATCH")[0];
  expect(JSON.stringify(patch?.body)).not.toContain("never restore this");
  expect(patch?.body?.extra).toMatchObject({
    metadata: { status: "completed", ls_tracing_mode: "metadata" },
  });
});

it.each([
  {
    identity: "workspace IDs",
    first: { apiKey: "replica-a-key", workspaceId: "workspace-a" },
    second: { apiKey: "replica-b-key", workspaceId: "workspace-b" },
  },
  {
    identity: "credential hashes",
    first: { apiKey: "replica-a-key" },
    second: { apiKey: "replica-b-key" },
  },
])("keeps replica checkpoints separate by $identity", async ({ first, second }) => {
  const firstClient = new Client({ ...first, apiUrl: local.apiUrl, autoBatchTracing: false });
  const secondClient = new Client({ ...second, apiUrl: local.apiUrl, autoBatchTracing: false });
  const firstCreate = vi.spyOn(firstClient, "createRun").mockResolvedValue(undefined);
  const secondCreate = vi.spyOn(secondClient, "createRun").mockResolvedValue(undefined);
  const firstReplica = trackIncrementalDelivery(firstClient, [], rolloutFile, "replica-turn");
  const secondReplica = trackIncrementalDelivery(secondClient, [], rolloutFile, "replica-turn");
  const run = runConfig({ id: "replica-shared-run" });

  await firstReplica.createRun(run);
  await secondReplica.createRun(run);

  expect(firstCreate).toHaveBeenCalledOnce();
  expect(secondCreate).toHaveBeenCalledOnce();
  const checkpointFiles = (await fs.readdir(temporaryDirectory)).filter((entry) =>
    entry.endsWith(".json"),
  );
  expect(checkpointFiles).toHaveLength(2);
  const checkpoints = await Promise.all(
    checkpointFiles.map((entry) => fs.readFile(path.join(temporaryDirectory, entry), "utf8")),
  );
  expect(checkpoints.join("\n")).not.toContain(first.apiKey);
  expect(checkpoints.join("\n")).not.toContain(second.apiKey);
});
