import * as fs from "node:fs/promises";
import { vol } from "memfs";
import { beforeEach, expect, it, vi } from "vitest";
import {
  clearTurnCapture,
  prepareTurnCapture,
  readTranscript,
  recordToolHook,
  turnCaptureDirectory,
} from "../src/tool-capture.js";
import type { TracingHookInput } from "../src/models/tool-capture.js";

vi.mock("node:fs/promises", async () => (await import("memfs")).fs.promises);

const TRANSCRIPT = "/workspace/rollout.jsonl";
const START: TracingHookInput = {
  session_id: "thread",
  turn_id: "turn",
  transcript_path: TRANSCRIPT,
  cwd: "/workspace",
  prompt: "",
  hook_event_name: "PreToolUse",
  tool_use_id: "call",
  tool_name: "read_file",
  tool_input: { path: "/secret.txt" },
};
const EVENTS = [
  { type: "session_meta", payload: { id: "thread" } },
  { type: "event_msg", payload: { type: "task_started", turn_id: "older" } },
  { type: "response_item", payload: { type: "message", content: "old private prompt" } },
  { type: "event_msg", payload: { type: "task_started", turn_id: "turn" } },
  { type: "response_item", payload: { type: "message", content: "current secret" } },
];

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ [TRANSCRIPT]: EVENTS.map((event) => JSON.stringify(event)).join("\n") + "\n" });
});

it("retains the pre-tool start when the completion record is loaded first", async () => {
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(100);
  await recordToolHook(START, "full");
  now.mockReturnValue(200);
  await recordToolHook(
    { ...START, hook_event_name: "PostToolUse", tool_response: "result" },
    "full",
  );
  now.mockRestore();
  const { tools } = await prepareTurnCapture(TRANSCRIPT, "turn", "full");
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({ startedAt: 100, endedAt: 200, output: "result" });
});

it("preserves the first completion time and result when PostToolUse is replayed", async () => {
  const now = vi.spyOn(Date, "now");
  try {
    now.mockReturnValue(100);
    await recordToolHook(START, "full");
    now.mockReturnValue(200);
    await recordToolHook(
      { ...START, hook_event_name: "PostToolUse", tool_response: "result" },
      "full",
    );
    now.mockReturnValue(300);
    await recordToolHook({ ...START, hook_event_name: "PostToolUse" }, "full");
  } finally {
    now.mockRestore();
  }
  const { tools } = await prepareTurnCapture(TRANSCRIPT, "turn", "full");
  expect(tools[0]).toMatchObject({
    startedAt: 100,
    endedAt: 200,
    input: { path: "/secret.txt" },
    output: "result",
  });
});

it("keeps the first completion when duplicate PostToolUse hooks overlap", async () => {
  const timestamps = [100, 200, 300, 400];
  const now = vi.spyOn(Date, "now").mockImplementation(() => timestamps.shift() ?? 0);
  try {
    await Promise.all([
      recordToolHook(
        { ...START, hook_event_name: "PostToolUse", tool_response: "first result" },
        "full",
      ),
      recordToolHook(
        { ...START, hook_event_name: "PostToolUse", tool_response: "second result" },
        "full",
      ),
    ]);
  } finally {
    now.mockRestore();
  }
  const { tools } = await prepareTurnCapture(TRANSCRIPT, "turn", "full");
  expect(tools[0]).toMatchObject({ startedAt: 100, endedAt: 200, output: "first result" });
});

it("excludes historical turns and redacts the owned copy without changing the original", async () => {
  const original = await fs.readFile(TRANSCRIPT, "utf8");
  await prepareTurnCapture(TRANSCRIPT, "turn", "full", (data) =>
    JSON.parse(JSON.stringify(data).replaceAll("current secret", "redacted")),
  );
  const snapshot = await fs.readFile(
    `${turnCaptureDirectory(TRANSCRIPT, "turn")}/transcript.jsonl`,
    "utf8",
  );
  expect(snapshot).toContain("redacted");
  expect(snapshot).not.toContain("old private prompt");
  expect(snapshot).not.toContain("current secret");
  await clearTurnCapture(TRANSCRIPT, "turn");
  expect(await fs.readFile(TRANSCRIPT, "utf8")).toBe(original);
  await expect(fs.stat(turnCaptureDirectory(TRANSCRIPT, "turn"))).rejects.toHaveProperty(
    "code",
    "ENOENT",
  );
});

it("persists only timing and identity in muted mode and nothing in off mode", async () => {
  await recordToolHook(
    { ...START, hook_event_name: "PostToolUse", tool_response: "secret output" },
    "metadata",
  );
  const capture = await prepareTurnCapture(TRANSCRIPT, "turn", "metadata");
  expect(capture.tools[0]).not.toHaveProperty("input");
  expect(capture.tools[0]).not.toHaveProperty("output");
  const files = await fs.readdir(turnCaptureDirectory(TRANSCRIPT, "turn"));
  expect(files).toHaveLength(1);
  expect(
    await fs.readFile(`${turnCaptureDirectory(TRANSCRIPT, "turn")}/${files[0]}`, "utf8"),
  ).not.toContain("secret");
  await recordToolHook({ ...START, turn_id: "off" }, "off");
  await expect(fs.stat(turnCaptureDirectory(TRANSCRIPT, "off"))).rejects.toHaveProperty(
    "code",
    "ENOENT",
  );
});

it("ignores an unfinished append but rejects a corrupt completed line", async () => {
  await fs.appendFile(TRANSCRIPT, '{"type":');
  expect(await readTranscript(TRANSCRIPT)).toHaveLength(EVENTS.length);
  await fs.appendFile(TRANSCRIPT, "\n");
  await expect(readTranscript(TRANSCRIPT)).rejects.toThrow();
});
