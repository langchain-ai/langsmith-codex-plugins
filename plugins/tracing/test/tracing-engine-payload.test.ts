import { RunTree } from "langsmith";
import { expect, it } from "vitest";
import { postSubmission, runIdGenerator } from "../src/tracing-engine-payload.js";

const metadata = {
  integration: "openai-codex",
  threadId: "thread",
  agentType: "root",
  runType: "root",
} as const;

function run(): RunTree {
  return new RunTree({ name: "openai.codex", run_type: "chain", inputs: { prompt: "hello" } });
}

it("derives the same run IDs for the same turn so a retry cannot duplicate runs", () => {
  const first = runIdGenerator("session", "turn");
  const retry = runIdGenerator("session", "turn");
  const ids = [first(), first(), first()];
  expect([retry(), retry(), retry()]).toEqual(ids);
  expect(new Set(ids).size).toBe(3);
  expect(runIdGenerator("other", "turn")()).not.toBe(ids[0]);
  expect(runIdGenerator("session", "other")()).not.toBe(ids[0]);
});

it("refuses a run whose metadata has no trusted thread ID", () => {
  expect(() => postSubmission(run(), "full", { ...metadata, threadId: "" })).toThrow(
    "no trusted thread ID",
  );
});

it.each([
  ["name", (value: RunTree) => ((value as unknown as { name?: string }).name = undefined)],
  ["inputs", (value: RunTree) => ((value as unknown as { inputs: unknown }).inputs = "text")],
])("refuses a run whose %s is unavailable", (_field, damage) => {
  const broken = run();
  damage(broken);
  expect(() => postSubmission(broken, "full", metadata)).toThrow("identity or inputs");
});

it("labels a failed run as an error rather than completed", () => {
  const failed = run();
  failed.error = "tool crashed";
  failed.end_time = Date.now();
  expect(postSubmission(failed, "full", metadata).privacyContext).toEqual({ status: "error" });
});

it("keeps the run outputs in the upload", () => {
  const done = run();
  done.outputs = { messages: ["done"] };
  expect(postSubmission(done, "full", metadata).run.outputs).toEqual({ messages: ["done"] });
});
