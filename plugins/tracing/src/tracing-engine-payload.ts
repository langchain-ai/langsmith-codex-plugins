import type {
  NormalizedRunSnapshot,
  PreparedRunPostSubmission,
} from "@langchain/plugins-base/tracing/upload";
import {
  prepareCodingAgentMetadataProvenance,
  type CodingAgentMetadataOptions,
} from "@langchain/plugins-base/metadata";
import { Client, RunTree } from "langsmith";
import { v5 as uuidV5 } from "uuid";
import {
  LS_INTEGRATION,
  NORMALIZED_SNAPSHOT_OPTIONAL_FIELDS,
  TRACE_RUN_ID_NAMESPACE,
  TRACE_RUN_ID_PREFIX,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { CodexRunStatus } from "./models/tracing-engine.js";
import type { TracingMode } from "./models/tracing-policy.js";
import { isRecord } from "./utils/isRecord.js";
import { toPlainObject } from "./utils/plainObject.js";

export function postSubmission(
  run: RunTree,
  privacyMode: TracingMode,
  metadataOptions: CodingAgentMetadataOptions,
): PreparedRunPostSubmission {
  const payload = toPlainObject(run.toJSON());
  const provenance = prepareCodingAgentMetadataProvenance(
    toPlainObject<CodingAgentMetadataOptions>(metadataOptions),
    LS_INTEGRATION,
    privacyMode,
    runStatus(run),
  );
  if (provenance.status !== "ready") {
    throw new Error("Codex trace metadata has no trusted thread ID");
  }
  return {
    operation: "post",
    integration: LS_INTEGRATION,
    privacyMode,
    metadata: provenance.value,
    privacyContext: { status: runStatus(run) },
    run: normalizedSnapshot(payload),
  };
}

export function runIdGenerator(sessionId: string, turnId: string): () => string {
  let index = 0;
  return () =>
    uuidV5(`${TRACE_RUN_ID_PREFIX}${sessionId}:${turnId}:${index++}`, TRACE_RUN_ID_NAMESPACE);
}

export function createRunClient(config: Config): Client {
  return new Client({ apiKey: config.api_key, apiUrl: config.api_url });
}

function normalizedSnapshot(payload: Record<string, unknown>): NormalizedRunSnapshot {
  if (
    typeof payload.id !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.run_type !== "string" ||
    !isRecord(payload.inputs)
  ) {
    throw new Error("Codex run identity or inputs are unavailable");
  }
  const result: NormalizedRunSnapshot = {
    id: payload.id,
    name: payload.name,
    run_type: payload.run_type,
    inputs: payload.inputs,
  };
  for (const key of NORMALIZED_SNAPSHOT_OPTIONAL_FIELDS) {
    const value = payload[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  if (isRecord(payload.outputs)) result.outputs = payload.outputs;
  return result;
}

function runStatus(run: RunTree): CodexRunStatus {
  const status = run.extra?.metadata?.status;
  if (run.error != null || status === "error") return "error";
  return run.end_time != null || status === "completed" ? "completed" : "running";
}
