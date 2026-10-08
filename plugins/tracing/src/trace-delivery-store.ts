import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import {
  TRACE_UPLOAD_LOCK_SUFFIX,
  TRACE_UPLOAD_RUN_ID_MAX_LENGTH,
  TRACE_UPLOAD_DOTTED_ORDER_MAX_LENGTH,
  TRACE_UPLOAD_STATES,
  TRACE_UPLOAD_STATE_SUFFIX,
  TRACE_UPLOAD_TOPOLOGY_MAX_BYTES,
  TRACE_UPLOAD_TOPOLOGY_SUFFIX,
} from "./constants.js";
import type { TurnDeliveryState, TurnRunTopology } from "./models/trace-delivery.js";
import { withFileLock } from "./utils/fileLock.js";

export async function withRolloutLock<T>(
  rolloutFile: string,
  action: () => Promise<T>,
): Promise<T> {
  return withFileLock(`${rolloutFile}${TRACE_UPLOAD_LOCK_SUFFIX}`, action);
}

export async function loadTurnStates(rolloutFile: string): Promise<Map<string, TurnDeliveryState>> {
  try {
    const data = await fs.readFile(`${rolloutFile}${TRACE_UPLOAD_STATE_SUFFIX}`, "utf-8");
    const states = new Map<string, TurnDeliveryState>();
    for (const line of data.split("\n").filter(Boolean)) {
      try {
        const value = JSON.parse(line);
        if (
          value != null &&
          typeof value === "object" &&
          typeof value.turnId === "string" &&
          TRACE_UPLOAD_STATES.includes(value.state)
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
    `${rolloutFile}${TRACE_UPLOAD_STATE_SUFFIX}`,
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
          (typeof topology.parentRunId === "string" &&
            topology.parentRunId.length <= TRACE_UPLOAD_RUN_ID_MAX_LENGTH)) &&
        typeof topology.traceId === "string" &&
        topology.traceId.length <= TRACE_UPLOAD_RUN_ID_MAX_LENGTH &&
        typeof topology.dottedOrder === "string" &&
        topology.dottedOrder.length <= TRACE_UPLOAD_DOTTED_ORDER_MAX_LENGTH &&
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
    await fs.appendFile(`${rolloutFile}${TRACE_UPLOAD_STATE_SUFFIX}`, `${turnId}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
