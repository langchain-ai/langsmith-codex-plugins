import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookNote, RunPatch, RunPost, TracingMode } from "@langchain/plugins-base/tracer";
import { beforeEach, expect, it, vi } from "vitest";
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

beforeEach(async () => {
  vi.stubEnv("HOME", await fs.mkdtemp(join(tmpdir(), "codex-builder-")));
});

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

it("closes a turn the rollout never ended on Stop, and its late end line adds nothing", () => {
  const { posts, read, note } = fakeBuilder();
  const [meta, ...rows] = rolloutText(session, ["t1"]).split("\n");
  note("UserPromptSubmit", "t1");
  read(meta, ...rows.slice(0, -2));
  note("Stop", "t1");
  const posted = posts.length;
  read(...rows.slice(-2));

  expect(posted).toBeGreaterThan(0);
  expect(posts.length).toBe(posted);
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
  const imported = fakeBuilder(editing, ROLLOUT, undefined, "metadata");
  imported.note("UserPromptSubmit");
  imported.read(...editing);
  const muted = fakeBuilder();
  muted.note("UserPromptSubmit", turn, "metadata");
  muted.read(...editing);

  const modes = (posts: RunPost[]) => [...new Set(posts.map(({ tracingMode }) => tracingMode))];
  expect(full.posts.length).toBeGreaterThan(10);
  expect(modes(imported.posts)).toEqual(["metadata"]);
  expect([modes(unrecorded.posts), modes(full.posts), modes(muted.posts)]).toEqual([
    ["metadata"],
    ["full"],
    ["metadata"],
  ]);
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
