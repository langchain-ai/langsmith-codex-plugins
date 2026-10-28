import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as path from "node:path";

import { convertToRunTree } from "./utils/convert.js";
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

beforeEach(() => vol.reset());
afterEach(() => vi.unstubAllEnvs());

const EDITING = {
  file: "2026/04/23/rollout-editing.jsonl",
  turnId: "019dbc00-ede4-77c2-9e7a-b6876efeab9b",
};
const SKILLS = { file: "2026/09/14/rollout-skills.jsonl", turnId: "019900aa-tttt-0001" };

async function fixture({ file }: { file: string }): Promise<string> {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return fs.readFile(path.join(__dirname, "sessions", file), { encoding: "utf-8" });
}

async function usageFor(transcript: string, { file, turnId }: { file: string; turnId: string }) {
  const { client, callSpy } = mockClient();
  const transcriptPath = path.join("/home/codex-user/.codex/sessions", file);
  vol.fromJSON({ [transcriptPath]: transcript });

  seedFullLaunchEvidence();
  await convertToRunTree(
    { transcript_path: transcriptPath, turn_id: turnId },
    { client, projectName: "codex" },
  );

  const { data } = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(data);
  const inputTokens = (run: (typeof runs)[number]) =>
    (run.extra?.metadata?.usage_metadata as { input_tokens?: number } | undefined)?.input_tokens;
  return {
    llm: runs.filter((run) => run.run_type === "llm").map(inputTokens),
    tool: runs.filter((run) => run.run_type === "tool").map(inputTokens),
  };
}

function insertAfter(transcript: string, marker: string, line: Record<string, unknown>): string {
  const lines = transcript.trimEnd().split("\n");
  const at = lines.findLastIndex((entry) => entry.includes(marker));
  lines.splice(at + 1, 0, JSON.stringify(line));
  return `${lines.join("\n")}\n`;
}

function tokenCount(info: Record<string, unknown> | null) {
  return {
    timestamp: "2026-09-14T00:00:06.500Z",
    type: "event_msg",
    payload: { type: "token_count", info },
  };
}

it("keeps usage on the model run when token_count precedes the tool outputs", async () => {
  const usage = await usageFor(await fixture(EDITING), EDITING);

  expect(usage.llm).toEqual([13226, 13635, 14116, 14960, 15276]);
  expect(usage.tool.every((tokens) => tokens == null)).toBe(true);
});

it("keeps usage on the model run when token_count follows the tool outputs", async () => {
  const usage = await usageFor(await fixture(SKILLS), SKILLS);

  expect(usage.llm[0]).toBe(10);
  expect(usage.tool.every((tokens) => tokens == null)).toBe(true);
});

it("does not count a repeated token_count on the tool run", async () => {
  const transcript = await fixture(EDITING);
  const first = JSON.parse(transcript.split("\n").find((line) => line.includes('"token_count"'))!);
  const repeated = insertAfter(transcript, '"call_id":"call_TnN7qrLwqBS1FizRbNzmnUzW"', first);

  const usage = await usageFor(repeated, EDITING);

  expect(usage.llm).toEqual([13226, 13635, 14116, 14960, 15276]);
  expect(usage.tool.every((tokens) => tokens == null)).toBe(true);
});

it("keeps recorded usage when a token_count has no info", async () => {
  const transcript = insertAfter(await fixture(SKILLS), '"token_count"', tokenCount(null));

  const usage = await usageFor(transcript, SKILLS);

  expect(usage.llm[0]).toBe(10);
});

it("keeps the response usage when compaction reports an estimate", async () => {
  const estimate = {
    total_token_usage: { input_tokens: 15276, output_tokens: 0, total_tokens: 15276 },
    last_token_usage: { input_tokens: 0, output_tokens: 0, total_tokens: 50000 },
  };
  const transcript = insertAfter(await fixture(EDITING), '"token_count"', tokenCount(estimate));

  const usage = await usageFor(transcript, EDITING);

  expect(usage.llm.at(-1)).toBe(15276);
});
