import { normalizedTime } from "./utils/time.js";
import { normalizedEndpoint, errorStatus } from "./utils/http.js";
import {
  copyExtraThroughJson,
  sortedJson,
  digestFor,
  containsExpected,
} from "./utils/serialization.js";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client, type Run } from "langsmith";
import { TRACE_UPLOAD_CONFLICT_STATUS, TRACE_UPLOAD_DEFAULT_PROJECT } from "./constants.js";
import { REPOSITORY_METADATA_KEYS } from "./metadata-constants.js";
import {
  INCREMENTAL_DELIVERY_ENV_PROJECT_KEYS,
  INCREMENTAL_DELIVERY_READ_DELAYS,
  INCREMENTAL_DELIVERY_PATCH_FIELDS,
  INCREMENTAL_DELIVERY_INITIAL_METADATA_KEYS,
} from "./constants/incremental-delivery.js";
import type {
  IncrementalCreateOptions,
  IncrementalDeliveryCheckpoint,
  IncrementalDeliveryIdentity,
  IncrementalRunCreate,
  IncrementalRunTopology,
  RuntimeClientConfig,
  VerifiedIncrementalRun,
} from "./models/incremental-delivery.js";
import { withIncrementalDeliveryCheckpoint } from "./incremental-delivery-store.js";
import { asRecord } from "./utils/objects.js";

function runtimeClientConfig(client: Client) {
  return client as unknown as RuntimeClientConfig;
}

function endpointFor(client: Client, options?: IncrementalCreateOptions) {
  const configured = runtimeClientConfig(client).apiUrl;
  if (configured === undefined) throw new Error("LangSmith client has no API endpoint");
  return normalizedEndpoint(options?.apiUrl ?? configured);
}

