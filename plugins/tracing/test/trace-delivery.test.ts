import { expect, it } from "vitest";
import { v5 as uuidv5 } from "uuid";
import * as path from "node:path";
import { TRACE_RUN_ID_NAMESPACE, TRACE_RUN_ID_PREFIX } from "../src/constants.js";
import { stableRunId } from "../src/trace-delivery.js";

it("resolves the rollout path when deriving a run ID without a session ID", () => {
  const rolloutPath = "sessions/rollout.jsonl";
  const turnId = "turn-1";
  const runKey = "root";
  const expected = uuidv5(
    `${TRACE_RUN_ID_PREFIX}${path.resolve(rolloutPath)}:${turnId}:${runKey}`,
    TRACE_RUN_ID_NAMESPACE,
  );

  expect(stableRunId(undefined, rolloutPath, turnId, runKey)).toBe(expected);
});
