export const INCREMENTAL_DELIVERY_STORE_SUFFIX = ".langsmith-incremental";
export const INCREMENTAL_DELIVERY_LOCK_SUFFIX = ".lock";
export const INCREMENTAL_DELIVERY_MAX_BYTES = 4 * 1024 * 1024;
export const INCREMENTAL_DELIVERY_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
export const INCREMENTAL_DELIVERY_CHECKPOINT_KEYS = [
  "endpoint",
  "projectName",
  "runId",
  "workspaceId",
  "credentialHash",
  "topology",
  "createAttempted",
  "deliveredDigest",
  "recovery",
  "finalized",
] as const;
export const INCREMENTAL_DELIVERY_TOPOLOGY_KEYS = [
  "parentRunId",
  "traceId",
  "dottedOrder",
  "startTime",
  "name",
  "runType",
] as const;
export const INCREMENTAL_DELIVERY_ENV_PROJECT_KEYS = [
  "LANGSMITH_PROJECT",
  "LANGCHAIN_PROJECT",
] as const;

export const INCREMENTAL_DELIVERY_READ_DELAYS = [100, 250, 500, 1000, 2000, 4000] as const;
export const INCREMENTAL_DELIVERY_PATCH_FIELDS = [
  "inputs",
  "outputs",
  "error",
  "extra",
  "tags",
  "events",
] as const;

export const INCREMENTAL_DELIVERY_INITIAL_METADATA_KEYS = [
  "thread_id",
  "turn_id",
  "ls_trace_schema_version",
  "ls_integration",
  "ls_agent_type",
  "ls_tracing_mode",
] as const;

export const INCREMENTAL_RECOVERY_METADATA_KEYS = [
  "thread_id",
  "turn_id",
  "cwd",
  "ls_tracing_mode",
] as const;

export const INCREMENTAL_RECOVERY_KEYS = [
  "turnKey",
  "sessionId",
  "metadata",
  "endTime",
  "redactionPolicy",
] as const;
