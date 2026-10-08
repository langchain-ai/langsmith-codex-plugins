import { normalizedTime } from "./utils/time.js";
import { errorStatus } from "./utils/http.js";
import { copyExtraThroughJson, digestFor, containsExpected } from "./utils/serialization.js";
import { setTimeout as delay } from "node:timers/promises";
import type { Client, Run } from "langsmith";
import { TRACE_UPLOAD_CONFLICT_STATUS } from "./constants.js";
import {
  INCREMENTAL_DELIVERY_READ_DELAYS,
  INCREMENTAL_DELIVERY_PATCH_FIELDS,
  INCREMENTAL_DELIVERY_INITIAL_METADATA_KEYS,
} from "./constants/incremental-delivery.js";
import type {
  IncrementalCreateOptions,
  IncrementalDeliveryCheckpoint,
  IncrementalRunCreate,
  VerifiedIncrementalRun,
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
