import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { vol } from "memfs";

import * as path from "node:path";
import { mockClient } from "./utils/mock_client.js";
import { getAssumedTreeFromCalls } from "./utils/tree.js";

// End-to-end coverage for ls_skill_name over real (sanitized) Codex 0.128.0
// rollouts: a skill invocation surfaces only as an exec_command reading
// .../skills/<name>/SKILL.md, and the tracer must tag that tool run.
const SESSIONS_DIR = "/home/codex-user/.codex/sessions/2026/07/23";

async function preloadSkillFixtures() {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const sourceDir = path.join(__dirname, "sessions/2026/07/23");
  const files = await fs.readdir(sourceDir);

  const out: Record<string, string> = {};
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    out[path.join(SESSIONS_DIR, file)] = await fs.readFile(path.join(sourceDir, file), "utf-8");
  }
  return out;
}

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

async function skillNamesFor(transcript: string, turnId: string): Promise<string[]> {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadSkillFixtures());

  await convertToRunTree(
    { transcript_path: path.join(SESSIONS_DIR, transcript), turn_id: turnId },
    { client, projectName: "codex" },
  );
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  return Object.values(tree.data)
    .map((run) => run.extra?.metadata?.ls_skill_name)
    .filter((name): name is string => typeof name === "string");
}

describe("ls_skill_name from real rollouts", () => {
  it("tags an explicitly-invoked skill (openai-docs)", async () => {
    const names = await skillNamesFor(
      "rollout-skill-explicit.jsonl",
      "019f8fd0-28ef-78d1-9973-c3757a53332a",
    );
    expect([...new Set(names)]).toEqual(["openai-docs"]);
  });

  it("tags an implicitly-chosen skill once (skill-creator), deduped per turn", async () => {
    const names = await skillNamesFor(
      "rollout-skill-implicit.jsonl",
      "019f8fd1-0cf7-7d32-b7cb-86d980f60d88",
    );
    // skill-creator read three ways in one turn → deduped to a single tag.
    expect([...new Set(names)]).toEqual(["skill-creator"]);
    expect(names.length).toBe(1);
  });
});
