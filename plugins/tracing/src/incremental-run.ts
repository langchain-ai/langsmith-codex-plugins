import { createHash } from "node:crypto";
import { Client, type Run } from "langsmith";
import { normalizedTime } from "./utils/time.js";
import { normalizedEndpoint } from "./utils/http.js";
import { asRecord } from "./utils/objects.js";
import { TRACE_UPLOAD_DEFAULT_PROJECT } from "./constants.js";
import { REPOSITORY_METADATA_KEYS } from "./metadata-constants.js";
import { INCREMENTAL_DELIVERY_ENV_PROJECT_KEYS } from "./constants/incremental-delivery.js";
import type {
  IncrementalCreateOptions,
  IncrementalDeliveryCheckpoint,
  IncrementalDeliveryIdentity,
  IncrementalRunCreate,
  IncrementalRunTopology,
  RuntimeClientConfig,
} from "./models/incremental-delivery.js";

function runtimeClientConfig(client: Client) {
  return client as unknown as RuntimeClientConfig;
}

export function endpointFor(client: Client, options?: IncrementalCreateOptions) {
  const configured = runtimeClientConfig(client).apiUrl;
  if (configured === undefined) throw new Error("LangSmith client has no API endpoint");
  return normalizedEndpoint(options?.apiUrl ?? configured);
}

export function projectNameFor(run: unknown) {
  const record = asRecord(run);
  const explicit = record.project_name ?? record.session_name;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  for (const key of INCREMENTAL_DELIVERY_ENV_PROJECT_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  return TRACE_UPLOAD_DEFAULT_PROJECT;
}

export function identityFor(
  client: Client,
  endpoint: string,
  projectName: string,
  runId: string,
  options?: IncrementalCreateOptions,
): IncrementalDeliveryIdentity {
  const runtime = runtimeClientConfig(client);
  const workspaceId = options?.workspaceId ?? runtime.workspaceId;
  if (typeof workspaceId === "string" && workspaceId.trim().length > 0) {
    return { endpoint, projectName, runId, workspaceId };
  }
  const apiKey = options?.apiKey ?? runtime.apiKey;
  return {
    endpoint,
    projectName,
    runId,
    ...(typeof apiKey === "string" && apiKey.length > 0
      ? { credentialHash: createHash("sha256").update(apiKey).digest("hex") }
      : {}),
  };
}

export function topologyFor(run: IncrementalRunCreate): IncrementalRunTopology {
  return {
    parentRunId: run.parent_run_id ?? null,
    ...(typeof run.trace_id === "string" ? { traceId: run.trace_id } : {}),
    ...(typeof run.dotted_order === "string" ? { dottedOrder: run.dotted_order } : {}),
    startTime: run.start_time ?? Date.now(),
    name: run.name,
    runType: run.run_type,
  };
}

export function canonicalCreate(
  run: IncrementalRunCreate,
  checkpoint: IncrementalDeliveryCheckpoint,
): IncrementalRunCreate {
  const canonical = {
    ...run,
    id: checkpoint.runId,
    name: checkpoint.topology.name,
    run_type: checkpoint.topology.runType,
    start_time: checkpoint.topology.startTime,
  } as IncrementalRunCreate;
  if (checkpoint.topology.parentRunId === null) delete canonical.parent_run_id;
  else canonical.parent_run_id = checkpoint.topology.parentRunId;
  if (checkpoint.topology.traceId === undefined) delete canonical.trace_id;
  else canonical.trace_id = checkpoint.topology.traceId;
  if (checkpoint.topology.dottedOrder === undefined) delete canonical.dotted_order;
  else canonical.dotted_order = checkpoint.topology.dottedOrder;
  return canonical;
}

export function mergePatchExtra(existing: Run, desired: { extra?: unknown }, root: boolean) {
  const desiredExtra = asRecord(desired.extra);
  const desiredMetadata = asRecord(desiredExtra.metadata);
  if (desiredMetadata.ls_tracing_mode === "metadata") {
    return { ...desiredExtra, metadata: desiredMetadata };
  }
  const existingExtra = asRecord(existing.extra);
  const existingMetadata = asRecord(existingExtra.metadata);
  const metadata = { ...existingMetadata };
  for (const [key, value] of Object.entries(desiredMetadata)) {
    if (value !== undefined) metadata[key] = value;
  }
  if (root) {
    for (const key of REPOSITORY_METADATA_KEYS) {
      const existingValue = existingMetadata[key];
      if (typeof existingValue === "string" && existingValue.length > 0) {
        metadata[key] = existingValue;
      }
    }
  }
  return {
    ...existingExtra,
    ...desiredExtra,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export function matchesCheckpoint(
  existing: Run,
  checkpoint: IncrementalDeliveryCheckpoint,
  projectId: string,
) {
  const topology = checkpoint.topology;
  return (
    existing.id === checkpoint.runId &&
    (existing.parent_run_id ?? null) === topology.parentRunId &&
    (existing.trace_id ?? undefined) === topology.traceId &&
    (existing.dotted_order ?? undefined) === topology.dottedOrder &&
    normalizedTime(existing.start_time) === normalizedTime(topology.startTime) &&
    existing.name === topology.name &&
    existing.run_type === topology.runType &&
    existing.session_id === projectId
  );
}

export function readClientForEndpoint(
  client: Client,
  endpoint: string,
  options?: IncrementalCreateOptions,
) {
  const configured = runtimeClientConfig(client).apiUrl;
  if (configured === undefined) throw new Error("LangSmith client has no API endpoint");
  const baseEndpoint = normalizedEndpoint(configured);
  if (
    endpoint === baseEndpoint &&
    options?.apiUrl === undefined &&
    options?.apiKey === undefined &&
    options?.workspaceId === undefined
  ) {
    return client;
  }
  const runtime = runtimeClientConfig(client);
  return new Client({
    apiUrl: options?.apiUrl ?? endpoint,
    apiKey: options?.apiKey ?? runtime.apiKey,
    workspaceId: options?.workspaceId ?? runtime.workspaceId,
    headers: runtime.headers,
    fetchOptions: runtime.fetchOptions,
    fetchImplementation: runtime.fetchImplementation,
    autoBatchTracing: false,
  });
}
