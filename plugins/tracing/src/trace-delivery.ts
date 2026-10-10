import * as path from "node:path";
import { v5 as uuidv5 } from "uuid";
import { TRACE_RUN_ID_NAMESPACE, TRACE_RUN_ID_PREFIX } from "./constants.js";
import { createRunIdentity } from "@langchain/plugins-base/tracing/lifecycle";

export function stableRunId(
  sessionId: string | undefined,
  rolloutFile: string,
  turnId: string,
  runKey: string,
) {
  return uuidv5(
    `${TRACE_RUN_ID_PREFIX}${sessionId ?? path.resolve(rolloutFile)}:${turnId}:${runKey}`,
    TRACE_RUN_ID_NAMESPACE,
  );
}

export function stableEventId(runId: string, operation: "post" | "patch", revision?: string) {
  return `${runId}:${operation}${revision === undefined ? "" : `:${revision}`}`;
}

export function stableRunStartTime(turnId: string, fallback: number) {
  const value = turnId.replaceAll("-", "");
  if (!/^[0-9a-f]{12}7[0-9a-f]{19}$/i.test(value)) return fallback;
  const timestamp = Number.parseInt(value.slice(0, 12), 16);
  return Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : fallback;
}

export function rootRunIdentity(runId: string, startTime: number) {
  return createRunIdentity({ id: runId, start_time: startTime });
}
