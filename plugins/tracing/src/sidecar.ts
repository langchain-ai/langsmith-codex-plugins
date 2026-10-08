import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  TRACE_UPLOAD_LOCK_INITIALIZING_MS,
  TRACE_UPLOAD_LOCK_RETRY_MS,
  TRACE_UPLOAD_TOPOLOGY_MAX_BYTES,
  TRACE_UPLOAD_TOPOLOGY_SUFFIX,
} from "./constants.js";
import type {
  RolloutLockOwner,
  TurnDeliveryState,
  TurnRunTopology,
} from "./models/trace-delivery.js";

async function readOwner(file: string): Promise<RolloutLockOwner | undefined> {
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
    return Date.now() - stat.mtimeMs >= TRACE_UPLOAD_LOCK_INITIALIZING_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function recoverLock(lockPath: string, observedOwner: RolloutLockOwner) {
  const ownerFile = path.join(lockPath, "owner.json");
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

export async function withRolloutLock<T>(
  rolloutFile: string,
  action: () => Promise<T>,
): Promise<T> {
  const lockPath = `${rolloutFile}.langsmith.lock`;
  const ownerFile = path.join(lockPath, "owner.json");
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
      await delay(TRACE_UPLOAD_LOCK_RETRY_MS);
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

export async function loadTurnStates(rolloutFile: string): Promise<Map<string, TurnDeliveryState>> {
  try {
    const data = await fs.readFile(`${rolloutFile}.langsmith`, "utf-8");
    const states = new Map<string, TurnDeliveryState>();
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const value = JSON.parse(line);
        if (
          value != null &&
          typeof value === "object" &&
          typeof value.turnId === "string" &&
          ["uploaded", "backlog", "off"].includes(value.state)
        ) {
          states.set(value.turnId, value.state);
          continue;
        }
      } catch {}
      states.set(line, "uploaded");
    }
    return states;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
}

export async function markTurnHandled(
  rolloutFile: string,
  turnId: string,
  state: TurnDeliveryState,
): Promise<void> {
  await fs.appendFile(
    `${rolloutFile}.langsmith`,
    `${JSON.stringify({ turnId, state })}\n`,
    "utf-8",
  );
}

export async function loadTurnRunTopology(
  rolloutFile: string,
  turnId: string,
): Promise<TurnRunTopology | undefined> {
  const topologyFile = topologyFilePath(rolloutFile, turnId);
  let contents: string;
  try {
    const file = await fs.open(topologyFile, "r");
    try {
      const buffer = Buffer.alloc(TRACE_UPLOAD_TOPOLOGY_MAX_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > TRACE_UPLOAD_TOPOLOGY_MAX_BYTES) {
        throw new Error("Trace upload topology checkpoint exceeds its size limit");
      }
      contents = buffer.toString("utf8", 0, length);
    } finally {
      await file.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  for (const line of contents.split("\n").filter(Boolean)) {
    try {
      const value = JSON.parse(line);
      const topology = value?.topology;
      if (
        topology != null &&
        (topology.parentRunId === null ||
          (typeof topology.parentRunId === "string" && topology.parentRunId.length <= 64)) &&
        typeof topology.traceId === "string" &&
        topology.traceId.length <= 64 &&
        typeof topology.dottedOrder === "string" &&
        topology.dottedOrder.length <= 2048 &&
        Number.isInteger(topology.executionOrder) &&
        topology.executionOrder > 0 &&
        Number.isInteger(topology.childExecutionOrder) &&
        topology.childExecutionOrder > 0
      ) {
        return topology as TurnRunTopology;
      }
    } catch {}
  }
  return undefined;
}

export async function markTurnRunTopology(
  rolloutFile: string,
  turnId: string,
  topology: TurnRunTopology,
): Promise<void> {
  const topologyFile = topologyFilePath(rolloutFile, turnId);
  const temporaryFile = `${topologyFile}.${randomUUID()}.tmp`;
  const contents = JSON.stringify({ topology });
  if (Buffer.byteLength(contents, "utf-8") > TRACE_UPLOAD_TOPOLOGY_MAX_BYTES) {
    throw new Error("Trace upload topology checkpoint exceeds its size limit");
  }
  try {
    await fs.writeFile(temporaryFile, contents, {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    await fs.rename(temporaryFile, topologyFile);
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
}

function topologyFilePath(rolloutFile: string, turnId: string) {
  const turnKey = createHash("sha256").update(turnId).digest("hex");
  return `${rolloutFile}${TRACE_UPLOAD_TOPOLOGY_SUFFIX}-${turnKey}.json`;
}

export async function loadUploadedTurnIds(rolloutFile: string): Promise<Set<string>> {
  return new Set(
    [...(await loadTurnStates(rolloutFile))]
      .filter(([, state]) => state === "uploaded")
      .map(([turnId]) => turnId),
  );
}

export async function markTurnUploaded(rolloutFile: string, turnId: string): Promise<boolean> {
  try {
    await fs.appendFile(`${rolloutFile}.langsmith`, `${turnId}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
