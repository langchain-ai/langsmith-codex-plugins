import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import {
  TRACE_UPLOAD_LOCK_SUFFIX,
  TRACE_UPLOAD_STATES,
  TRACE_UPLOAD_STATE_SUFFIX,
  TRACE_UPLOAD_TOPOLOGY_MAX_BYTES,
  TRACE_UPLOAD_TOPOLOGY_SUFFIX,
} from "./constants.js";
import type { TurnDeliveryState, TurnRunTopology } from "./models/trace-delivery.js";
import { TurnRunTopologySchema } from "./models/trace-delivery.js";
import { ignoreMissingFile, readBoundedText, writePrivateFile } from "./utils/files.js";
import { withFileLock } from "./utils/fileLock.js";

export async function withRolloutLock<T>(
  rolloutFile: string,
  action: () => Promise<T>,
): Promise<T> {
  return withFileLock(`${rolloutFile}${TRACE_UPLOAD_LOCK_SUFFIX}`, action);
}

function parseTurnState(line: string): [string, TurnDeliveryState] {
  try {
    const value = JSON.parse(line);
    if (
      value != null &&
      typeof value === "object" &&
      typeof value.turnId === "string" &&
      TRACE_UPLOAD_STATES.includes(value.state)
    ) {
      return [value.turnId, value.state];
    }
  } catch {}
  return [line, "uploaded"];
}

export async function loadTurnStates(rolloutFile: string): Promise<Map<string, TurnDeliveryState>> {
  const data = await fs
    .readFile(`${rolloutFile}${TRACE_UPLOAD_STATE_SUFFIX}`, "utf-8")
    .catch(ignoreMissingFile);
  return new Map(data?.split("\n").filter(Boolean).map(parseTurnState));
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
  const contents = await readBoundedText(topologyFile, TRACE_UPLOAD_TOPOLOGY_MAX_BYTES).catch(
    ignoreMissingFile,
  );
  if (contents === undefined) return undefined;

  for (const line of contents.split("\n").filter(Boolean)) {
    try {
      const value = JSON.parse(line);
      const parsed = TurnRunTopologySchema.safeParse(value?.topology);
      if (parsed.success) return parsed.data;
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
  const contents = JSON.stringify({ topology });
  if (Buffer.byteLength(contents, "utf-8") > TRACE_UPLOAD_TOPOLOGY_MAX_BYTES) {
    throw new Error("Trace upload topology checkpoint exceeds its size limit");
  }
  await writePrivateFile(topologyFile, contents);
}

function topologyFilePath(rolloutFile: string, turnId: string) {
  const turnKey = createHash("sha256").update(turnId).digest("hex");
  return `${rolloutFile}${TRACE_UPLOAD_TOPOLOGY_SUFFIX}-${turnKey}.json`;
}
