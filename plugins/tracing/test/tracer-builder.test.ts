import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookNote, RunPatch, RunPost, TracingMode } from "@langchain/plugins-base/tracer";
import { beforeEach, expect, it, vi } from "vitest";
import {
  HELD_TURN_MESSAGES_MAX_BYTES,
  STUBBED_TOOL_OUTPUT_NOTE,
  STUBBED_TURN_MESSAGE_NOTE,
} from "../src/constants.js";
import type { BuilderState } from "../src/models/trace-conversion.js";
import { convertToRunTree } from "../src/trace.js";
import { createCodexTranscriptBuilder } from "../src/tracer-builder.js";
import { runIdGenerator, toolRunIdGenerator } from "../src/tracing-engine-payload.js";
import { defaultPrivacyPath, inheritedTurnMode, submitPreference } from "../src/tracing-policy.js";
import { ids, read } from "./utils/live-wire.js";
import { rolloutText } from "./utils/rollout.js";

const SESSIONS = new URL("sessions/2026/04/23/", import.meta.url).pathname;
const ROLLOUT = join(SESSIONS, "rollout-editing.jsonl");
const SUBAGENTS = join(SESSIONS, "rollout-subagents.jsonl");
const editing = await read("04/23/rollout-editing.jsonl");
const subagents = await read("04/23/rollout-subagents.jsonl");
const [session, turn] = ids(editing);
const VLR = "call_VLRlIzWNfD2jSDW47dX5eEMz";
const BIG_REPLY = "x".repeat(900 * 1024);
const [bigMeta, ...bigTurn] = rolloutText(session, ["t1"]).split("\n");
const bigReplies = Array.from({ length: 5 }, () =>
  JSON.stringify({
    timestamp: "2026-04-23T00:00:01.000Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: BIG_REPLY }],
    },
  }),
);
const bigRows = [bigMeta, ...bigTurn.slice(0, 4), ...bigReplies];

beforeEach(async () => {
  vi.stubEnv("HOME", await fs.mkdtemp(join(tmpdir(), "codex-builder-")));
});

function heldMessages(state: unknown) {
  return (state as BuilderState).walk?.task?.messages ?? [];
}

function expectOldestRepliesStubbed(state: unknown, stubbedReplies: number) {
  const held = heldMessages(state);
  const replyBytes = Buffer.byteLength(JSON.stringify(JSON.parse(bigReplies[0]).payload));
  expect(held.map(({ stubbed }) => stubbed ?? false)).toEqual(
    held.map((_, index) => index > 0 && index <= stubbedReplies + 1),
  );
  expect(held[0].message).toEqual(JSON.parse(bigTurn[2]).payload);
  expect(held[2].message).toEqual({
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: `${replyBytes} ${STUBBED_TURN_MESSAGE_NOTE}` }],
  });
  expect((state as BuilderState).heldMessageBytes).toBeLessThanOrEqual(
    HELD_TURN_MESSAGES_MAX_BYTES,
  );
}

function fakeBuilder(
  rows = editing,
  path = ROLLOUT,
  savedState?: unknown,
  tracingMode?: TracingMode,
) {
  const [sessionId, turnId] = ids(rows);
  const posts: RunPost[] = [];
  const patches: RunPatch[] = [];
  const sink = {
    post: (run: RunPost) => posts.push(run),
    patch: (run: RunPatch) => patches.push(run),
  };
  const builder = createCodexTranscriptBuilder({ sessionId, savedState, sink, tracingMode });
  const read = (...lines: string[]) =>
    lines.forEach((line) => builder.readLine(path, JSON.parse(line)));
  const note = (
    event: string,
    noteTurn = turnId,
    tracingMode?: TracingMode,
    toolUseId?: string,
  ) => {
    const hookNote: HookNote = {
      integration: "codex",
      event,
      sessionId,
      transcriptPath: path,
      ...(tracingMode === undefined ? {} : { tracingMode }),
      details: { turnId: noteTurn, toolUseId },
      writer: { destinations: [], redact: false },
    };
    builder.receiveNote(hookNote);
  };
  return { builder, posts, patches, read, note };
}

