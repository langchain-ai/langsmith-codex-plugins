import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  FILE_LOCK_INITIALIZING_MS,
  FILE_LOCK_OWNER_FILENAME,
  FILE_LOCK_RETRY_MS,
} from "../constants.js";
import type { FileLockOwner } from "../models/file-lock.js";

async function readOwner(file: string): Promise<FileLockOwner | undefined> {
  let contents: string;
  try {
    contents = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const value = JSON.parse(contents);
    if (
      value != null &&
      typeof value === "object" &&
      Number.isInteger(value.pid) &&
      value.pid > 0 &&
      typeof value.token === "string"
    ) {
      return { pid: value.pid as number, token: value.token as string };
    }
  } catch {}
  return undefined;
}

function processIsAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function lockIsOld(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    return Date.now() - stat.mtimeMs >= FILE_LOCK_INITIALIZING_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function recoverLock(lockPath: string, observedOwner: FileLockOwner) {
  const ownerFile = path.join(lockPath, FILE_LOCK_OWNER_FILENAME);
  const recoveryPath = `${lockPath}.recover-${observedOwner.pid}`;
  let recovery: fs.FileHandle;
  try {
    recovery = await fs.open(recoveryPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const recoveryOwner = await readOwner(recoveryPath);
    if (
      (recoveryOwner && !processIsAlive(recoveryOwner.pid)) ||
      (recoveryOwner == null && (await lockIsOld(recoveryPath)))
    ) {
      await fs.unlink(recoveryPath).catch((unlinkError: NodeJS.ErrnoException) => {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      });
    }
    return false;
  }

  try {
    await recovery.writeFile(JSON.stringify({ pid: process.pid, token: randomUUID() }), "utf8");
    const currentOwner = await readOwner(ownerFile);
    const sameOwner =
      currentOwner?.pid === observedOwner.pid && currentOwner?.token === observedOwner.token;
    if (sameOwner && !processIsAlive(currentOwner.pid)) {
      await fs.unlink(ownerFile);
      await fs.rmdir(lockPath);
      return true;
    }
    if (currentOwner == null && observedOwner.token === "invalid" && (await lockIsOld(lockPath))) {
      await fs.unlink(ownerFile).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      await fs.rmdir(lockPath);
      return true;
    }
    return false;
  } finally {
    await recovery.close();
    await fs.unlink(recoveryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
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
      const owner = await readOwner(ownerFile);
      if (owner == null) {
        if (await lockIsOld(lockPath)) await recoverLock(lockPath, { pid: 0, token: "invalid" });
      } else if (!processIsAlive(owner.pid)) {
        await recoverLock(lockPath, owner);
      }
      await delay(FILE_LOCK_RETRY_MS);
    }
  }

  try {
    return await action();
  } finally {
    const owner = await readOwner(ownerFile);
    if (owner?.pid === process.pid && owner.token === token) {
      await fs.unlink(ownerFile);
      await fs.rmdir(lockPath);
    }
  }
}
