import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  FILE_LOCK_INITIALIZING_MS,
  FILE_LOCK_OWNER_FILENAME,
  FILE_LOCK_RETRY_MS,
} from "../constants.js";
import type {
  FileLockOwner,
  FileLockOwnerReadResult,
  FileLockRecoveryOwnerState,
  TryFileLockResult,
} from "../models/file-lock.js";

async function readOwner(file: string): Promise<FileLockOwnerReadResult> {
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    throw error;
  }

  if (stat.isSymbolicLink() || !stat.isFile()) return { status: "unsafe" };

  let handle: fs.FileHandle;
  try {
    const flags =
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0);
    handle = await fs.open(file, flags);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { status: "missing" };
    if (code === "ELOOP") return { status: "unsafe" };
    throw error;
  }

  try {
    const openedStat = await handle.stat();
    if (!openedStat.isFile()) return { status: "unsafe" };
    const contents = await handle.readFile("utf8");
    let value: unknown;
    try {
      value = JSON.parse(contents);
    } catch {
      return { status: "malformed" };
    }
    if (
      value != null &&
      typeof value === "object" &&
      Number.isInteger((value as FileLockOwner).pid) &&
      (value as FileLockOwner).pid > 0 &&
      typeof (value as FileLockOwner).token === "string"
    ) {
      return {
        status: "valid",
        owner: {
          pid: (value as FileLockOwner).pid,
          token: (value as FileLockOwner).token,
        },
      };
    }
    return { status: "malformed" };
  } finally {
    await handle.close();
  }
}

export function processIsAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function fileLockRecoveryOwnerState(
  recoveryFile: string,
): Promise<FileLockRecoveryOwnerState> {
  const owner = await readOwner(recoveryFile);
  if (owner.status !== "valid") return "unknown";
  return processIsAlive(owner.owner.pid) ? "live" : "dead";
}

export async function fileLockOwnerIsLive(lockPath: string): Promise<boolean> {
  try {
    const lock = await fs.lstat(lockPath);
    if (lock.isSymbolicLink() || !lock.isDirectory()) return true;
    const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
    const owner = await readOwner(ownerFile);
    if (owner.status === "valid") return processIsAlive(owner.owner.pid);
    return owner.status !== "missing";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    return true;
  }
}

async function lockDirectoryIsUnsafe(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(lockPath);
    return stat.isSymbolicLink() || !stat.isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function lockIsOld(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.lstat(lockPath);
    if (stat.isSymbolicLink()) return false;
    return Date.now() - stat.mtimeMs >= FILE_LOCK_INITIALIZING_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function recoverLock(lockPath: string, observedOwner: FileLockOwner) {
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const recoveryPath = `${lockPath}.recover-${observedOwner.pid}`;
  if (await lockDirectoryIsUnsafe(lockPath)) return false;

  let recovery: fs.FileHandle;
  try {
    recovery = await fs.open(recoveryPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const recoveryOwner = await readOwner(recoveryPath);
    if (
      (recoveryOwner.status === "valid" && !processIsAlive(recoveryOwner.owner.pid)) ||
      ((recoveryOwner.status === "missing" || recoveryOwner.status === "malformed") &&
        (await lockIsOld(recoveryPath)))
    ) {
      await fs.unlink(recoveryPath).catch((unlinkError: NodeJS.ErrnoException) => {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      });
    }
    return false;
  }

  try {
    await recovery.writeFile(JSON.stringify({ pid: process.pid, token: randomUUID() }), "utf8");
    if (await lockDirectoryIsUnsafe(lockPath)) return false;
    const currentOwner = await readOwner(ownerFile);
    const sameOwner =
      currentOwner.status === "valid" &&
      currentOwner.owner.pid === observedOwner.pid &&
      currentOwner.owner.token === observedOwner.token;
    if (sameOwner && !processIsAlive(currentOwner.owner.pid)) {
      if (await lockDirectoryIsUnsafe(lockPath)) return false;
      await fs.unlink(ownerFile);
      await fs.rmdir(lockPath);
      return true;
    }
    if (
      (currentOwner.status === "missing" || currentOwner.status === "malformed") &&
      observedOwner.token === "invalid" &&
      (await lockIsOld(lockPath))
    ) {
      if (await lockDirectoryIsUnsafe(lockPath)) return false;
      if (currentOwner.status === "malformed") await fs.unlink(ownerFile);
      try {
        await fs.rmdir(lockPath);
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOTEMPTY" || code === "EEXIST" || code === "ENOTDIR") return false;
        throw error;
      }
    }
    return false;
  } finally {
    await recovery.close();
    await fs.unlink(recoveryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function removeLockIfOwned(lockPath: string, token: string): Promise<void> {
  if (await lockDirectoryIsUnsafe(lockPath)) return;
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const owner = await readOwner(ownerFile);
  if (owner.status !== "valid" || owner.owner.pid !== process.pid || owner.owner.token !== token) {
    return;
  }
  if (await lockDirectoryIsUnsafe(lockPath)) return;
  await fs.unlink(ownerFile);
  await fs.rmdir(lockPath);
}

export async function withFileLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const token = randomUUID();
  while (true) {
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      try {
        await fs.writeFile(ownerFile, JSON.stringify({ pid: process.pid, token }), {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        await fs.rmdir(lockPath).catch(() => undefined);
        throw error;
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await lockDirectoryIsUnsafe(lockPath)) throw new Error("Unsafe file lock directory");
      const ownerRead = await readOwner(ownerFile);
      if (ownerRead.status === "unsafe") throw new Error("Unsafe file lock owner record");
      if (ownerRead.status === "missing" || ownerRead.status === "malformed") {
        if (await lockIsOld(lockPath)) await recoverLock(lockPath, { pid: 0, token: "invalid" });
      } else if (!processIsAlive(ownerRead.owner.pid)) {
        await recoverLock(lockPath, ownerRead.owner);
      }
      await delay(FILE_LOCK_RETRY_MS);
    }
  }

  try {
    return await action();
  } finally {
    await removeLockIfOwned(lockPath, token);
  }
}

export async function tryWithFileLock<T>(
  lockPath: string,
  action: () => Promise<T>,
): Promise<TryFileLockResult<T>> {
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const token = randomUUID();
  async function acquire(): Promise<boolean> {
    try {
      await fs.mkdir(lockPath, { mode: 0o700 });
      try {
        await fs.writeFile(ownerFile, JSON.stringify({ pid: process.pid, token }), {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        await fs.rmdir(lockPath).catch(() => undefined);
        throw error;
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  }

  if (!(await acquire())) {
    if (await lockDirectoryIsUnsafe(lockPath)) return { acquired: false };
    const ownerRead = await readOwner(ownerFile);
    if (ownerRead.status === "unsafe") return { acquired: false };
    if (ownerRead.status === "missing" || ownerRead.status === "malformed") {
      if (await lockIsOld(lockPath)) await recoverLock(lockPath, { pid: 0, token: "invalid" });
    } else if (!processIsAlive(ownerRead.owner.pid)) {
      await recoverLock(lockPath, ownerRead.owner);
    }
    if (await lockDirectoryIsUnsafe(lockPath)) return { acquired: false };
    if (!(await acquire())) return { acquired: false };
  }

  try {
    return { acquired: true, value: await action() };
  } finally {
    await removeLockIfOwned(lockPath, token);
  }
}
