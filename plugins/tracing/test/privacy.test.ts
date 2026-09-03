import * as path from "node:path";
import { vol } from "memfs";
import { beforeEach, expect, it, vi } from "vitest";
import { RunTree } from "langsmith";
import { setThreadMode } from "../src/state.js";
import { convertToRunTree } from "../src/trace.js";
import { mockClient } from "./utils/mock_client.js";
import { getAssumedTreeFromCalls } from "./utils/tree.js";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});
vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

const HOME = "/home/codex-user";
const THREAD = "private-thread";
const TURN = "private-turn";
const FILE = path.join(HOME, ".codex/sessions/rollout-private-thread.jsonl");
const ts = "2026-06-01T12:00:00.000Z";
const line = (type: string, payload: Record<string, unknown>) =>
  JSON.stringify({ timestamp: ts, type, payload });

beforeEach(() => {
  vol.reset();
  vi.stubEnv("HOME", HOME);
});

it("serializes metadata runs with empty I/O and a strict safe allowlist", async () => {
  vol.fromJSON({
    [FILE]: [
      line("session_meta", {
        id: THREAD,
        cwd: "/secret/repo",
        cli_version: "1.0",
        source: "cli",
        model_provider: "secret-provider",
        base_instructions: { text: "secret system" },
      }),
      line("event_msg", { type: "task_started", turn_id: TURN }),
      line("turn_context", {
        model: "gpt-safe",
        cwd: "/secret/repo",
        user_instructions: "secret custom",
        task: "secret task",
      }),
      line("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "secret user" }],
      }),
      line("response_item", {
        type: "function_call",
        name: "exec_command",
        call_id: "call-1",
        arguments: JSON.stringify({ cmd: "secret command" }),
      }),
      line("response_item", {
        type: "function_call_output",
        call_id: "call-1",
        output: "secret result",
      }),
      line("event_msg", { type: "task_complete", turn_id: TURN, error: "secret error" }),
    ].join("\n"),
  });
  setThreadMode(THREAD, "metadata", HOME);
  const { client, callSpy } = mockClient();
  await convertToRunTree({ transcript_path: FILE, turn_id: TURN }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const serialized = JSON.stringify(tree);
  for (const secret of [
    "/secret/repo",
    "secret-provider",
    "secret system",
    "secret custom",
    "secret task",
    "secret user",
    "secret command",
    "secret result",
    "secret error",
  ]) {
    expect(serialized).not.toContain(secret);
  }
  for (const run of Object.values(tree.data)) {
    expect(run.inputs).toEqual({});
    expect(run.outputs).toEqual({});
    expect(run.error).toBeUndefined();
    expect(run.extra?.metadata?.ls_tracing_mode).toBe("metadata");
  }
});

it("preserves distributed baggage in full mode", async () => {
  vol.fromJSON({
    [FILE]: [
      line("session_meta", { id: THREAD, source: "cli" }),
      line("event_msg", { type: "task_started", turn_id: TURN }),
      line("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "user" }],
      }),
      line("event_msg", { type: "task_complete", turn_id: TURN }),
    ].join("\n"),
  });
  const { client, callSpy } = mockClient();
  const parentRunTree = RunTree.fromHeaders(
    {
      "langsmith-trace": "20260601T120000000000Z11111111-1111-4111-8111-111111111111",
      baggage: "langsmith-metadata=%7B%22preserved%22%3A%22baggage-value%22%7D",
    },
    { client },
  );
  await convertToRunTree(
    { transcript_path: FILE, turn_id: TURN },
    { client, parentRunTree, turnMode: "full" },
  );
  expect(
    callSpy.mock.calls
      .map((call: unknown[]) =>
        new TextDecoder().decode((call.at(-1) as RequestInit).body as Uint8Array),
      )
      .join("\n"),
  ).toContain("baggage-value");
});

it("does not serialize parent baggage metadata or replica updates in metadata mode", async () => {
  vol.fromJSON({
    [FILE]: [
      line("session_meta", { id: THREAD, source: "cli" }),
      line("event_msg", { type: "task_started", turn_id: TURN }),
      line("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "secret user" }],
      }),
      line("event_msg", { type: "task_complete", turn_id: TURN }),
    ].join("\n"),
  });
  setThreadMode(THREAD, "metadata", HOME);
  const { client, callSpy } = mockClient({ apiUrl: "https://master.example" });
  const parentRunTree = RunTree.fromHeaders(
    {
      "langsmith-trace": "20260601T120000000000Z11111111-1111-4111-8111-111111111111",
      baggage:
        "langsmith-metadata=%7B%22hostile%22%3A%22parent-secret%22%7D,langsmith-tags=secret-tag,langsmith-project=secret-project",
    },
    { client },
  );
  await convertToRunTree(
    { transcript_path: FILE, turn_id: TURN },
    {
      client,
      parentRunTree,
      replicas: [
        {
          apiUrl: "https://replica.invalid",
          apiKey: "replica-key",
          projectName: "safe-project",
          updates: { metadata: { hostile: "replica-secret" }, inputs: { secret: true } },
        },
      ],
    },
  );
  const bodies = callSpy.mock.calls.map((call: unknown[]) =>
    String((call.at(-1) as RequestInit).body),
  );
  const serialized = bodies.join("\n");
  const requests: { url: string; headers: Headers; init: RequestInit }[] = callSpy.mock.calls.map(
    (call: unknown[]) => ({
      url:
        call[0] != null && typeof call[0] === "object" && "url" in call[0]
          ? String(call[0].url)
          : String(call[0]),
      headers: new Headers([
        ...(call[0] != null && typeof call[0] === "object" && "headers" in call[0]
          ? (call[0].headers as Headers).entries()
          : []),
        ...new Headers((call.at(-1) as RequestInit).headers).entries(),
      ]),
      init: call.at(-1) as RequestInit,
    }),
  );
  const replicaRequests = requests.filter(({ url }) => url.startsWith("https://replica.invalid/"));
  expect(replicaRequests.length).toBeGreaterThan(0);
  for (const { headers, init } of replicaRequests) {
    expect(headers.get("x-api-key")).toBe("replica-key");
    expect(new TextDecoder().decode(init.body as Uint8Array)).toContain("safe-project");
  }
  expect(serialized).not.toContain("parent-secret");
  expect(serialized).not.toContain("secret-tag");
  expect(serialized).not.toContain("secret-project");
  expect(serialized).not.toContain("replica-secret");
  expect(serialized).not.toContain('"secret":true');
  expect(serialized).toContain([...new TextEncoder().encode(TURN)].join(","));
});
