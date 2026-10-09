import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanupStalePluginState } from "../src/stale-state-cleanup.js";
import { STALE_PLUGIN_TTL_MS } from "../src/constants/stale-state-cleanup.js";
import { savedTurnMode, submitPreference } from "../src/tracing-policy.js";
import { turnCaptureDirectory } from "../src/tool-capture.js";
import * as locks from "../src/utils/fileLock.js";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof import("node:fs/promises")>()),
}));

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
const id = "00000000-0000-0000-0000-000000000001";
const currentId = "00000000-0000-0000-0000-000000000002";
const hash = "a".repeat(64);
const uuid = "00000000-0000-0000-0000-000000000003";
const changedId = "00000000-0000-0000-0000-000000000005";
const liveId = "00000000-0000-0000-0000-000000000006";
const unknownId = "00000000-0000-0000-0000-000000000007";
const incrementalHash = "b".repeat(64);
const deadPid = 2147483647;

async function directory(value: string) {
  await fs.mkdir(value, { recursive: true });
  createdDirectories.push(value);
}
async function write(file: string, contents = "old", timestamp = old) {
  await fs.writeFile(file, contents);
  createdFiles.push(file);
  await fs.utimes(file, timestamp / 1000, timestamp / 1000);
}
async function fixture(sessionId = id) {
  const transcript = path.join(sessions, `rollout-2026-01-01T00-00-00-${sessionId}.jsonl`);
  await write(
    transcript,
    `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
  );
  await write(`${transcript}.langsmith`);
  return transcript;
}
function transcript(name: string, sessionId: string) {
  return path.join(sessions, `rollout-${name}-${sessionId}.jsonl`);
}
async function policy(threads: Record<string, unknown>) {
  await write(privacyPath, JSON.stringify({ version: 1, threads }));
}
async function exists(file: string) {
  return fs.lstat(file).then(
    () => true,
    () => false,
  );
}
async function clean(transcript = path.join(sessions, "current.jsonl")) {
  await cleanupStalePluginState(path.join(path.dirname(transcript), "current.jsonl"), currentId, {
    now,
    recover: async () => true,
    privacyPath,
  });
}

beforeEach(async () => {
  createdFiles = [];
  createdDirectories = [];
  home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codex-stale-state-")));
  createdDirectories.push(home);
  privacyPath = path.join(home, ".codex", "langsmith-state.privacy.json");
  await directory(path.join(home, ".codex"));
  sessions = path.join(home, ".codex", "sessions");
  await directory(sessions);
  now = Date.now();
  old = now - STALE_PLUGIN_TTL_MS - 10000;
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const file of createdFiles.reverse()) await fs.unlink(file).catch(() => undefined);
  for (const value of createdDirectories.reverse()) await fs.rmdir(value).catch(() => undefined);
});

it("expires only plugin evidence and preserves original bytes and sticky privacy", async () => {
  const transcript = await fixture();
  const original = await fs.readFile(transcript);
  await write(`${transcript}.zst`, "compressed original");
  const capture = turnCaptureDirectory(transcript, "turn");
  await directory(capture);
  await write(path.join(capture, "transcript.jsonl"), "captured secret");
  await write(path.join(capture, `${hash}.start.json`));
  await write(path.join(capture, `stop.json.${uuid}.tmp`));
  await fs.utimes(capture, old / 1000, old / 1000);
  const artifacts = [
    `${transcript}.langsmith-topology-${hash}.json`,
    `${transcript}.langsmith-incremental-${hash}.json`,
    `${transcript}.langsmith-topology-${hash}.json.${uuid}.tmp`,
    `${transcript}.langsmith-incremental-${hash}.json.${uuid}.tmp`,
  ];
  for (const artifact of artifacts) await write(artifact);
  await policy({ [id]: { preference: "metadata", turns: { turn: "full" }, lastActivityAt: old } });
  await clean(transcript);
  expect(await fs.readFile(transcript)).toEqual(original);
  expect(await fs.readFile(`${transcript}.zst`, "utf8")).toBe("compressed original");
  expect(await exists(sessions)).toBe(true);
  for (const artifact of [...artifacts, capture, `${transcript}.langsmith`])
    expect(await exists(artifact)).toBe(false);
  expect(JSON.parse(await fs.readFile(privacyPath, "utf8")).threads[id]).toEqual({
    preference: "metadata",
    turns: {},
    lastActivityAt: old,
    historyPruned: true,
  });
});

it("preserves the whole session when a nested capture or compressed native file is recent", async () => {
  const transcript = await fixture();
  const second = await fixture(uuid);
  const capture = turnCaptureDirectory(transcript, "turn");
  await directory(capture);
  await write(path.join(capture, "stop.json"), "recent", now);
  await fs.utimes(capture, old / 1000, old / 1000);
  await write(`${second}.zst`, "recent", now);
  await policy({
    [id]: { turns: { turn: "full" }, lastActivityAt: old },
    [uuid]: { turns: { turn: "full" }, lastActivityAt: old },
  });
  await clean(transcript);
  expect(await exists(`${transcript}.langsmith`)).toBe(true);
  expect(await exists(`${second}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
  expect(savedTurnMode(privacyPath, uuid, "turn")).toBe("full");
});

