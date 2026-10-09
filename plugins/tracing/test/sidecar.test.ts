import "./utils/mock-memfs.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";

import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TRACE_UPLOAD_TOPOLOGY_MAX_BYTES } from "../src/constants.js";
import {
  loadTurnRunTopology,
  loadTurnStates,
  markTurnHandled,
  markTurnRunTopology,
  withRolloutLock,
} from "../src/trace-delivery-store.js";

const ROLLOUT_FILE = "/workspace/repo/rollout.jsonl";

beforeEach(() => {
  vol.reset();
  vol.mkdirSync("/workspace/repo", { recursive: true });
});
afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
});

it("reads legacy turn markers", async () => {
  vol.fromJSON({
    [`${ROLLOUT_FILE}.langsmith`]:
      ["00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000001"].join("\n") +
      "\n",
  });

  await expect(loadTurnStates(ROLLOUT_FILE)).resolves.toEqual(
    new Map([
      ["00000000-0000-0000-0000-000000000000", "uploaded"],
      ["00000000-0000-0000-0000-000000000001", "uploaded"],
    ]),
  );
});

it("keeps uploaded turns separate from intentional skips", async () => {
  vol.fromJSON({ [ROLLOUT_FILE]: "" });

  await markTurnHandled(ROLLOUT_FILE, "uploaded-turn", "uploaded");
  await markTurnHandled(ROLLOUT_FILE, "backlog-turn", "backlog");
  await markTurnHandled(ROLLOUT_FILE, "muted-turn", "off");

  await expect(loadTurnStates(ROLLOUT_FILE)).resolves.toEqual(
    new Map([
      ["uploaded-turn", "uploaded"],
      ["backlog-turn", "backlog"],
      ["muted-turn", "off"],
    ]),
  );
});

it("stores bounded topology without exposing the turn id in its file path", async () => {
  const turnId = "../../private/turn?value=Ω";
  const topology = {
    parentRunId: null,
    traceId: "00000000-0000-0000-0000-000000000000",
    dottedOrder: "00000000-0000-0000-0000-000000000000.1",
    executionOrder: 1,
    childExecutionOrder: 1,
  };

  await markTurnRunTopology(ROLLOUT_FILE, turnId, topology);

  const files = await fs.readdir("/workspace/repo");
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^rollout\.jsonl\.langsmith-topology-[a-f0-9]{64}\.json$/);
  expect(files[0]).not.toContain(encodeURIComponent(turnId));
  const file = path.join("/workspace/repo", files[0]);
  const checkpoint = await fs.readFile(file, "utf8");
  expect(Buffer.byteLength(checkpoint, "utf8")).toBeLessThanOrEqual(
    TRACE_UPLOAD_TOPOLOGY_MAX_BYTES,
  );
  expect(JSON.parse(checkpoint)).toEqual({ topology });
  await expect(loadTurnRunTopology(ROLLOUT_FILE, turnId)).resolves.toEqual(topology);
  await fs.writeFile(file, "{invalid JSON}\n{}\n");
  await expect(loadTurnRunTopology(ROLLOUT_FILE, turnId)).resolves.toBeUndefined();
  await fs.writeFile(file, `not-json\n${checkpoint}\nnot-json\n`);
  await expect(loadTurnRunTopology(ROLLOUT_FILE, turnId)).resolves.toEqual(topology);

  const handle = await fs.open(file, "r");
  const read = handle.read.bind(handle);
  const open = vi.spyOn(fs, "open").mockResolvedValueOnce(handle);
  const partialRead = vi
    .spyOn(handle, "read")
    .mockImplementation(((buffer: Buffer, offset: number, length: number, position: number) =>
      read(buffer, offset, Math.min(length, 7), position)) as typeof handle.read);
  try {
    await expect(loadTurnRunTopology(ROLLOUT_FILE, turnId)).resolves.toEqual(topology);
    expect(partialRead.mock.calls.length).toBeGreaterThan(1);
  } finally {
    partialRead.mockRestore();
    open.mockRestore();
  }
});

it("bounds topology reads even when an earlier size check would be stale", async () => {
  await markTurnRunTopology(ROLLOUT_FILE, "turn-id", {
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
    await expect(loadTurnRunTopology(ROLLOUT_FILE, "turn-id")).rejects.toThrow(
      "exceeds its size limit",
    );
  } finally {
    stat.mockRestore();
  }
});

it("rejects an oversized topology before writing it", async () => {
  const topology = {
    parentRunId: null,
    traceId: "trace",
    dottedOrder: "x".repeat(TRACE_UPLOAD_TOPOLOGY_MAX_BYTES),
    executionOrder: 1,
    childExecutionOrder: 1,
  };

  await expect(markTurnRunTopology(ROLLOUT_FILE, "turn-id", topology)).rejects.toThrow(
    "exceeds its size limit",
  );
  await expect(fs.readdir("/workspace/repo")).resolves.toEqual([]);
});

it("serializes overlapping turns in one rollout", async () => {
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

  const first = withRolloutLock(ROLLOUT_FILE, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    enter();
    await held;
    active -= 1;
  });
  await entered;
  const second = withRolloutLock(ROLLOUT_FILE, async () => {
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
  const lockPath = `${ROLLOUT_FILE}.langsmith.lock`;
  await fs.mkdir(lockPath);
  const old = new Date(Date.now() - 5000);
  await fs.utimes(lockPath, old, old);
  let called = false;

  await withRolloutLock(ROLLOUT_FILE, async () => {
    called = true;
  });

  expect(called).toBe(true);
  await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("recovers a stale lock with a partially written owner file", async () => {
  const lockPath = `${ROLLOUT_FILE}.langsmith.lock`;
  await fs.mkdir(lockPath);
  await fs.writeFile(path.join(lockPath, "owner.json"), '{"pid":');
  const old = new Date(Date.now() - 5000);
  await fs.utimes(lockPath, old, old);

  await withRolloutLock(ROLLOUT_FILE, async () => undefined);

  await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
});
