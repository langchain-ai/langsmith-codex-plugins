import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { convertToRunTree } from "../src/trace.js";
import { savedTurnMode, submitPreference } from "../src/tracing-policy.js";
import { MUTED_TRACE_CONTENT } from "../src/privacy.js";
import { mockClient } from "./utils/mock_client.js";

let dir: string;
let privacyPath: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-lifecycle-"));
  privacyPath = path.join(dir, "privacy.json");
  for (const key of Object.keys(process.env))
    if (/^(LANGCHAIN_|LANGSMITH_)/.test(key)) vi.stubEnv(key, undefined);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});
const event = (type: string, payload: Record<string, unknown>) => ({
  timestamp: "2026-04-23T00:00:01.000Z",
  type,
  payload,
});
function turn(id: string, text: string, child?: string) {
  return [
    event("event_msg", { type: "task_started", turn_id: id }),
    event("turn_context", {
      turn_id: id,
      model: "test-model",
      cwd: "PRIVATE_CWD",
      ls_subagent_type: "PRIVATE_CONTEXT_COLLISION",
    }),
    event("response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    }),
    event("response_item", {
      type: "function_call",
      name: "spawn_agent",
      arguments: JSON.stringify({ prompt: text }),
      call_id: `call-${id}`,
    }),
    event("response_item", {
      type: "function_call_output",
      call_id: `call-${id}`,
      output: JSON.stringify({ agent_id: child, text }),
    }),
    event("response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    }),
    event("event_msg", { type: "turn_complete", turn_id: id, error: `PRIVATE_ERROR-${text}` }),
  ];
}
async function rollout(
  id: string,
  turns: ReturnType<typeof turn>,
  parent?: string,
  canonical = false,
) {
  const file = path.join(dir, `rollout-${id}.jsonl`);
  const source = parent ? { subagent: { thread_spawn: { parent_thread_id: parent } } } : "cli";
  await fs.writeFile(
    file,
    [
      event("session_meta", {
        id,
        source: canonical ? "cli" : source,
        ...(canonical ? { thread_source: "subagent", parent_thread_id: parent } : {}),
        base_instructions: { text: "PRIVATE_SYSTEM" },
        cwd: "PRIVATE_CWD",
        model_provider: "test-provider",
        cli_version: "0.153.4",
      }),
      ...turns,
    ]
      .map((line) => JSON.stringify(line))
      .join("\n"),
  );
  return file;
}
async function upload(file: string, turnId: string) {
  const { client, callSpy } = mockClient();
  await convertToRunTree(
    { transcript_path: file, turn_id: turnId },
    {
      client,
      privacyPath,
      sessionsRoot: dir,
      metadata: { ls_tool_name: "PRIVATE_CUSTOM_COLLISION", custom: "PRIVATE_CUSTOM" },
    },
  );
  return callSpy.mock.calls.map((call: any) =>
    JSON.parse(
      typeof call[1].body === "string" ? call[1].body : new TextDecoder().decode(call[1].body),
    ),
  );
}
function expectMuted(runs: any[]) {
  expect(runs.length).toBeGreaterThan(0);
  for (const run of runs) {
    expect(run.inputs).toEqual({ messages: [{ role: "user", content: MUTED_TRACE_CONTENT }] });
    expect(run.outputs).toEqual({
      messages: [{ role: "assistant", content: MUTED_TRACE_CONTENT }],
    });
    expect(run.extra.metadata.ls_tracing_mode).toBe("metadata");
    expect(JSON.stringify(run)).not.toContain("PRIVATE_");
    expect(run.error).toBeUndefined();
  }
}
it("whole-rollout Stop and replay never upgrade older muted turns on unmute", async () => {
  await submitPreference(privacyPath, "root", "control", true, "mute");
  await submitPreference(privacyPath, "root", "private", true);
  await submitPreference(privacyPath, "root", "control2", true, "unmute");
  await submitPreference(privacyPath, "root", "future", true);
  const file = await rollout("root", [
    ...turn("private", "PRIVATE_OLD"),
    ...turn("future", "PUBLIC_FUTURE"),
  ]);
  const runs = await upload(file, "future");
  expectMuted(runs.filter((run: any) => run.extra.metadata.turn_id === "private"));
  expect(
    runs
      .filter((run: any) => run.extra.metadata.turn_id === "future")
      .some((run: any) => JSON.stringify(run).includes("PUBLIC_FUTURE")),
  ).toBe(true);
  expect(await upload(file, "future")).toEqual([]);
  await fs.unlink(`${file}.langsmith`);
  const replay = await upload(file, "future");
  expectMuted(replay.filter((run: any) => run.extra.metadata.turn_id === "private"));
});
it.each([false, true])(
  "recursive and direct descendants inherit launch mode, canonical=%s",
  async (canonical) => {
    await submitPreference(privacyPath, "root", "control", true, "mute");
    await submitPreference(privacyPath, "root", "launch", true);
    await submitPreference(privacyPath, "root", "control2", true, "unmute");
    await submitPreference(privacyPath, "root", "next", true);
    const root = await rollout("root", turn("launch", "PRIVATE_ROOT", "child"));
    const child = await rollout(
      "child",
      turn("child-turn", "PRIVATE_CHILD", "grandchild"),
      "root",
      canonical,
    );
    const grandchild = await rollout(
      "grandchild",
      turn("grand-turn", "PRIVATE_GRANDCHILD"),
      "child",
      canonical,
    );
    // Direct Stop can beat the parent's Stop; walk native ancestry to the launch.
    expectMuted(await upload(grandchild, "grand-turn"));
    expect(savedTurnMode(privacyPath, "grandchild", "grand-turn")).toBe("metadata");
    await fs.unlink(`${grandchild}.langsmith`);
    const recursive = await upload(root, "launch");
    expectMuted(recursive);
    expect(recursive.filter((run: any) => run.run_type === "chain")).toHaveLength(3);
    expect(await upload(child, "child-turn")).toEqual([]);
  },
);
it("full launch stays full for direct descendants even after parent mute", async () => {
  await submitPreference(privacyPath, "root", "launch", true);
  await submitPreference(privacyPath, "root", "launch", true, "mute");
  await rollout("root", turn("launch", "PUBLIC_ROOT", "child"));
  const child = await rollout("child", turn("child-turn", "PUBLIC_CHILD"), "root");
  expect(
    (await upload(child, "child-turn")).some((run: any) =>
      JSON.stringify(run).includes("PUBLIC_CHILD"),
    ),
  ).toBe(true);
});
it("off launch uploads nothing, including direct descendants after enabling", async () => {
  await submitPreference(privacyPath, "root", "launch", false);
  const root = await rollout("root", turn("launch", "PRIVATE_OFF", "child"));
  const child = await rollout("child", turn("child-turn", "PRIVATE_CHILD"), "root");
  expect(await upload(child, "child-turn")).toEqual([]);
  expect(await upload(root, "launch")).toEqual([]);
});
it("no evidence, corrupt policy, or unknown child ancestry is metadata-only", async () => {
  const root = await rollout("root", turn("old", "PRIVATE_OLD"));
  expectMuted(await upload(root, "old"));
  await fs.writeFile(privacyPath, "broken");
  await fs.unlink(`${root}.langsmith`);
  expectMuted(await upload(root, "old"));
  const child = await rollout("child", turn("child-turn", "PRIVATE_ORPHAN"), "missing-parent");
  expectMuted(await upload(child, "child-turn"));
});

it("missing native task_started never borrows full evidence from the Stop turn", async () => {
  await submitPreference(privacyPath, "root", "current", true);
  const file = await rollout("root", turn("historical", "PRIVATE_HISTORY").slice(1));
  expectMuted(await upload(file, "current"));
});
it("an inherited launch snapshot survives missing ancestry and child controls", async () => {
  await submitPreference(privacyPath, "root", "launch", true);
  const root = await rollout("root", turn("launch", "PUBLIC_ROOT", "child"));
  const child = await rollout("child", turn("child-turn", "PUBLIC_CHILD"), "root");
  await upload(child, "child-turn");
  await fs.unlink(root);
  await fs.unlink(`${child}.langsmith`);
  await submitPreference(privacyPath, "child", "child-turn", true, "mute");
  expect(
    (await upload(child, "child-turn")).some((run: any) =>
      JSON.stringify(run).includes("PUBLIC_CHILD"),
    ),
  ).toBe(true);
});
