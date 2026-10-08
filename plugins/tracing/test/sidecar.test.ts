import * as path from "node:path";
import * as fs from "node:fs/promises";

import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TRACE_UPLOAD_TOPOLOGY_MAX_BYTES } from "../src/constants.js";
import {
  loadTurnRunTopology,
  loadTurnStates,
  loadUploadedTurnIds,
  markTurnHandled,
  markTurnRunTopology,
  markTurnUploaded,
  withRolloutLock,
} from "../src/sidecar.js";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

beforeEach(() => {
  vol.reset();
  vol.mkdirSync("/workspace/repo", { recursive: true });
});
afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
});

it("load uploaded turn ids", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");

  vol.fromJSON({
    [path.join(rolloutFile + ".langsmith")]:
      [
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ].join("\n") + "\n",
  });

  await expect(loadUploadedTurnIds(rolloutFile)).resolves.toEqual(
    new Set([
      "00000000-0000-0000-0000-000000000000",
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ]),
  );
});

it("mark turn uploaded", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  vol.fromJSON({ [path.join("/workspace/repo/unknown.jsonl")]: "" });

  await expect(
    markTurnUploaded(rolloutFile, "00000000-0000-0000-0000-000000000000"),
  ).resolves.toBeTruthy();

  await expect(
    markTurnUploaded(rolloutFile, "00000000-0000-0000-0000-000000000000"),
  ).resolves.toBeTruthy();

  await expect(
    markTurnUploaded(rolloutFile, "00000000-0000-0000-0000-000000000001"),
  ).resolves.toBeTruthy();

  await expect(loadUploadedTurnIds(rolloutFile)).resolves.toEqual(
    new Set(["00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000001"]),
  );
});

it("keeps uploaded turns separate from intentional skips", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  vol.fromJSON({ [rolloutFile]: "" });

  await markTurnHandled(rolloutFile, "uploaded-turn", "uploaded");
  await markTurnHandled(rolloutFile, "backlog-turn", "backlog");
  await markTurnHandled(rolloutFile, "muted-turn", "off");

  await expect(loadTurnStates(rolloutFile)).resolves.toEqual(
    new Map([
      ["uploaded-turn", "uploaded"],
      ["backlog-turn", "backlog"],
      ["muted-turn", "off"],
    ]),
  );
  await expect(loadUploadedTurnIds(rolloutFile)).resolves.toEqual(new Set(["uploaded-turn"]));
});

it("stores bounded topology without exposing the turn id in its file path", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  const turnId = "../../private/turn?value=Ω";
  const topology = {
    parentRunId: null,
    traceId: "00000000-0000-0000-0000-000000000000",
    dottedOrder: "00000000-0000-0000-0000-000000000000.1",
    executionOrder: 1,
    childExecutionOrder: 1,
  };

  await markTurnRunTopology(rolloutFile, turnId, topology);

  const files = await fs.readdir("/workspace/repo");
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^rollout\.jsonl\.langsmith-topology-[a-f0-9]{64}\.json$/);
  expect(files[0]).not.toContain(encodeURIComponent(turnId));
  const checkpoint = await fs.readFile(path.join("/workspace/repo", files[0]), "utf8");
  expect(Buffer.byteLength(checkpoint, "utf8")).toBeLessThanOrEqual(
    TRACE_UPLOAD_TOPOLOGY_MAX_BYTES,
  );
  expect(JSON.parse(checkpoint)).toEqual({ topology });
  await expect(loadTurnRunTopology(rolloutFile, turnId)).resolves.toEqual(topology);

  const file = await fs.open(path.join("/workspace/repo", files[0]), "r");
  const read = file.read.bind(file);
  const open = vi.spyOn(fs, "open").mockResolvedValueOnce(file);
  const partialRead = vi
    .spyOn(file, "read")
    .mockImplementation(((buffer: Buffer, offset: number, length: number, position: number) =>
      read(buffer, offset, Math.min(length, 7), position)) as typeof file.read);
  try {
    await expect(loadTurnRunTopology(rolloutFile, turnId)).resolves.toEqual(topology);
    expect(partialRead.mock.calls.length).toBeGreaterThan(1);
  } finally {
    partialRead.mockRestore();
    open.mockRestore();
  }
});

it("bounds topology reads even when an earlier size check would be stale", async () => {
  const rolloutFile = "/workspace/repo/rollout.jsonl";
  await markTurnRunTopology(rolloutFile, "turn-id", {
    parentRunId: null,
    traceId: "trace",
    dottedOrder: "order",
    executionOrder: 1,
    childExecutionOrder: 1,
  });
  const [name] = await fs.readdir("/workspace/repo");
  const file = path.join("/workspace/repo", name);
  await fs.writeFile(file, " ".repeat(TRACE_UPLOAD_TOPOLOGY_MAX_BYTES + 1));
  const staleStat = { ...(await fs.stat(file)), size: 1 };
  const stat = vi.spyOn(fs, "stat").mockResolvedValue(staleStat);
  try {
    await expect(loadTurnRunTopology(rolloutFile, "turn-id")).rejects.toThrow(
      "exceeds its size limit",
    );
  } finally {
    stat.mockRestore();
  }
});

it("rejects an oversized topology before writing it", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  const topology = {
    parentRunId: null,
    traceId: "trace",
    dottedOrder: "x".repeat(TRACE_UPLOAD_TOPOLOGY_MAX_BYTES),
    executionOrder: 1,
    childExecutionOrder: 1,
  };

  await expect(markTurnRunTopology(rolloutFile, "turn-id", topology)).rejects.toThrow(
    "exceeds its size limit",
  );
  await expect(fs.readdir("/workspace/repo")).resolves.toEqual([]);
});

it("serializes overlapping turns in one rollout", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  let active = 0;
  let maximumActive = 0;
  let release: () => void = () => undefined;
  let enter: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });

  const first = withRolloutLock(rolloutFile, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    enter();
    await held;
    active -= 1;
  });
  await entered;
  const second = withRolloutLock(rolloutFile, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    active -= 1;
  });

  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(maximumActive).toBe(1);
  release();
  await Promise.all([first, second]);
  expect(maximumActive).toBe(1);
});

it("recovers an abandoned lock before its owner file was written", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  const lockPath = `${rolloutFile}.langsmith.lock`;
  await fs.mkdir(lockPath);
  const old = new Date(Date.now() - 5000);
  await fs.utimes(lockPath, old, old);
  let called = false;

  await withRolloutLock(rolloutFile, async () => {
    called = true;
  });

  expect(called).toBe(true);
  await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("recovers a stale lock with a partially written owner file", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  const lockPath = `${rolloutFile}.langsmith.lock`;
  await fs.mkdir(lockPath);
  await fs.writeFile(path.join(lockPath, "owner.json"), '{"pid":');
  const old = new Date(Date.now() - 5000);
  await fs.utimes(lockPath, old, old);

  await withRolloutLock(rolloutFile, async () => undefined);

  await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("recovers a lock whose owner process exited", async () => {
  const rolloutFile = path.join("/workspace/repo/rollout.jsonl");
  const lockPath = `${rolloutFile}.langsmith.lock`;
  await fs.mkdir(lockPath);
  await fs.writeFile(
    path.join(lockPath, "owner.json"),
    JSON.stringify({ pid: 2147483647, token: "exited-owner" }),
  );
  const kill = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
    if (pid === 2147483647) {
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    }
    return true;
  });

  try {
    await withRolloutLock(rolloutFile, async () => undefined);
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    kill.mockRestore();
  }
});
