import * as fs from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import { runIdGenerator, toolRunIdGenerator } from "../src/tracing-engine-payload.js";
import { ids, liveWire, outputLine as outputIn, read } from "./utils/live-wire.js";

vi.setConfig({ testTimeout: 60_000 });
const lines = await read("04/23/rollout-editing.jsonl");
const [session, turn] = ids(lines);
const outputLine = (callId: string) => outputIn(callId, lines);
const VLR = "call_VLRlIzWNfD2jSDW47dX5eEMz";
const wire = liveWire();
const workspace = (name = "live", rows = lines) => wire.workspace(name, rows);
const toolPost = () => wire.sent("post").find(({ name }) => name === "exec_command");
const rootClosed = () => wire.sent("patch").some((run) => run.outputs && run.end_time);

it("uploads a finished tool's run and its open turn root before Stop runs", async () => {
  const live = await workspace();
  await live.tool(VLR);
  await live.settle();

  const runs = [...wire.trace("live").runs.values()];
  expect(runs.map(({ name }) => name).toSorted()).toEqual(["exec_command", "openai.codex"]);
  const root = runs.find(({ name }) => name === "openai.codex")!;
  const tool = runs.find(({ name }) => name === "exec_command")!;
  expect(root.end_time).toBeUndefined();
  expect(tool).toMatchObject({ parent_run_id: root.id, trace_id: root.id });
});

it("uploads every run once and ends with the Stop-only trace when one tool hook is late and one never fires", async () => {
  const live = await workspace();
  const [late, never] = ["call_3OQBDME6h5mpKj1s9Th6xRLn", "call_knyQUScDg6E37886AesTRAV9"];
  const calls = [...new Set(lines.map((line) => JSON.parse(line).payload.call_id).filter(Boolean))];
  for (const callId of calls) if (callId !== late && callId !== never) await live.tool(callId);
  await live.write();
  const beforeStop = wire.sent("post").map(({ id }) => id);
  await live.stop();
  await live.settle();
  await live.toolHook(late);
  await live.settle();

  const reference = await workspace("reference");
  await reference.write();
  await reference.stop();
  await reference.settle();

  const actual = wire.trace("live");
  const expected = wire.trace("reference");
  expect([...actual.posts.values()].every((count) => count === 1)).toBe(true);
  expect(actual.posts.size).toBe(expected.posts.size);
  const patches = wire.sent("patch", "live");
  const root = [...actual.runs.values()].find(({ name }) => name === "openai.codex")!;
  expect(patches.find(({ id }) => id === root.id)).toMatchObject({ outputs: root.outputs });
  const toolId = toolRunIdGenerator(session, turn);
  const early = calls.filter((callId) => beforeStop.includes(toolId(callId)));
  expect(early.length).toBeGreaterThan(2);
  for (const callId of early) {
    const { metadata } = actual.runs.get(toolId(callId))!.extra;
    expect(metadata).not.toHaveProperty("ls_raw_aggregated_usage");
  }
  expect(root.extra.metadata).toHaveProperty("ls_raw_aggregated_usage");
  expect(Object.fromEntries(actual.runs)).toEqual(Object.fromEntries(expected.runs));
  const slots = Array.from({ length: 14 }, runIdGenerator(session, turn));
  const nonTools = [...expected.runs.values()].filter(({ run_type }) => run_type !== "tool");
  const pinned = [0, 1, 5, 8, 10, 13].map((i) => slots[i]);
  expect(nonTools.map(({ id }) => id).toSorted()).toEqual(pinned.toSorted());
});

it("starts no trace of its own for a subagent's tool, which Codex reports under the parent session", async () => {
  const live = await workspace();
  const name = "rollout-subagents-019dbc03-79ee-7ee0-b40b-26920c74c524.jsonl";
  const subagent = await read(`04/23/${name}`);
  const rows = subagent.map((line) => JSON.parse(line));
  const call = rows.find(({ payload }) => payload.type === "function_call_output");
  const { turn_id } = rows.find(({ payload }) => payload.type === "task_started").payload;
  const ended = { type: "exec_command_end", call_id: call.payload.call_id, turn_id };
  const end = JSON.stringify({ timestamp: call.timestamp, type: "event_msg", payload: ended });
  const path = join(wire.dir(), name);
  await fs.writeFile(path, [...subagent, end].join("\n") + "\n");
  await live.hook({
    hook_event_name: "PostToolUse",
    turn_id,
    transcript_path: path,
    tool_use_id: call.payload.call_id,
  });
  await live.settle();

  expect(wire.trace("live").runs.size).toBe(0);
});

it("waits for a tool's output that lands after its hook fires and uploads it with that output", async () => {
  const live = await workspace();
  await live.arriving(VLR, outputLine(VLR));
  await live.settle();

  expect(toolPost()?.outputs?.messages).toHaveLength(1);
});

it("skips a tool whose hook was waiting on the lock while Stop handled its turn", async () => {
  const live = await workspace();
  await live.write(outputLine(VLR) + 1);
  let hook: Promise<void> | undefined;
  await live.locked(async () => {
    hook = live.toolHook(VLR);
    await sleep(1000);
    await fs.writeFile(live.marker, `${turn}\n`);
  });
  await hook;
  await live.settle();

  expect(wire.received).toHaveLength(0);
});

it("still queues the turn when Stop cannot get the lock", async () => {
  const live = await workspace();
  await live.tool(VLR);
  await live.write();
  await live.locked(live.stop);
  await live.settle();

  expect(rootClosed()).toBe(true);
});

it("closes its own open root even when another integration already marked the turn handled", async () => {
  const live = await workspace();
  await live.tool(VLR);
  await live.write();
  await fs.writeFile(live.marker, `${turn}\n`);
  await live.stop();
  await live.settle();

  expect(rootClosed()).toBe(true);
});

it("retries past a half-written last line and uploads the tool once the line is complete", async () => {
  const live = await workspace();
  await live.arriving(VLR, outputLine(VLR) + 1, lines[outputLine(VLR) + 1].slice(0, 40));
  await live.settle();

  expect(toolPost()).toBeDefined();
});

it("holds Stop back while a tool hook is still saving, so the hook never saves after Stop plans", async () => {
  const live = await workspace();
  await live.write();
  let stop: Promise<void> | undefined;
  const marked = await live.locked(async () => {
    stop = live.stop();
    await sleep(1500);
    return fs.readFile(live.marker, "utf8").catch(() => "");
  });
  await stop;

  expect(marked).toBe("");
  expect(await fs.readFile(live.marker, "utf8")).toContain(turn);
});

it("uploads a finished exec_command before Stop on a current Codex transcript", async () => {
  const rows = await read("10/16/rollout-codex-0162.jsonl");
  const live = await workspace("live", rows);
  const completed = rows.findIndex((row) => JSON.parse(row).payload.item?.id === "call_s2");
  await live.arriving("call_s2", completed + 1);
  await live.settle();

  expect(toolPost()).toBeDefined();
});
