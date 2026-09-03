import * as fs from "node:fs";
import * as path from "node:path";
import { vol } from "memfs";
import { beforeEach, expect, it, vi } from "vitest";
import { handleUserPromptSubmit } from "../src/index.js";
import { getThreadMode, getTurnMode, readTracingState } from "../src/state.js";

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});
vi.mock("../src/utils/stdin.js", () => ({ readStdin: () => new Promise(() => {}) }));

const HOME = "/home/codex-user";
const FILE = path.join(HOME, ".codex/sessions/rollout-root.jsonl");

function input(prompt: string, turn_id: string | null = "turn") {
  return {
    session_id: "root",
    ...(turn_id === null ? {} : { turn_id }),
    transcript_path: FILE,
    hook_event_name: "UserPromptSubmit" as const,
    prompt,
  };
}

beforeEach(() => {
  vol.reset();
  vi.stubEnv("HOME", HOME);
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vol.fromJSON({
    [FILE]: JSON.stringify({ type: "session_meta", payload: { id: "root", source: "cli" } }),
  });
});

it("blocks exact commands with the Codex command payload and standard messages", async () => {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  await expect(handleUserPromptSubmit(input("/trace off"))).resolves.toBe(true);
  expect(getThreadMode("root", HOME)).toBe("metadata");
  expect(write).toHaveBeenLastCalledWith(
    JSON.stringify({
      decision: "block",
      reason: "LangSmith tracing is off for this thread (metadata only).",
    }),
  );
  await handleUserPromptSubmit(input("/trace on"));
  expect(write).toHaveBeenLastCalledWith(
    JSON.stringify({ decision: "block", reason: "LangSmith tracing is on for this thread." }),
  );
  write.mockRestore();
});

it("persists commands but reports a distinct master-disabled state", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "false");
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  await handleUserPromptSubmit(input("/trace off"));
  expect(getThreadMode("root", HOME)).toBe("metadata");
  expect(write).toHaveBeenCalledWith(
    JSON.stringify({
      decision: "block",
      reason: "LangSmith tracing is disabled by configuration for this thread.",
    }),
  );
  write.mockRestore();
});

it("does not intercept near matches and snapshots normal prompts", async () => {
  await expect(handleUserPromptSubmit(input(" /trace off", "turn-1"))).resolves.toBe(false);
  expect(getTurnMode("turn-1", "root", HOME)).toBe("full");
  await expect(handleUserPromptSubmit(input("/trace OFF", "turn-2"))).resolves.toBe(false);
  expect(getTurnMode("turn-2", "root", HOME)).toBe("full");
});

it("fails closed when the prompt snapshot cannot be written", async () => {
  const rename = vi.spyOn(fs, "renameSync").mockImplementation(() => {
    throw new Error("write failed");
  });
  await expect(handleUserPromptSubmit(input("private", "missing"))).resolves.toBe(false);
  rename.mockRestore();
  expect(getTurnMode("missing", "root", HOME)).toBe("metadata");
});

it("queues prompts without turn ids and never queues commands", async () => {
  await handleUserPromptSubmit(input("private prompt", null));
  expect(readTracingState(HOME).state.pending.root).toHaveLength(1);
  expect(JSON.stringify(readTracingState(HOME).state)).not.toContain("private prompt");
  await handleUserPromptSubmit(input("/trace status", null));
  expect(readTracingState(HOME).state.pending.root).toHaveLength(1);
});
