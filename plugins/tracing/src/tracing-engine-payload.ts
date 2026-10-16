import type {
  NormalizedRunSnapshot,
  PreparedRunPatchSubmission,
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
  PATCH_OPERATION,
  RUN_COMPLETED,
  RUN_ERROR,
  RUN_RUNNING,
  RUN_CONTEXT_FIELDS,
  RUN_PATCH_FIELDS,
  TOOL_RUN_ID_SEGMENT,
  TRACE_RUN_ID_NAMESPACE,
  TRACE_RUN_ID_PREFIX,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { ToolRunIdGenerator } from "./models/trace-conversion.js";
import type { CodexRunStatus } from "./models/tracing-engine.js";
import type { TracingMode } from "./models/tracing-policy.js";
import { isRecord } from "./utils/isRecord.js";
import { toPlainObject } from "./utils/plainObject.js";

export function postSubmission(
  run: RunTree,
  privacyMode: TracingMode,
  metadataOptions: CodingAgentMetadataOptions,
  status: CodexRunStatus = runStatus(run),
): PreparedRunPostSubmission {
  const payload = toPlainObject(run.toJSON());
  const provenance = prepareCodingAgentMetadataProvenance(
    toPlainObject<CodingAgentMetadataOptions>(metadataOptions),
    LS_INTEGRATION,
    privacyMode,
    status,
  );
  if (provenance.status !== "ready") {
    throw new Error("Codex trace metadata has no trusted thread ID");
  }
  return {
    operation: "post",
    integration: LS_INTEGRATION,
    privacyMode,
    metadata: provenance.value,
    privacyContext: { status },
    run: normalizedSnapshot(payload),
  };
}

export function openRootSubmission(
  run: RunTree,
  privacyMode: TracingMode,
  metadataOptions: CodingAgentMetadataOptions,
): PreparedRunPostSubmission {
  const submission = postSubmission(run, privacyMode, metadataOptions, RUN_RUNNING);
  for (const field of RUN_PATCH_FIELDS) delete submission.run[field];
  return submission;
}

export function closingRootSubmission(
  submission: PreparedRunPostSubmission,
): PreparedRunPatchSubmission {
  const { id, name, run_type, ...run } = submission.run;
  const context = Object.fromEntries(
    RUN_CONTEXT_FIELDS.flatMap((field) => (run[field] === undefined ? [] : [[field, run[field]]])),
  );
  const fields = RUN_PATCH_FIELDS.filter((field) => run[field] !== undefined);
  return {
    operation: PATCH_OPERATION,
    integration: submission.integration,
    privacyMode: submission.privacyMode,
    metadata: submission.metadata,
    privacyContext: { status: run.error === undefined ? RUN_COMPLETED : RUN_ERROR },
    run: { id, name, run_type, ...context },
    patch: { fields, values: Object.fromEntries(fields.map((field) => [field, run[field]])) },
  };
}

export function toolRunIdGenerator(sessionId: string, turnId: string): ToolRunIdGenerator {
  return (callId) =>
    uuidV5(
      `${TRACE_RUN_ID_PREFIX}${sessionId}:${turnId}${TOOL_RUN_ID_SEGMENT}${callId}`,
      TRACE_RUN_ID_NAMESPACE,
    );
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