function projectNameFor(run: unknown) {
  const record = asRecord(run);
  const explicit = record.project_name ?? record.session_name;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  for (const key of INCREMENTAL_DELIVERY_ENV_PROJECT_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  return TRACE_UPLOAD_DEFAULT_PROJECT;
}

function identityFor(
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

function topologyFor(run: IncrementalRunCreate): IncrementalRunTopology {
  return {
    parentRunId: run.parent_run_id ?? null,
    ...(typeof run.trace_id === "string" ? { traceId: run.trace_id } : {}),
    ...(typeof run.dotted_order === "string" ? { dottedOrder: run.dotted_order } : {}),
    startTime: run.start_time ?? Date.now(),
    name: run.name,
    runType: run.run_type,
  };
}

function canonicalCreate(
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

function mergePatchExtra(existing: Run, desired: { extra?: unknown }, root: boolean) {
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

function matchesCheckpoint(
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

function readClientForEndpoint(
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

async function readIndexedRun(client: Client, runId: string): Promise<Run> {
  for (const wait of INCREMENTAL_DELIVERY_READ_DELAYS) {
    try {
      return await client.readRun(runId);
    } catch (error) {
      if (errorStatus(error) !== 404) throw error;
      await delay(wait);
    }
  }
  return client.readRun(runId);
}

async function readAndValidate(
  client: Client,
  options: IncrementalCreateOptions | undefined,
  endpoint: string,
  checkpoint: IncrementalDeliveryCheckpoint,
): Promise<VerifiedIncrementalRun> {
  const reader = readClientForEndpoint(client, endpoint, options);
  const [existing, project] = await Promise.all([
    readIndexedRun(reader, checkpoint.runId),
    reader.readProject({ projectName: checkpoint.projectName }),
  ]);
  if (!matchesCheckpoint(existing, checkpoint, project.id)) {
    throw new Error("Existing run does not match its incremental delivery checkpoint");
  }
  return { existing, projectId: project.id };
}

function updatePayloadFromCreate(
  run: IncrementalRunCreate,
  existing: Run,
  checkpoint: IncrementalDeliveryCheckpoint,
) {
  const fields = canonicalCreate(run, checkpoint);
  return {
    end_time: fields.end_time,
    inputs: fields.inputs,
    outputs: fields.outputs,
    error: fields.error,
    extra: mergePatchExtra(existing, fields, checkpoint.topology.runType === "chain"),
  };
}

async function patchAndVerify(
  client: Client,
  update: ReturnType<typeof updatePayloadFromCreate>,
  options: IncrementalCreateOptions | undefined,
  endpoint: string,
  checkpoint: IncrementalDeliveryCheckpoint,
) {
  try {
    await client.updateRun(checkpoint.runId, update, options);
  } catch (error) {
    if (errorStatus(error) !== TRACE_UPLOAD_CONFLICT_STATUS) throw error;
  }
  for (const wait of [...INCREMENTAL_DELIVERY_READ_DELAYS, 0]) {
    const { existing } = await readAndValidate(client, options, endpoint, checkpoint);
    if (
      normalizedTime(existing.end_time) === normalizedTime(update.end_time) &&
      INCREMENTAL_DELIVERY_PATCH_FIELDS.every((key) =>
        containsExpected(existing[key], asRecord(update)[key]),
      )
    )
      return;
    if (wait === 0) throw new Error("LangSmith has not applied the final run update");
    await delay(wait);
  }
}

async function postWithConflictRecovery(
  client: Client,
  createRun: Client["createRun"],
  run: IncrementalRunCreate,
  options: IncrementalCreateOptions | undefined,
  endpoint: string,
  checkpoint: IncrementalDeliveryCheckpoint,
  digest: string,
  finalize: boolean,
  save: (next: IncrementalDeliveryCheckpoint) => Promise<void>,
) {
  try {
    await createRun(run, options);
  } catch (error) {
    if (errorStatus(error) !== TRACE_UPLOAD_CONFLICT_STATUS) throw error;
    let verified: VerifiedIncrementalRun;
    try {
      verified = await readAndValidate(client, options, endpoint, checkpoint);
    } catch (verificationError) {
      throw new Error("Could not verify the existing run after a create conflict", {
        cause: verificationError,
      });
    }
    if (finalize) {
      const update = updatePayloadFromCreate(run, verified.existing, checkpoint);
      await patchAndVerify(client, update, options, endpoint, checkpoint);
    }
  }
  await save({ ...checkpoint, deliveredDigest: digest });
}

async function deliverCreate(
  client: Client,
  createRun: Client["createRun"],
  run: IncrementalRunCreate,
  options: IncrementalCreateOptions | undefined,
  rolloutFile: string,
  turnKey: string,
  finalize: boolean,
) {
  const cleanRun = copyExtraThroughJson(run);
  if (!finalize) {
    cleanRun.end_time = undefined;
    const extra = asRecord(cleanRun.extra);
    const metadata = asRecord(extra.metadata);
    cleanRun.extra = {
      metadata,
      toJSON() {
        return {
          metadata: Object.fromEntries(
            INCREMENTAL_DELIVERY_INITIAL_METADATA_KEYS.flatMap((key) =>
              this.metadata[key] === undefined ? [] : [[key, this.metadata[key]]],
            ),
          ),
        };
      },
    };
  }
  if (typeof cleanRun.id !== "string" || cleanRun.id.length === 0) {
    await createRun(cleanRun, options);
    return;
  }
  const projectName = projectNameFor(cleanRun);
  const endpoint = endpointFor(client, options);
  const identity = identityFor(client, endpoint, projectName, cleanRun.id, options);
  await withIncrementalDeliveryCheckpoint(rolloutFile, turnKey, identity, async (store) => {
    let checkpoint = await store.load();
    if (checkpoint === undefined) {
      checkpoint = {
        ...identity,
        topology: topologyFor(cleanRun),
        createAttempted: true,
      };
      await store.save(checkpoint);
      const digest = digestFor(canonicalCreate(cleanRun, checkpoint));
      await postWithConflictRecovery(
        client,
        createRun,
        canonicalCreate(cleanRun, checkpoint),
        options,
        endpoint,
        checkpoint,
        digest,
        finalize,
        store.save,
      );
      return;
    }
    if (!finalize && checkpoint.deliveredDigest !== undefined) return;
    const canonical = canonicalCreate(cleanRun, checkpoint);
    const digest = digestFor(canonical);
    if (checkpoint.deliveredDigest === digest) return;
    if (checkpoint.deliveredDigest === undefined) {
      try {
        const verified = await readAndValidate(client, options, endpoint, checkpoint);
        if (!finalize) {
          await store.save({ ...checkpoint, deliveredDigest: digest });
          return;
        }
        const update = updatePayloadFromCreate(canonical, verified.existing, checkpoint);
        await patchAndVerify(client, update, options, endpoint, checkpoint);
        await store.save({ ...checkpoint, deliveredDigest: digest });
        return;
      } catch (error) {
        if (errorStatus(error) !== 404) throw error;
      }
      await postWithConflictRecovery(
        client,
        createRun,
        canonical,
        options,
        endpoint,
        checkpoint,
        digest,
        finalize,
        store.save,
      );
      return;
    }
    const verified = await readAndValidate(client, options, endpoint, checkpoint);
    const update = updatePayloadFromCreate(canonical, verified.existing, checkpoint);
    await patchAndVerify(client, update, options, endpoint, checkpoint);
    await store.save({ ...checkpoint, deliveredDigest: digest });
  });
}

export function trackIncrementalDelivery(
  client: Client,
  errors: unknown[],
  rolloutFile: string,
  turnKey: string,
  finalize = true,
): Client {
  const createRun = client.createRun.bind(client);
  return new Proxy(client, {
    get(target, property) {
      if (property === "createRun") {
        return async (...args: Parameters<Client["createRun"]>) => {
          try {
            await deliverCreate(
              target,
              createRun,
              args[0],
              args[1],
              rolloutFile,
              turnKey,
              finalize,
            );
          } catch (error) {
            errors.push(error);
            throw error;
          }
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
