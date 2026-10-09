import * as path from "node:path";
import { v5 as uuidv5 } from "uuid";
import { TRACE_RUN_ID_NAMESPACE, TRACE_RUN_ID_PREFIX } from "./constants.js";

export function stableRunId(
  sessionId: string | undefined,
  rolloutFile: string,
  turnKey: string,
  runKey: string,
) {
  return uuidv5(
    `${TRACE_RUN_ID_PREFIX}${sessionId ?? path.resolve(rolloutFile)}:${turnKey}:${runKey}`,
    TRACE_RUN_ID_NAMESPACE,
  );
}