it("posts a finished turn and its subagents as the same runs today's Stop upload makes", async () => {
  const { posts, read, note } = fakeBuilder(subagents, SUBAGENTS);
  note("UserPromptSubmit");
  read(...subagents);
  note("Stop");

  const [sessionId, turnId] = ids(subagents);
  const expected: Pick<RunPost, "id" | "dotted_order" | "parent_run_id">[] = [];
  await convertToRunTree(
    { transcript_path: SUBAGENTS, turn_id: turnId },
    {
      captureRun: (run) => {
        const { parent_run_id } = run.toJSON();
        expected.push({ id: run.id, dotted_order: run.dotted_order, parent_run_id });
      },
      nextRunId: runIdGenerator(sessionId, turnId),
      toolRunId: toolRunIdGenerator(sessionId, turnId),
    },
  );
  expect(expected.length).toBeGreaterThan(20);
  const child = "019dbc03-79de-7d53-8196-3167d9a32762";
  await vi.waitFor(() => expect(inheritedTurnMode(defaultPrivacyPath(), child)).toBe("metadata"));
  expect(expected.filter(({ parent_run_id }) => parent_run_id).length).toBe(expected.length - 1);
  expect(
    posts.map(({ id, dotted_order, parent_run_id }) => ({ id, dotted_order, parent_run_id })),
  ).toEqual(expected);
});

it("skips turns that ended before the first note but keeps the turn that note names", () => {
  const { posts, read, note } = fakeBuilder();
  read(...rolloutText(session, ["old", "current"]).split("\n"));
  note("Stop", "current");

  expect(new Set(posts.map(({ trace_id }) => trace_id))).toEqual(
    new Set([runIdGenerator(session, "current")()]),
  );
});

it("skips turns read after the first note that ended before the turn it names", () => {
  const { posts, read, note } = fakeBuilder();
  note("UserPromptSubmit", "current");
  read(...rolloutText(session, ["old", "current"]).split("\n"));
  note("Stop", "current");

  expect(new Set(posts.map(({ trace_id }) => trace_id))).toEqual(
    new Set([runIdGenerator(session, "current")()]),
  );
});

it("posts later turns when the first noted turn never ends", () => {
  const { posts, read, note } = fakeBuilder();
  const [meta, ...rows] = rolloutText(session, ["t1", "t2"]).split("\n");
  const t2Start = rows.findIndex((row, index) => index > 0 && row.includes('"task_started"'));
  note("UserPromptSubmit", "t1");
  read(meta, ...rows.slice(0, 3));
  note("UserPromptSubmit", "t2");
  read(...rows.slice(t2Start));
  note("Stop", "t2");

  expect(posts.some(({ trace_id }) => trace_id === runIdGenerator(session, "t2")())).toBe(true);
});

it("names a turn with no start marker after the Stop that arrives once it ended", () => {
  const { posts, read, note } = fakeBuilder();
  const rows = rolloutText(session, ["t1"]).split("\n");
  const unmarked = rows.filter((row) => !row.includes('"task_started"'));
  const resumed = fakeBuilder();
  resumed.read(...unmarked);
  resumed.note("UserPromptSubmit", "t2");
  read(...unmarked);
  note("Stop", "t1");

  expect(resumed.posts).toEqual([]);

  expect(posts[0]).toMatchObject({
    id: runIdGenerator(session, "t1")(),
    metadata: { turnId: "t1" },
    start_time: "2026-04-23T00:00:01.000Z",
  });
});

it("closes a turn the rollout never ended on Stop, and its late lines change nothing", () => {
  const { posts, read, note } = fakeBuilder();
  const [meta, ...rows] = rolloutText(session, ["t1", "t2"]).split("\n");
  note("UserPromptSubmit", "t1");
  read(meta, ...rows.slice(0, 3));
  note("Stop", "t1");
  const posted = posts.length;
  read(...rows.slice(3, 5));
  expect(posted).toBeGreaterThan(0);
  expect(posts.length).toBe(posted);

  note("UserPromptSubmit", "t2");
  read(...rows.slice(5));
  const second = posts.find(({ id }) => id === runIdGenerator(session, "t2")());
  expect(second?.metadata.turnNumber).toBe(2);
});

it("reports a turn open until Stop closes it, and its late lines keep it closed", () => {
  const { builder, read, note } = fakeBuilder();
  const [meta, ...rows] = rolloutText(session, ["t1"]).split("\n");
  note("UserPromptSubmit", "t1");
  read(meta, ...rows.slice(0, 3));
  expect(builder.turnOpen()).toBe(true);
  note("Stop", "t1");
  expect(builder.turnOpen()).toBe(false);
  read(...rows.slice(3).filter(Boolean));
  expect(builder.turnOpen()).toBe(false);
});

