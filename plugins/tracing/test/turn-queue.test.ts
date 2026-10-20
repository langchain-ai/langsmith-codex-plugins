import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginSession } from "@langchain/plugins-base/plugin";
import type { Config } from "../src/models/config.js";
import { queueCodexTurns } from "../src/turn-queue.js";
import { rolloutText } from "./utils/rollout.js";

const config: Config = { enabled: true, defaultMuted: false, redact: false, project: "queue" };

let dir: string;
let transcript: string;
let queued: { turnId: string; privacyMode: string; sourceRefs: string[] }[];
let failures: Error[];

function fakeSession(sessionId = "thread"): PluginSession {
  return {
    sessionId,
    session: {
      queueReconstruction: async (input: (typeof queued)[number]) => {
        const failure = failures.shift();
        if (failure) throw failure;
        queued.push(input);
        return { status: "published", record: {} };
      },
      readSavedReconstructionWake: async () => undefined,
    },
  } as unknown as PluginSession;
}

async function saved(): Promise<string[]> {
  return (await readFile(`${transcript}.langsmith`, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean);
}

async function setPolicy(turns: Record<string, string>): Promise<void> {
  const file = path.join(dir, ".codex", "langsmith_state_privacy.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ version: 1, threads: { thread: { turns } } }));
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "codex-turn-queue-"));
  vi.stubEnv("HOME", dir);
  transcript = path.join(dir, "rollout.jsonl");
  queued = [];
  failures = [];
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const request = (turnId: string) => ({ transcriptPath: transcript, turnId, cwd: dir });

it("on the first Stop queues only the live turn and records the earlier turns as handled", async () => {
  await writeFile(transcript, rolloutText("thread", ["a", "b", "c"]));
  await setPolicy({ a: "full", b: "full", c: "full" });

  await queueCodexTurns(fakeSession(), config, request("c"));

  expect(queued.map(({ turnId }) => turnId)).toEqual(["c"]);
  expect(await saved()).toEqual(["a", "b", "c"]);
});

it("on a later Stop queues every completed turn that never had a Stop", async () => {
  await writeFile(transcript, rolloutText("thread", ["a", "b", "c"]));
  await setPolicy({ a: "full", b: "metadata", c: "full" });
  await writeFile(`${transcript}.langsmith`, "a\n");

  await queueCodexTurns(fakeSession(), config, request("c"));

  expect(queued.map(({ turnId, privacyMode }) => [turnId, privacyMode])).toEqual([
    ["b", "metadata"],
    ["c", "full"],
  ]);
  expect(await saved()).toEqual(["a", "b", "c"]);
});

it("never queues a turn that is already handled or whose preference is off", async () => {
  await writeFile(transcript, rolloutText("thread", ["a", "b", "c"]));
  await setPolicy({ a: "full", b: "off", c: "full" });
  await writeFile(`${transcript}.langsmith`, "a\n");

  await queueCodexTurns(fakeSession(), config, request("c"));
  await queueCodexTurns(fakeSession(), config, request("c"));

  expect(queued.map(({ turnId }) => turnId)).toEqual(["c"]);
  expect(await saved()).toEqual(["a", "b", "c"]);
});

it("leaves a turn replayable when its reconstruction job was not saved", async () => {
  await writeFile(transcript, rolloutText("thread", ["a"]));
  await setPolicy({ a: "full" });
  failures = [new Error("capture store unavailable")];

  await expect(queueCodexTurns(fakeSession(), config, request("a"))).rejects.toThrow(
    "capture store unavailable",
  );
  expect(await saved()).toEqual([]);

  await queueCodexTurns(fakeSession(), config, request("a"));
  expect(queued.map(({ turnId }) => turnId)).toEqual(["a"]);
  expect(await saved()).toEqual(["a"]);
});

it("marks the turn after a saved job when only the worker wake failed", async () => {
  const error = new Error("worker wake unavailable");
  const session = {
    sessionId: "thread",
    session: {
      queueReconstruction: async () => {
        throw error;
      },
      readSavedReconstructionWake: async (received: unknown) =>
        received === error ? { record: {} } : undefined,
    },
  } as unknown as PluginSession;
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await writeFile(transcript, rolloutText("thread", ["a"]));
  await setPolicy({ a: "metadata" });

  try {
    await queueCodexTurns(session, config, request("a"));
    expect(await saved()).toEqual(["a"]);
  } finally {
    log.mockRestore();
  }
});