it("protects current sessions, live upload owners, and quiet native writer locks", async () => {
  const transcript = await fixture();
  const current = await fixture(currentId);
  const uploading = await fixture(uuid);
  const parentTranscript = await fixture("00000000-0000-0000-0000-000000000005");
  const uploadLock = `${uploading}.langsmith.lock`;
  await directory(uploadLock);
  await write(
    path.join(uploadLock, "owner.json"),
    JSON.stringify({ pid: process.pid, token: "live" }),
  );
  await fs.utimes(uploadLock, old / 1000, old / 1000);
  const nativeDirectory = path.join(home, ".codex", "thread-writer-locks");
  await directory(nativeDirectory);
  await write(path.join(nativeDirectory, `${id}.lock`));
  await write(path.join(nativeDirectory, "00000000-0000-0000-0000-000000000004.lock"));
  await policy(
    Object.fromEntries(
      [id, currentId, uuid, "00000000-0000-0000-0000-000000000004"].map((key) => [
        key,
        { turns: { turn: "full" }, lastActivityAt: old },
      ]),
    ),
  );
  await cleanupStalePluginState(parentTranscript, currentId, { now, privacyPath });
  for (const value of [transcript, current, uploading, parentTranscript])
    expect(await exists(`${value}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
  expect(savedTurnMode(privacyPath, "00000000-0000-0000-0000-000000000004", "turn")).toBe("full");
});

it("rechecks activity after acquiring the guards before pruning or deleting", async () => {
  const transcript = await fixture();
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
  const realLock = locks.tryWithFileLock;
  vi.spyOn(locks, "tryWithFileLock").mockImplementation(async (file, action) => {
    if (file.endsWith(".langsmith.lock")) await fs.utimes(transcript, now / 1000, now / 1000);
    return realLock(file, action);
  });
  await clean(transcript);
  expect(await exists(`${transcript}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
});

it("keeps symlink and unknown captures intact without pruning their privacy", async () => {
  const transcript = await fixture();
  const capture = turnCaptureDirectory(transcript, "turn");
  await directory(capture);
  const outside = path.join(home, "outside");
  await write(outside, "untouched");
  await fs.symlink(outside, path.join(capture, "transcript.jsonl"));
  createdFiles.push(path.join(capture, "transcript.jsonl"));
  await write(path.join(capture, "unknown-file"));
  await fs.utimes(capture, old / 1000, old / 1000);
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
  await clean(transcript);
  expect(await fs.readFile(outside, "utf8")).toBe("untouched");
  expect(await exists(`${transcript}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
});

it("retains handled markers when privacy cannot be saved", async () => {
  const transcript = await fixture();
  await write(privacyPath, "corrupt");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await clean(transcript);
  expect(await exists(`${transcript}.langsmith`)).toBe(true);
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
  const realOpen = fs.open;
  vi.spyOn(fs, "open").mockImplementation(async (file, flags, mode) => {
    const handle = await realOpen(file, flags, mode);
    if (file === path.dirname(privacyPath))
      vi.spyOn(handle, "sync").mockRejectedValue(new Error("durability unavailable"));
    return handle;
  });
  await clean(transcript);
  expect(await exists(`${transcript}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("metadata");
});

it("recovers stale plugin locks while keeping inherited off and resumed history private", async () => {
  const transcript = await fixture();
  const second = await fixture(uuid);
  const lock = `${transcript}.langsmith.lock`;
  await directory(lock);
  await write(path.join(lock, "owner.json"), JSON.stringify({ pid: 2147483647, token: "dead" }));
  await fs.utimes(lock, old / 1000, old / 1000);
  await policy({
    [id]: { preference: "full", inherited: "off", turns: { turn: "off" }, lastActivityAt: old },
    [uuid]: { preference: "full", turns: { turn: "full" }, lastActivityAt: old },
    orphan: { preference: "metadata", turns: { turn: "full" }, lastActivityAt: old },
  });
  await clean(transcript);
  expect(await exists(`${transcript}.langsmith`)).toBe(false);
  expect(await exists(lock)).toBe(false);
  expect(await exists(`${second}.langsmith`)).toBe(false);
  await submitPreference(privacyPath, id, "new", true);
  await submitPreference(privacyPath, uuid, "new", true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("off");
  expect(savedTurnMode(privacyPath, id, "new")).toBe("off");
  expect(savedTurnMode(privacyPath, uuid, "turn")).toBe("metadata");
  expect(savedTurnMode(privacyPath, uuid, "new")).toBe("full");
  expect(savedTurnMode(privacyPath, "orphan", "turn")).toBe("metadata");
});

it("expires legacy orphan evidence only after observing two hours of inactivity", async () => {
  const transcript = await fixture();
  vi.spyOn(Date, "now").mockReturnValue(now);
  await policy({ legacy: { preference: "metadata", turns: { turn: "full" } } });
  await clean(transcript);
  expect(savedTurnMode(privacyPath, "legacy", "turn")).toBe("full");
  await cleanupStalePluginState(transcript, id, {
    privacyPath,
    now: now + STALE_PLUGIN_TTL_MS + 1,
  });
  expect(savedTurnMode(privacyPath, "legacy", "turn")).toBe("metadata");
  expect(JSON.parse(await fs.readFile(privacyPath, "utf8")).threads.legacy.preference).toBe(
    "metadata",
  );
});

it("removes abandoned privacy temp files while preserving live writers and recent files", async () => {
  const transcript = await fixture();
  const deadTemp = `${privacyPath}.2147483647.${uuid}.tmp`;
  const liveTemp = `${privacyPath}.${process.pid}.${uuid}.tmp`;
  const recentTemp = `${privacyPath}.2147483646.${uuid}.tmp`;
  await write(deadTemp);
  await write(liveTemp);
  await write(recentTemp, "recent", now);
  await clean(transcript);
  expect(await exists(deadTemp)).toBe(false);
  expect(await exists(liveTemp)).toBe(true);
  expect(await exists(recentTemp)).toBe(true);
  expect(await exists(privacyPath)).toBe(false);
});

it("keeps privacy when another rollout of the same session becomes active", async () => {
  const first = await fixture();
  const nested = path.join(sessions, "z-nested");
  await directory(nested);
  const other = path.join(nested, `rollout-2026-01-02T00-00-00-${id}.jsonl`);
  await write(other, `${JSON.stringify({ type: "session_meta", payload: { id } })}\n`);
  await write(`${other}.langsmith`);
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
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
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
});

it("skips cleanup when a new rollout appears after the initial scan", async () => {
  const first = await fixture();
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
  const newRollout = transcript("2026-01-02T00-00-00", id);
  const realLock = locks.tryWithFileLock;
  let rolloutCreated = false;
  vi.spyOn(locks, "tryWithFileLock").mockImplementation(async (file, action) => {
    if (!rolloutCreated && file.startsWith(first)) {
      rolloutCreated = true;
      await write(newRollout, `${JSON.stringify({ type: "session_meta", payload: { id } })}\n`);
      await write(`${newRollout}.langsmith`);
    }
    return realLock(file, action);
  });
  await clean();
  expect(rolloutCreated).toBe(true);
  expect(await exists(`${first}.langsmith`)).toBe(true);
  expect(await exists(`${newRollout}.langsmith`)).toBe(true);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
});

it("preserves privacy if a known rollout changes session identity", async () => {
  const first = transcript("2026-01-01T00-00-00", "without-uuid");
  await write(first, `${JSON.stringify({ type: "session_meta", payload: { id } })}\n`);
  await write(`${first}.langsmith`);
  await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
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
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
});

it.skipIf(process.platform === "win32")(
  "fails closed on native transcript FIFOs without blocking cleanup",
  async () => {
    const file = transcript("2026-01-01T00-00-00", id);
    execFileSync("mkfifo", [file]);
    createdFiles.push(file);
    await write(`${file}.langsmith`);
    await policy({ [id]: { turns: { turn: "full" }, lastActivityAt: old } });
    await clean();
    expect(await exists(`${file}.langsmith`)).toBe(true);
    expect(savedTurnMode(privacyPath, id, "turn")).toBe("full");
  },
  2000,
);

it("removes only old recovery files with known dead owners", async () => {
  const dead = transcript("2026-01-01T00-00-00", id);
  const live = transcript("2026-01-01T00-00-00", liveId);
  const unknown = transcript("2026-01-01T00-00-00", unknownId);
  for (const [file, sessionId] of [
    [dead, id],
    [live, liveId],
    [unknown, unknownId],
  ]) {
    await write(file, `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`);
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
    [id]: { turns: { turn: "full" }, lastActivityAt: old },
    [liveId]: { turns: { turn: "full" }, lastActivityAt: old },
    [unknownId]: { turns: { turn: "full" }, lastActivityAt: old },
  });
  await clean();
  expect(await exists(`${dead}.langsmith`)).toBe(false);
  for (const file of deadRecoveryFiles) expect(await exists(file)).toBe(false);
  expect(savedTurnMode(privacyPath, id, "turn")).toBe("metadata");
  expect(await exists(`${live}.langsmith`)).toBe(true);
  expect(await exists(liveRecovery)).toBe(true);
  expect(savedTurnMode(privacyPath, liveId, "turn")).toBe("full");
  expect(await exists(`${unknown}.langsmith`)).toBe(true);
  expect(await exists(unknownRecovery)).toBe(true);
  expect(savedTurnMode(privacyPath, unknownId, "turn")).toBe("full");
});

it("prunes compressed-only and orphan evidence without replaying old turns on resume", async () => {
  const compressed = transcript("2026-01-01T00-00-00", uuid);
  const missing = transcript("2026-01-01T00-00-00", "00000000-0000-0000-0000-000000000004");
  await write(`${compressed}.zst`, "compressed original");
  await write(`${compressed}.langsmith`);
  await write(`${missing}.langsmith`);
  await policy({
    [uuid]: { preference: "full", turns: { old: "full" }, lastActivityAt: old },
    ["00000000-0000-0000-0000-000000000004"]: {
      preference: "full",
      turns: { old: "full" },
      lastActivityAt: old,
    },
  });
  await clean();
  expect(await fs.readFile(`${compressed}.zst`, "utf8")).toBe("compressed original");
  expect(await exists(`${compressed}.langsmith`)).toBe(false);
  expect(await exists(missing)).toBe(false);
  expect(await exists(`${missing}.langsmith`)).toBe(false);
  for (const sessionId of [uuid, "00000000-0000-0000-0000-000000000004"]) {
    expect(savedTurnMode(privacyPath, sessionId, "old")).toBe("metadata");
    await submitPreference(privacyPath, sessionId, "resumed", true);
    expect(savedTurnMode(privacyPath, sessionId, "old")).toBe("metadata");
    expect(savedTurnMode(privacyPath, sessionId, "resumed")).toBe("full");
  }
});
