import { REPOSITORY_METADATA_KEYS } from "./metadata-constants.js";
import { normalizedTime } from "./utils/time.js";
import { errorStatus } from "./utils/http.js";
import { copyExtraThroughJson, digestFor, containsExpected } from "./utils/serialization.js";
import { setTimeout as delay } from "node:timers/promises";
import type { Client, Run } from "langsmith";
import { TRACE_UPLOAD_CONFLICT_STATUS } from "./constants.js";
import {
  INCREMENTAL_RECOVERY_METADATA_KEYS,
  INCREMENTAL_DELIVERY_READ_DELAYS,
  INCREMENTAL_DELIVERY_PATCH_FIELDS,
  INCREMENTAL_DELIVERY_INITIAL_METADATA_KEYS,
} from "./constants/incremental-delivery.js";
import type {
  IncrementalCreateOptions,
  IncrementalDeliveryCheckpoint,
  IncrementalRunCreate,
  IncrementalRunUpdate,
} from "./models/incremental-delivery.js";
import { withIncrementalDeliveryCheckpoint } from "./incremental-delivery-store.js";
import { asRecord } from "./utils/objects.js";
import {
  endpointFor,
  projectNameFor,
  identityFor,
  topologyFor,
  canonicalCreate,
  mergePatchExtra,
  matchesCheckpoint,
  readClientForEndpoint,
} from "./incremental-run.js";

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

export async function readAndValidate(
  client: Client,
  options: IncrementalCreateOptions | undefined,
  checkpoint: IncrementalDeliveryCheckpoint,
): Promise<Run> {
  const reader = readClientForEndpoint(client, checkpoint.endpoint, options);
  const [existing, project] = await Promise.all([
    readIndexedRun(reader, checkpoint.runId),
    reader.readProject({ projectName: checkpoint.projectName }),
  ]);
  if (!matchesCheckpoint(existing, checkpoint, project.id)) {
    throw new Error("Existing run does not match its incremental delivery checkpoint");
  }
  return existing;
}

export async function patchAndVerify(
  client: Client,
  update: IncrementalRunUpdate,
  options: IncrementalCreateOptions | undefined,
  checkpoint: IncrementalDeliveryCheckpoint,
) {
  try {
    await client.updateRun(checkpoint.runId, update, options);
  } catch (error) {
    if (errorStatus(error) !== TRACE_UPLOAD_CONFLICT_STATUS) throw error;
  }
  for (const wait of [...INCREMENTAL_DELIVERY_READ_DELAYS, 0]) {
    const existing = await readAndValidate(client, options, checkpoint);
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

async function deliverCreate(
  client: Client,
  createRun: Client["createRun"],
  run: IncrementalRunCreate,
  options: IncrementalCreateOptions | undefined,
  rolloutFile: string,
  turnKey: string,
  finalize: boolean,
  redact?: <T>(value: T) => T,
  redactionPolicy?: string,
  sessionId?: string,
) {
  const cleanRun = copyExtraThroughJson(run);
  const originalMetadata = asRecord(asRecord(cleanRun.extra).metadata);
  const recoveryMetadata = Object.fromEntries(
    [...INCREMENTAL_RECOVERY_METADATA_KEYS, ...REPOSITORY_METADATA_KEYS].flatMap((key) =>
      typeof originalMetadata[key] !== "string" ||
      (originalMetadata.ls_tracing_mode === "metadata" &&
        key !== "thread_id" &&
        key !== "turn_id" &&
        key !== "ls_tracing_mode")
        ? []
        : [[key, originalMetadata[key]]],
    ),
  );
  const recovery = {
    turnKey,
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(redactionPolicy === undefined ? {} : { redactionPolicy }),
    metadata: {
      ...(redact ? redact(recoveryMetadata) : recoveryMetadata),
      ls_tracing_mode: originalMetadata.ls_tracing_mode === "metadata" ? "metadata" : "full",
    },
    ...(cleanRun.end_time === undefined ? {} : { endTime: cleanRun.end_time }),
  };
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
    const firstAttempt = checkpoint === undefined;
    if (!checkpoint) {
      checkpoint = {
        ...identity,
        topology: topologyFor(cleanRun),
        createAttempted: true,
        recovery,
      };
      await store.save(checkpoint);
    }
    if (!finalize && checkpoint.deliveredDigest !== undefined) return;
    const canonical = canonicalCreate(cleanRun, checkpoint);
    const digest = digestFor(canonical);
    if (checkpoint.deliveredDigest === digest) return;
    let existing: Run | undefined;
    if (!firstAttempt) {
      try {
        existing = await readAndValidate(client, options, checkpoint);
      } catch (error) {
        if (errorStatus(error) !== 404 || checkpoint.deliveredDigest !== undefined) throw error;
      }
    }
    if (!existing) {
      try {
        await createRun(canonical, options);
      } catch (error) {
        if (errorStatus(error) !== TRACE_UPLOAD_CONFLICT_STATUS) throw error;
        try {
          existing = await readAndValidate(client, options, checkpoint);
        } catch (verificationError) {
          throw new Error("Could not verify the existing run after a create conflict", {
            cause: verificationError,
          });
        }
      }
    }
    if (existing && finalize) {
      const update = {
        end_time: canonical.end_time,
        inputs: canonical.inputs,
        outputs: canonical.outputs,
        error: canonical.error,
        extra: mergePatchExtra(existing, canonical, checkpoint.topology.runType === "chain"),
      };
      await patchAndVerify(client, update, options, checkpoint);
    }
    await store.save({
      ...checkpoint,
      deliveredDigest: digest,
      ...(finalize ? { finalized: true as const } : {}),
    });
  });
}

export function trackIncrementalDelivery(
  client: Client,
  errors: unknown[],
  rolloutFile: string,
  turnKey: string,
  finalize = true,
  redact?: <T>(value: T) => T,
  redactionPolicy?: string,
  sessionId?: string,
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
              redact,
              redactionPolicy,
              sessionId,
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
