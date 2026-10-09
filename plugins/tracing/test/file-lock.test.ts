import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, expect, it } from "vitest";
import { FILE_LOCK_OWNER_FILENAME } from "../src/constants.js";
import { fileLockOwnerIsLive, tryWithFileLock, withFileLock } from "../src/utils/fileLock.js";

async function cleanDirectory(directory: string): Promise<void> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) await cleanDirectory(entryPath);
    else await fs.unlink(entryPath);
  }
  await fs.rmdir(directory);
}

let tempRoot: string;
let lockPath: string;
let ownerFile: string;

function tempPath(...parts: string[]): string {
  return path.join(tempRoot, ...parts);
}

async function createOldLock(ownerContents?: string, unrelatedFile?: string): Promise<void> {
  await fs.mkdir(lockPath);
  if (ownerContents !== undefined) await fs.writeFile(ownerFile, ownerContents);
  if (unrelatedFile !== undefined) await fs.writeFile(unrelatedFile, "keep");
  const stale = new Date(Date.now() - 5000);
  await fs.utimes(lockPath, stale, stale);
}

async function holdLock(acquire: (action: () => Promise<string>) => Promise<unknown>) {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const holder = acquire(async () => {
    entered.resolve();
    await release.promise;
    return "held";
  });
  await entered.promise;
  return { holder, release };
}

async function settleWithin<T>(promise: Promise<T>, milliseconds: number, fallback: T | undefined) {
  const timer = new AbortController();
  try {
    return await Promise.race([
      promise,
      delay(milliseconds, fallback, { signal: timer.signal }).catch(() => fallback),
    ]);
  } finally {
    timer.abort();
  }
}

async function expectSymlinkNotStolen(targetFile: string, targetContents: string) {
  expect(await fileLockOwnerIsLive(lockPath)).toBe(true);
  await expect(tryWithFileLock(lockPath, async () => "stolen")).resolves.toEqual({
    acquired: false,
  });
  expect(await fs.readFile(targetFile, "utf8")).toBe(targetContents);
}

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(tmpdir(), "file-lock-test-"));
  lockPath = tempPath("cleanup.lock");
  ownerFile = tempPath("cleanup.lock", FILE_LOCK_OWNER_FILENAME);
});

afterEach(async () => {
  await cleanDirectory(tempRoot);
});

it("leaves a live lock owned and returns without waiting", async () => {
  const { holder, release } = await holdLock((action) => tryWithFileLock(lockPath, action));
  let holderReleased = false;
  let contenderRanWhileHeld = false;

  try {
    const ownerBefore = await fs.readFile(ownerFile, "utf8");
    const contender = tryWithFileLock(lockPath, async () => {
      contenderRanWhileHeld = !holderReleased;
      return "stolen";
    });
    const observed = await settleWithin(contender, 300, undefined);
    const ownerWhileHeld = await fs.readFile(ownerFile, "utf8");
    holderReleased = true;
    release.resolve();
    await holder;
    await contender;

    expect(observed).toEqual({ acquired: false });
    expect(ownerWhileHeld).toBe(ownerBefore);
    expect(contenderRanWhileHeld).toBe(false);
  } finally {
    holderReleased = true;
    release.resolve();
    await holder;
  }
});

it("lets only one concurrent cleaner hold the lock", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const losersSettled = Promise.withResolvers<void>();
  let actionCount = 0;
  let loserCount = 0;
  const contenderCount = 8;
  const calls = Array.from({ length: contenderCount }, () =>
    tryWithFileLock(lockPath, async () => {
      actionCount += 1;
      entered.resolve();
      await release.promise;
      return "cleaned";
    }).then((result) => {
      if (!result.acquired) {
        loserCount += 1;
        if (loserCount === contenderCount - 1) losersSettled.resolve();
      }
      return result;
    }),
  );

  try {
    await entered.promise;
    const settled = await settleWithin(
      losersSettled.promise.then(() => true),
      500,
      false,
    );
    release.resolve();
    const results = await Promise.all(calls);

    expect(settled).toBe(true);
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(actionCount).toBe(1);
  } finally {
    release.resolve();
    await Promise.all(calls);
  }
});