it("posts a finished tool and its open root early, then patches the root once the turn ends", () => {
  const { posts, patches, read, note } = fakeBuilder();
  const end = editing.findIndex((row) => row.includes('"exec_command_end"') && row.includes(VLR));
  note("UserPromptSubmit");
  read(...editing.slice(0, end));
  note("PostToolUse", turn, undefined, VLR);
  read(editing[end + 1]);
  expect(posts).toEqual([]);
  read(editing[end]);
  const root = runIdGenerator(session, turn)();
  expect(posts.map(({ id, end_time }) => [id, end_time])).toEqual([
    [root, undefined],
    [toolRunIdGenerator(session, turn)(VLR), expect.any(String)],
  ]);

  read(...editing.slice(end + 2));
  note("Stop");
  expect(new Set(posts.map(({ id }) => id)).size).toBe(posts.length);
  expect(patches).toEqual([expect.objectContaining({ id: root, end_time: expect.any(String) })]);
});

it("finishes a turn and its subagents the same way after a restart from saved state", () => {
  const whole = fakeBuilder(subagents, SUBAGENTS);
  whole.note("UserPromptSubmit");
  whole.read(...subagents);
  whole.note("Stop");

  const spawned = subagents.findIndex((line) => line.includes('"collab_agent_spawn_end"'));
  const first = fakeBuilder(subagents, SUBAGENTS);
  first.note("UserPromptSubmit");
  first.read(...subagents.slice(0, spawned));
  const saved = JSON.parse(JSON.stringify(first.builder.state()));
  const restarted = fakeBuilder(subagents, SUBAGENTS, saved);
  restarted.read(...subagents.slice(spawned));
  restarted.note("Stop");

  expect(restarted.builder.transcripts()).toEqual([SUBAGENTS]);
  expect(restarted.posts).toEqual(whole.posts);
});

it("uploads full content only when both the note and the thread's saved mode allow it", async () => {
  const unrecorded = fakeBuilder();
  unrecorded.note("UserPromptSubmit", turn, "full");
  unrecorded.read(...editing);
  await submitPreference(defaultPrivacyPath(), { sessionId: session, turnId: turn, enabled: true });
  const full = fakeBuilder();
  full.note("UserPromptSubmit", turn, "full");
  full.read(...editing);
  const off = fakeBuilder();
  off.note("UserPromptSubmit", turn, "off");
  off.read(...editing);
  const imported = fakeBuilder(editing, ROLLOUT, undefined, "metadata");
  imported.note("UserPromptSubmit");
  imported.read(...editing);
  const muted = fakeBuilder();
  muted.note("UserPromptSubmit", turn, "metadata");
  muted.read(...editing);

  const modes = (posts: RunPost[]) => [...new Set(posts.map(({ tracingMode }) => tracingMode))];
  expect(full.posts.length).toBeGreaterThan(10);
  expect(off.posts).toEqual([]);
  expect(modes(imported.posts)).toEqual(["metadata"]);
  expect([modes(unrecorded.posts), modes(full.posts), modes(muted.posts)]).toEqual([
    ["metadata"],
    ["full"],
    ["metadata"],
  ]);
});

it("keeps a subagent's own turns metadata-only until its parent's launch mode is saved", async () => {
  const child = await read("04/23/rollout-subagents-019dbc03-79de-7d53-8196-3167d9a32762.jsonl");
  const [childId, childTurn] = ids(child);
  await submitPreference(defaultPrivacyPath(), {
    sessionId: childId,
    turnId: childTurn,
    enabled: true,
  });
  const { posts, read: readChild, note } = fakeBuilder(child, join(SESSIONS, "child.jsonl"));
  note("UserPromptSubmit", childTurn, "full");
  readChild(...child);

  expect(posts.length).toBeGreaterThan(0);
  expect(posts.every(({ tracingMode }) => tracingMode === "metadata")).toBe(true);
});

it("leaves the next turn open when the previous turn's Stop arrives after it started", () => {
  const { posts, read, note } = fakeBuilder();
  const [meta, ...rows] = rolloutText(session, ["t1", "t2"]).split("\n");
  note("UserPromptSubmit", "t1");
  read(meta, ...rows.slice(0, 8));
  note("Stop", "t1");
  note("UserPromptSubmit", "t2");
  read(...rows.slice(8));
  note("Stop", "t2");

  const second = posts.filter(({ trace_id }) => trace_id === runIdGenerator(session, "t2")());
  expect(second.map(({ run_type }) => run_type)).toEqual(["chain", "llm"]);
});

