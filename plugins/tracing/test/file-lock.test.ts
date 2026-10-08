import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { FILE_LOCK_OWNER_FILENAME } from "../src/constants.js";
import { fileLockOwnerIsLive, tryWithFileLock } from "../src/utils/fileLock.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function unlinkIfPresent(file: string) {
  try {
    await fs.unlink(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function rmdirIfPresent(directory: string) {
  try {
    await fs.rmdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

it("leaves a live lock owned and returns without waiting", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-live-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const entered = deferred<void>();
  const release = deferred<void>();
  let holderReleased = false;
  let contenderRanWhileHeld = false;
  const holder = tryWithFileLock(lockPath, async () => {
    entered.resolve();
    await release.promise;
    return "held";
  });

  try {
    await entered.promise;
    const ownerBefore = await fs.readFile(ownerFile, "utf8");
    const contender = tryWithFileLock(lockPath, async () => {
      contenderRanWhileHeld = !holderReleased;
      return "stolen";
    });
    const timer = new AbortController();
    const observed = await Promise.race([
      contender,
      delay(300, undefined, { signal: timer.signal }).catch(() => undefined),
    ]);
    timer.abort();
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
    await unlinkIfPresent(ownerFile);
    await rmdirIfPresent(lockPath);
    await rmdirIfPresent(root);
  }
});

it("lets only one concurrent cleaner hold the lock", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-contenders-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const entered = deferred<void>();
  const release = deferred<void>();
  const losersSettled = deferred<void>();
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
    const timer = new AbortController();
    const settled = await Promise.race([
      losersSettled.promise.then(() => true),
      delay(500, false, { signal: timer.signal }),
    ]);
    timer.abort();
    release.resolve();
    const results = await Promise.all(calls);

    expect(settled).toBe(true);
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(actionCount).toBe(1);
  } finally {
    release.resolve();
    await Promise.all(calls);
    await unlinkIfPresent(ownerFile);
    await rmdirIfPresent(lockPath);
    await rmdirIfPresent(root);
  }
});

it("recovers a lock whose recorded owner is dead", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-dead-owner-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  let actionCount = 0;

  try {
    await fs.mkdir(lockPath);
    await fs.writeFile(ownerFile, JSON.stringify({ pid: 2_147_483_647, token: "dead" }));
    const result = await tryWithFileLock(lockPath, async () => {
      actionCount += 1;
      return "recovered";
    });

    expect(result).toEqual({ acquired: true, value: "recovered" });
    expect(actionCount).toBe(1);
  } finally {
    await unlinkIfPresent(ownerFile);
    await rmdirIfPresent(lockPath);
    await rmdirIfPresent(root);
  }
});

it("recovers an abandoned lock with no owner record", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-abandoned-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);

  try {
    await fs.mkdir(lockPath);
    const stale = new Date(Date.now() - 5000);
    await fs.utimes(lockPath, stale, stale);
    const result = await tryWithFileLock(lockPath, async () => "recovered");

    expect(result).toEqual({ acquired: true, value: "recovered" });
  } finally {
    await unlinkIfPresent(ownerFile);
    await rmdirIfPresent(lockPath);
    await rmdirIfPresent(root);
  }
});

it("keeps extra files when a stale owner record is malformed", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-malformed-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const unrelatedFile = path.join(lockPath, "unrelated.json");

  try {
    await fs.mkdir(lockPath);
    await fs.writeFile(ownerFile, "{bad json");
    await fs.writeFile(unrelatedFile, "keep");
    const stale = new Date(Date.now() - 5000);
    await fs.utimes(lockPath, stale, stale);
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
  } finally {
    await unlinkIfPresent(ownerFile);
    await unlinkIfPresent(unrelatedFile);
    await rmdirIfPresent(lockPath);
    await rmdirIfPresent(root);
  }
});

it("fails closed on a symlinked owner record without reading its target", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-owner-link-"));
  const lockPath = path.join(root, "cleanup.lock");
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const targetFile = path.join(root, "owner-target.json");
  const targetContents = JSON.stringify({ pid: 2_147_483_647, token: "dead" });

  try {
    await fs.mkdir(lockPath);
    await fs.writeFile(targetFile, targetContents);
    await fs.symlink(targetFile, ownerFile);
    expect(await fileLockOwnerIsLive(lockPath)).toBe(true);
    const result = await tryWithFileLock(lockPath, async () => "recovered");

    expect(result).toEqual({ acquired: false });
    expect(await fs.readFile(targetFile, "utf8")).toBe(targetContents);
  } finally {
    await unlinkIfPresent(ownerFile);
    await rmdirIfPresent(lockPath);
    await unlinkIfPresent(targetFile);
    await rmdirIfPresent(root);
  }
});

it("does not remove an owner file through a symlinked lock directory", async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), "file-lock-directory-link-"));
  const lockPath = path.join(root, "cleanup.lock");
  const targetDirectory = path.join(root, "unrelated-directory");
  const targetOwnerFile = path.join(targetDirectory, FILE_LOCK_OWNER_FILENAME);
  const targetContents = JSON.stringify({ pid: 2_147_483_647, token: "dead" });
  let result: { acquired: false } | { acquired: true; value: string } | undefined;
  let lockError: unknown;

  try {
    await fs.mkdir(targetDirectory);
    await fs.writeFile(targetOwnerFile, targetContents);
    await fs.symlink(targetDirectory, lockPath, "dir");
    expect(await fileLockOwnerIsLive(lockPath)).toBe(true);
    try {
      result = await tryWithFileLock(lockPath, async () => "stolen");
    } catch (error) {
      lockError = error;
    }

    const targetAfter = await fs.readFile(targetOwnerFile, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    expect(targetAfter).toBe(targetContents);
    expect(lockError).toBeUndefined();
    expect(result).toEqual({ acquired: false });
  } finally {
    await unlinkIfPresent(lockPath);
    await unlinkIfPresent(targetOwnerFile);
    await rmdirIfPresent(targetDirectory);
    await rmdirIfPresent(root);
  }
});