it.each([
  {
    scenario: "its recorded owner is dead",
    prepare: async () => {
      await fs.mkdir(lockPath);
      await fs.writeFile(ownerFile, JSON.stringify({ pid: 2_147_483_647, token: "dead" }));
    },
  },
  { scenario: "its owner record was never written", prepare: () => createOldLock() },
])("recovers a lock when $scenario", async ({ prepare }) => {
  let actionCount = 0;
  await prepare();
  const result = await tryWithFileLock(lockPath, async () => {
    actionCount += 1;
    return "recovered";
  });

  expect(result).toEqual({ acquired: true, value: "recovered" });
  expect(actionCount).toBe(1);
});

it("keeps extra files when a stale owner record is malformed", async () => {
  const unrelatedFile = tempPath("cleanup.lock", "unrelated.json");

  await createOldLock("{bad json", unrelatedFile);
  expect(await fileLockOwnerIsLive(lockPath)).toBe(true);
  let acquired = false;
  let actionCount = 0;
  try {
    const result = await tryWithFileLock(lockPath, async () => {
      actionCount += 1;
      return "recovered";
    });
    acquired = result.acquired;
  } catch {
    acquired = false;
  }

  expect(acquired).toBe(false);
  expect(actionCount).toBe(0);
  expect(await fs.readFile(unrelatedFile, "utf8")).toBe("keep");
});

it("fails closed on a symlinked owner record without reading its target", async () => {
  const targetFile = tempPath("owner-target.json");
  const targetContents = JSON.stringify({ pid: 2_147_483_647, token: "dead" });

  await fs.mkdir(lockPath);
  await fs.writeFile(targetFile, targetContents);
  await fs.symlink(targetFile, ownerFile);
  await expectSymlinkNotStolen(targetFile, targetContents);
});

it("does not remove an owner file through a symlinked lock directory", async () => {
  const targetDirectory = tempPath("unrelated-directory");
  const targetOwnerFile = tempPath("unrelated-directory", FILE_LOCK_OWNER_FILENAME);
  const targetContents = JSON.stringify({ pid: 2_147_483_647, token: "dead" });

  await fs.mkdir(targetDirectory);
  await fs.writeFile(targetOwnerFile, targetContents);
  await fs.symlink(targetDirectory, lockPath, "dir");
  await expectSymlinkNotStolen(targetOwnerFile, targetContents);
});

it("reports an unrecoverable stale lock without removing unrelated files", async () => {
  const unrelatedFile = tempPath("cleanup.lock", "unrelated.json");
  let actionCount = 0;

  await createOldLock("{bad json", unrelatedFile);

  await expect(
    withFileLock(lockPath, async () => {
      actionCount += 1;
      return "recovered";
    }),
  ).rejects.toThrow("Timed out waiting for file lock");

  expect(actionCount).toBe(0);
  expect(await fs.readFile(unrelatedFile, "utf8")).toBe("keep");
  expect((await fs.stat(lockPath)).isDirectory()).toBe(true);
}, 10_000);

it("times out behind a live owner without stealing its lock", async () => {
  const { holder, release } = await holdLock((action) => withFileLock(lockPath, action));
  let contenderRan = false;

  try {
    const ownerBefore = await fs.readFile(ownerFile, "utf8");
    await expect(
      withFileLock(lockPath, async () => {
        contenderRan = true;
        return "stolen";
      }),
    ).rejects.toThrow("Timed out waiting for file lock");

    expect(contenderRan).toBe(false);
    expect(await fs.readFile(ownerFile, "utf8")).toBe(ownerBefore);
  } finally {
    release.resolve();
    await holder;
  }
}, 10_000);
