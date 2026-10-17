import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readJobContext, removeJobContext, saveJobContext } from "../src/job-context.js";
import { contextSourceRef, transcriptSourceRef } from "../src/tracing-engine-locator.js";

const HOUR = 60 * 60 * 1000;
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "codex-job-context-"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

const refFor = (turnId: string) =>
  contextSourceRef("thread", turnId, transcriptSourceRef("/rollout.jsonl"), "full");

const context = (cwd: string) => ({
  cwd,
  project: "p",
  metadata: { owner: "a" },
  parent_headers: undefined,
});
const stateFile = () => path.join(home, ".codex", "langsmith-state.jobs.json");

it("keeps each queued turn's context in Codex's job state file until its upload is done", async () => {
  await saveJobContext(home, "thread", refFor("one"), context("/a"));
  await saveJobContext(home, "thread", refFor("two"), context("/b"));
  await saveJobContext(home, "other", refFor("one"), context("/c"));
  expect(readJobContext(home, "thread", refFor("one"))).toEqual(context("/a"));
  await removeJobContext(home, "thread", refFor("one"));

  expect(readJobContext(home, "thread", refFor("one"))).toBeUndefined();
  expect(readJobContext(home, "thread", refFor("two"))).toEqual(context("/b"));
  expect(readJobContext(home, "other", refFor("one"))).toEqual(context("/c"));
  expect(await readdir(path.join(home, ".codex"))).toEqual([
    "langsmith-state.jobs.json",
    "langsmith-state.jobs.json.claims",
  ]);
});

it("drops a session with nothing left queued", async () => {
  await saveJobContext(home, "thread", refFor("one"), context("/a"));
  await removeJobContext(home, "thread", refFor("one"));

  expect(JSON.parse(await readFile(stateFile(), "utf8"))).toEqual({});
});

it("drops a session's queued contexts once they are older than 6 hours and keeps newer ones", async () => {
  await saveJobContext(home, "old", refFor("one"), context("/a"));
  await saveJobContext(home, "recent", refFor("one"), context("/b"));
  const state = JSON.parse(await readFile(stateFile(), "utf8"));
  state.old.updated = new Date(Date.now() - 7 * HOUR).toISOString();
  state.recent.updated = new Date(Date.now() - 5 * HOUR).toISOString();
  await writeFile(stateFile(), JSON.stringify(state));

  await saveJobContext(home, "new", refFor("one"), context("/c"));

  expect(readJobContext(home, "old", refFor("one"))).toBeUndefined();
  expect(readJobContext(home, "recent", refFor("one"))).toEqual(context("/b"));
});
