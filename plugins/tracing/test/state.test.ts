import * as path from "node:path";
import { vol } from "memfs";
import { beforeEach, expect, it, vi } from "vitest";
import {
  enqueuePendingMode,
  getThreadMode,
  getTurnMode,
  linkThreadRoot,
  readTracingState,
  setThreadMode,
  snapshotCurrentTurnMode,
  snapshotTurnMode,
} from "../src/state.js";

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

const HOME = "/home/codex-user";
const FILE = path.join(HOME, ".codex", "langsmith-state.json");

beforeEach(() => vol.reset());

it("persists sticky root mode without using thread ids as filenames", () => {
  setThreadMode("root/thread", "metadata", HOME);
  linkThreadRoot("child/thread", "root/thread", HOME);
  expect(getThreadMode("child/thread", HOME)).toBe("metadata");
  expect(Object.keys(vol.toJSON())).toEqual([FILE]);
});

it("keeps explicit current turn modes immutable across later mode changes", () => {
  setThreadMode("root", "metadata", HOME);
  expect(snapshotCurrentTurnMode("root", "turn-1", HOME)).toBe("metadata");
  setThreadMode("root", "full", HOME);
  expect(snapshotCurrentTurnMode("root", "turn-1", HOME)).toBe("metadata");
  expect(snapshotCurrentTurnMode("root", "turn-2", HOME)).toBe("full");
});

it("fails closed without replacing malformed state and explicitly quarantines on recovery", () => {
  vol.fromJSON({ [FILE]: "not json" });
  expect(getThreadMode("root", HOME)).toBe("metadata");
  expect(() => enqueuePendingMode("root", HOME)).toThrow();
  expect(vol.readFileSync(FILE, "utf8")).toBe("not json");
  setThreadMode("root", "full", HOME);
  expect(readTracingState(HOME).malformed).toBe(false);
  expect(Object.keys(vol.toJSON()).some((name) => name.includes(".corrupt-"))).toBe(true);
});

it("recovers dead locks", () => {
  const lock = path.join(HOME, ".codex", "langsmith-state.lock");
  vol.fromJSON({
    [path.join(lock, "owner.json")]: JSON.stringify({ pid: 99999999, created: Date.now() }),
  });
  setThreadMode("root", "metadata", HOME);
  expect(getThreadMode("root", HOME)).toBe("metadata");
});

it("uses compatibility FIFO only as metadata markers and never backfills full", () => {
  setThreadMode("root", "full", HOME);
  enqueuePendingMode("root", HOME);
  enqueuePendingMode("root", HOME);
  expect(snapshotTurnMode("root", "stale", undefined, HOME)).toBe("metadata");
  expect(snapshotTurnMode("root", "new", undefined, HOME)).toBe("metadata");
  expect(snapshotTurnMode("root", "unmatched", undefined, HOME)).toBe("metadata");
});

it("defaults newly parsed turns to metadata after an off transition", () => {
  snapshotCurrentTurnMode("root", "before", HOME);
  setThreadMode("root", "metadata", HOME);
  expect(snapshotTurnMode("root", "after", undefined, HOME)).toBe("metadata");
  expect(getTurnMode("before", "root", HOME)).toBe("full");
});

it("conservatively keeps metadata mode when a root mapping migrates", () => {
  setThreadMode("child", "metadata", HOME);
  linkThreadRoot("child", "root", HOME);
  expect(getThreadMode("root", HOME)).toBe("metadata");
  expect(getThreadMode("child", HOME)).toBe("metadata");
});

it("prunes stale roots while retaining recent turn snapshots", () => {
  const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
  vol.fromJSON({
    [FILE]: JSON.stringify({
      version: 2,
      threads: { stale: { updatedAt: old } },
      turns: { old: { mode: "full", root: "stale", updatedAt: old } },
      roots: { child: { root: "stale", updatedAt: old } },
      pending: { stale: [{ createdAt: old }] },
    }),
  });
  setThreadMode("live", "metadata", HOME);
  const state = readTracingState(HOME).state;
  expect(state.threads.stale).toBeUndefined();
  expect(state.turns.old).toBeUndefined();
  expect(state.roots.child).toBeUndefined();
  expect(state.pending.stale).toBeUndefined();
});
