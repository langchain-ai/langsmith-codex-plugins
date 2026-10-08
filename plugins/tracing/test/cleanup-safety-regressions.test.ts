import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { STALE_PLUGIN_TTL_MS } from "../src/constants/stale-state-cleanup.js";
import { cleanupStalePluginState } from "../src/stale-state-cleanup.js";
import { savedTurnMode, submitPreference } from "../src/tracing-policy.js";
import * as locks from "../src/utils/fileLock.js";

vi.mock("../src/utils/fileLock.js", async (original) => ({
  ...(await original<typeof import("../src/utils/fileLock.js")>()),
}));

let home: string;
let sessions: string;
let privacyPath: string;
let now: number;
let old: number;
let createdFiles: string[];
let createdDirectories: string[];
const sessionId = "00000000-0000-0000-0000-000000000001";
const currentSessionId = "00000000-0000-0000-0000-000000000002";
const compressedId = "00000000-0000-0000-0000-000000000003";
const missingId = "00000000-0000-0000-0000-000000000004";
const changedId = "00000000-0000-0000-0000-000000000005";
const liveId = "00000000-0000-0000-0000-000000000006";
const unknownId = "00000000-0000-0000-0000-000000000007";
const incrementalHash = "b".repeat(64);
const deadPid = 2147483647;

async function directory(value: string): Promise<void> {
  await fs.mkdir(value);
  createdDirectories.push(value);
}

async function write(file: string, contents = "old", timestamp = old): Promise<void> {
  await fs.writeFile(file, contents);
  if (!createdFiles.includes(file)) createdFiles.push(file);
  await fs.utimes(file, timestamp / 1000, timestamp / 1000);
}

function transcript(name: string, id: string): string {
  return path.join(sessions, `rollout-${name}-${id}.jsonl`);
}

async function policy(threads: Record<string, unknown>): Promise<void> {
  await write(privacyPath, JSON.stringify({ version: 1, threads }));
}

async function exists(file: string): Promise<boolean> {
  return fs.lstat(file).then(
    () => true,
    () => false,
  );
}

async function clean(): Promise<void> {
  await cleanupStalePluginState(path.join(sessions, "current.jsonl"), currentSessionId, {
    now,
    privacyPath,
  });
}

beforeEach(async () => {
  createdFiles = [];
  createdDirectories = [];
  home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codex-cleanup-safety-")));
  createdDirectories.push(home);
  await directory(path.join(home, ".codex"));
  sessions = path.join(home, ".codex", "sessions");
  await directory(sessions);
  privacyPath = path.join(home, ".codex", "langsmith-state.privacy.json");
  now = Date.now();
  old = now - STALE_PLUGIN_TTL_MS - 10000;
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const file of createdFiles.reverse()) await fs.unlink(file).catch(() => undefined);
  for (const value of createdDirectories.reverse()) await fs.rmdir(value).catch(() => undefined);
});

it("keeps privacy when another rollout of the same session becomes active", async () => {
  const first = transcript("2026-01-01T00-00-00", sessionId);
  await write(first, `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`);
  await write(`${first}.langsmith`);
  const nested = path.join(sessions, "z-nested");
  await directory(nested);
  const other = path.join(nested, `rollout-2026-01-02T00-00-00-${sessionId}.jsonl`);
  await write(other, `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`);
  await write(`${other}.langsmith`);
  await policy({ [sessionId]: { turns: { turn: "full" }, lastActivityAt: old } });
  const realLock = locks.tryWithFileLock;
  let activityStarted = false;
  vi.spyOn(locks, "tryWithFileLock").mockImplementation(async (file, action) => {
    if (!activityStarted && file.startsWith(first)) {
      activityStarted = true;
      await fs.utimes(other, now / 1000, now / 1000);
      await fs.utimes(`${other}.langsmith`, now / 1000, now / 1000);
    }
    return realLock(file, action);
  });
  await clean();
  expect(activityStarted).toBe(true);
  expect(await exists(`${other}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, sessionId, "turn")).toBe("full");
});

it("skips cleanup when a new rollout appears after the initial scan", async () => {
  const first = transcript("2026-01-01T00-00-00", sessionId);
  await write(first, `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`);
  await write(`${first}.langsmith`);
  await policy({ [sessionId]: { turns: { turn: "full" }, lastActivityAt: old } });
  const newRollout = transcript("2026-01-02T00-00-00", sessionId);
  const realLock = locks.tryWithFileLock;
  let rolloutCreated = false;
  vi.spyOn(locks, "tryWithFileLock").mockImplementation(async (file, action) => {
    if (!rolloutCreated && file.startsWith(first)) {
      rolloutCreated = true;
      await write(
        newRollout,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
      );
      await write(`${newRollout}.langsmith`);
    }
    return realLock(file, action);
  });
  await clean();
  expect(rolloutCreated).toBe(true);
  expect(await exists(`${first}.langsmith`)).toBe(true);
  expect(await exists(`${newRollout}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, sessionId, "turn")).toBe("full");
});