it("uploads a big tool output whole on the tool's run and keeps only a stub of it for the model's inputs", async () => {
  await submitPreference(defaultPrivacyPath(), { sessionId: session, turnId: turn, enabled: true });
  const { builder, posts, read, note } = fakeBuilder();
  const end = editing.findIndex((row) => row.includes('"exec_command_end"') && row.includes(VLR));
  const outputRow = JSON.parse(editing[end + 1]);
  const bigOutput = `${outputRow.payload.output}${"y".repeat(9 * 1024)}`;
  outputRow.payload.output = bigOutput;
  const unpostedRow = { ...outputRow, payload: { ...outputRow.payload, call_id: "unposted" } };
  note("UserPromptSubmit", turn, "full");
  read(...editing.slice(0, end));
  note("PostToolUse", turn, "full", VLR);
  read(JSON.stringify(unpostedRow), JSON.stringify(outputRow), editing[end]);

  const tool = posts.find(({ id }) => id === toolRunIdGenerator(session, turn)(VLR));
  expect(tool?.outputs).toMatchObject({
    messages: [{ role: "tool", content: [{ type: "text", text: bigOutput }], tool_call_id: VLR }],
  });
  const held = heldMessages(builder.state()).map(({ message }) => message);
  expect(held.slice(-2)).toEqual([
    unpostedRow.payload,
    {
      type: "function_call_output",
      call_id: VLR,
      output: `${Buffer.byteLength(JSON.stringify(bigOutput))} ${STUBBED_TOOL_OUTPUT_NOTE}`,
    },
  ]);
});

it("stubs a turn's oldest replies after the prompt once its held messages pass the cap", () => {
  const { builder, read } = fakeBuilder();
  read(...bigRows, bigReplies[0]);

  expectOldestRepliesStubbed(builder.state(), 2);
});

it("caps held messages after restoring a saved state that never counted them", () => {
  const first = fakeBuilder();
  first.read(...bigRows.slice(0, -1));
  const { heldMessageBytes: _counted, ...saved } = JSON.parse(
    JSON.stringify(first.builder.state()),
  );
  const restarted = fakeBuilder(editing, ROLLOUT, saved);
  restarted.read(...bigRows.slice(-1));

  expectOldestRepliesStubbed(restarted.builder.state(), 1);
});

it("keeps a stubbed call's tool run and shrinks every kind of item the cap reaches", () => {
  const { builder, posts, read, note } = fakeBuilder();
  const call = {
    type: "function_call",
    name: "exec",
    call_id: "big-args",
    arguments: `"${BIG_REPLY}"`,
  };
  const custom = {
    type: "custom_tool_call",
    name: "apply_patch",
    call_id: "big-input",
    input: BIG_REPLY,
  };
  const reasoning = { type: "reasoning", summary: [], encrypted_content: BIG_REPLY };
  const line = (payload: Record<string, unknown>) =>
    JSON.stringify({ timestamp: "2026-04-23T00:00:01.000Z", type: "response_item", payload });
  const output = (call_id: string) => line({ type: "function_call_output", call_id, output: "ok" });
  const stubNote = (payload: Record<string, unknown>) =>
    `${Buffer.byteLength(JSON.stringify(payload))} ${STUBBED_TURN_MESSAGE_NOTE}`;
  note("UserPromptSubmit", "t1");
  read(bigMeta, ...bigTurn.slice(0, 3), line(call), output("big-args"), line(custom));
  read(output("big-input"), line(reasoning), ...bigReplies.slice(0, 4));
  const held = heldMessages(builder.state()).map(({ message }) => message);
  read(bigTurn[4]);

  expect([held[1], held[3], held[5]]).toEqual([
    { ...call, arguments: JSON.stringify(stubNote(call)) },
    { ...custom, input: stubNote(custom) },
    {
      type: "reasoning",
      summary: [{ type: "summary_text", text: stubNote(reasoning) }],
      encrypted_content: null,
    },
  ]);
  const toolRunId = toolRunIdGenerator(session, "t1");
  expect(posts.map(({ id }) => id)).toEqual(
    expect.arrayContaining([toolRunId("big-args"), toolRunId("big-input")]),
  );
});