it("preserves privacy if a known rollout changes session identity", async () => {
  const first = transcript("2026-01-01T00-00-00", "without-uuid");
  await write(first, `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`);
  await write(`${first}.langsmith`);
  await policy({ [sessionId]: { turns: { turn: "full" }, lastActivityAt: old } });
  const realLock = locks.tryWithFileLock;
  let identityChanged = false;
  vi.spyOn(locks, "tryWithFileLock").mockImplementation(async (file, action) => {
    if (!identityChanged && file.startsWith(first)) {
      identityChanged = true;
      await write(
        first,
        `${JSON.stringify({ type: "session_meta", payload: { id: changedId } })}\n`,
      );
    }
    return realLock(file, action);
  });
  await clean();
  expect(identityChanged).toBe(true);
  expect(await exists(`${first}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, sessionId, "turn")).toBe("full");
});

it.skipIf(process.platform === "win32")(
  "fails closed on native transcript FIFOs without blocking cleanup",
  async () => {
    const file = transcript("2026-01-01T00-00-00", sessionId);
    execFileSync("mkfifo", [file]);
    createdFiles.push(file);
    await write(`${file}.langsmith`);
    await policy({ [sessionId]: { turns: { turn: "full" }, lastActivityAt: old } });
    await clean();
    expect(await exists(`${file}.langsmith`)).toBe(true);
    expect(savedTurnMode(privacyPath, sessionId, "turn")).toBe("full");
  },
  2000,
);

it("removes only old recovery files with known dead owners", async () => {
  const dead = transcript("2026-01-01T00-00-00", sessionId);
  const live = transcript("2026-01-01T00-00-00", liveId);
  const unknown = transcript("2026-01-01T00-00-00", unknownId);
  for (const [file, id] of [
    [dead, sessionId],
    [live, liveId],
    [unknown, unknownId],
  ]) {
    await write(file, `${JSON.stringify({ type: "session_meta", payload: { id } })}\n`);
    await write(`${file}.langsmith`);
  }
  const deadRecoveryFiles = [
    `${dead}.langsmith.lock.recover-${deadPid}`,
    `${dead}.langsmith-capture.lock.recover-${deadPid}`,
    `${dead}.langsmith-incremental-${incrementalHash}.json.lock.recover-${deadPid}`,
  ];
  for (const file of deadRecoveryFiles)
    await write(file, JSON.stringify({ pid: deadPid, token: "dead" }));
  const liveRecovery = `${live}.langsmith.lock.recover-${process.pid}`;
  await write(liveRecovery, JSON.stringify({ pid: process.pid, token: "live" }));
  const unknownRecovery = `${unknown}.langsmith.lock.recover-${deadPid}`;
  await write(unknownRecovery, "invalid owner");
  await policy({
    [sessionId]: { turns: { turn: "full" }, lastActivityAt: old },
    [liveId]: { turns: { turn: "full" }, lastActivityAt: old },
    [unknownId]: { turns: { turn: "full" }, lastActivityAt: old },
  });
  await clean();
  expect(await exists(`${dead}.langsmith`)).toBe(false);
  for (const file of deadRecoveryFiles) expect(await exists(file)).toBe(false);
  expect(savedTurnMode(privacyPath, sessionId, "turn")).toBe("metadata");
  expect(await exists(`${live}.langsmith`)).toBe(true);
  expect(await exists(liveRecovery)).toBe(true);
  expect(savedTurnMode(privacyPath, liveId, "turn")).toBe("full");
  expect(await exists(`${unknown}.langsmith`)).toBe(true);
  expect(await exists(unknownRecovery)).toBe(true);
  expect(savedTurnMode(privacyPath, unknownId, "turn")).toBe("full");
});

it("prunes compressed-only and orphan evidence without replaying old turns on resume", async () => {
  const compressed = transcript("2026-01-01T00-00-00", compressedId);
  const missing = transcript("2026-01-01T00-00-00", missingId);
  await write(`${compressed}.zst`, "compressed original");
  await write(`${compressed}.langsmith`);
  await write(`${missing}.langsmith`);
  await policy({
    [compressedId]: { preference: "full", turns: { old: "full" }, lastActivityAt: old },
    [missingId]: { preference: "full", turns: { old: "full" }, lastActivityAt: old },
  });
  await clean();
  expect(await fs.readFile(`${compressed}.zst`, "utf8")).toBe("compressed original");
  expect(await exists(`${compressed}.langsmith`)).toBe(false);
  expect(await exists(missing)).toBe(false);
  expect(await exists(`${missing}.langsmith`)).toBe(false);
  for (const id of [compressedId, missingId]) {
    expect(savedTurnMode(privacyPath, id, "old")).toBe("metadata");
    await submitPreference(privacyPath, id, "resumed", true);
    expect(savedTurnMode(privacyPath, id, "old")).toBe("metadata");
    expect(savedTurnMode(privacyPath, id, "resumed")).toBe("full");
  }
});
