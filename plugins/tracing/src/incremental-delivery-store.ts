import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  INCREMENTAL_DELIVERY_CHECKPOINT_KEYS,
  INCREMENTAL_DELIVERY_DIGEST_PATTERN,
  INCREMENTAL_DELIVERY_LOCK_SUFFIX,
  INCREMENTAL_DELIVERY_MAX_BYTES,
  INCREMENTAL_DELIVERY_STORE_SUFFIX,
  INCREMENTAL_DELIVERY_TOPOLOGY_KEYS,
} from "./constants/incremental-delivery.js";
import type {
  IncrementalDeliveryCheckpoint,
  IncrementalDeliveryIdentity,
  IncrementalDeliveryStoreHandle,
} from "./models/incremental-delivery.js";
import { withFileLock } from "./utils/fileLock.js";
import { isRecord } from "./utils/objects.js";

function checkpointPath(
  rolloutFile: string,
  turnKey: string,
  identity: IncrementalDeliveryIdentity,
) {
  const identityHash = createHash("sha256")
    .update(
      `${turnKey}\0${identity.endpoint}\0${identity.projectName}\0${identity.runId}\0workspace:${identity.workspaceId ?? ""}\0credential:${identity.credentialHash ?? ""}`,
    )
    .digest("hex");
  return `${path.resolve(rolloutFile)}${INCREMENTAL_DELIVERY_STORE_SUFFIX}-${identityHash}.json`;
}

function validateCheckpoint(
  value: unknown,
  identity: IncrementalDeliveryIdentity,
): IncrementalDeliveryCheckpoint {
  if (!isRecord(value) || !isRecord(value.topology)) {
    throw new Error("Incremental delivery checkpoint is invalid");
  }
  if (
    Object.keys(value).some(
      (key) => !INCREMENTAL_DELIVERY_CHECKPOINT_KEYS.includes(key as never),
    ) ||
    Object.keys(value.topology).some(
      (key) => !INCREMENTAL_DELIVERY_TOPOLOGY_KEYS.includes(key as never),
    )
  ) {
    throw new Error("Incremental delivery checkpoint is invalid");
  }
  const topology = value.topology;
  const validStartTime =
    typeof topology.startTime === "string" ||
    (typeof topology.startTime === "number" && Number.isFinite(topology.startTime));
  if (
    value.endpoint !== identity.endpoint ||
    value.projectName !== identity.projectName ||
    value.runId !== identity.runId ||
    value.workspaceId !== identity.workspaceId ||
    value.credentialHash !== identity.credentialHash ||
    (value.credentialHash !== undefined &&
      (typeof value.credentialHash !== "string" ||
        !INCREMENTAL_DELIVERY_DIGEST_PATTERN.test(value.credentialHash))) ||
    value.createAttempted !== true ||
    (value.deliveredDigest !== undefined &&
      (typeof value.deliveredDigest !== "string" ||
        !INCREMENTAL_DELIVERY_DIGEST_PATTERN.test(value.deliveredDigest))) ||
    !(topology.parentRunId === null || typeof topology.parentRunId === "string") ||
    (topology.traceId !== undefined && typeof topology.traceId !== "string") ||
    (topology.dottedOrder !== undefined && typeof topology.dottedOrder !== "string") ||
    !validStartTime ||
    typeof topology.name !== "string" ||
    typeof topology.runType !== "string"
  ) {
    throw new Error("Incremental delivery checkpoint is invalid");
  }
  return {
    endpoint: identity.endpoint,
    projectName: identity.projectName,
    runId: identity.runId,
    ...(identity.workspaceId === undefined ? {} : { workspaceId: identity.workspaceId }),
    ...(identity.credentialHash === undefined ? {} : { credentialHash: identity.credentialHash }),
    topology: {
      parentRunId: topology.parentRunId,
      ...(topology.traceId === undefined ? {} : { traceId: topology.traceId }),
      ...(topology.dottedOrder === undefined ? {} : { dottedOrder: topology.dottedOrder }),
      startTime: topology.startTime as number | string,
      name: topology.name,
      runType: topology.runType,
    },
    createAttempted: true,
    ...(value.deliveredDigest === undefined ? {} : { deliveredDigest: value.deliveredDigest }),
  };
}

export function withIncrementalDeliveryCheckpoint<T>(
  rolloutFile: string,
  turnKey: string,
  identity: IncrementalDeliveryIdentity,
  action: (store: IncrementalDeliveryStoreHandle) => Promise<T>,
): Promise<T> {
  const file = checkpointPath(rolloutFile, turnKey, identity);
  return withFileLock(`${file}${INCREMENTAL_DELIVERY_LOCK_SUFFIX}`, async () => {
    const store: IncrementalDeliveryStoreHandle = {
      async load() {
        let contents: string;
        try {
          const handle = await fs.open(file, "r");
          try {
            const buffer = Buffer.alloc(INCREMENTAL_DELIVERY_MAX_BYTES + 1);
            let length = 0;
            while (length < buffer.length) {
              const { bytesRead } = await handle.read(
                buffer,
                length,
                buffer.length - length,
                length,
              );
              if (bytesRead === 0) break;
              length += bytesRead;
            }
            if (length > INCREMENTAL_DELIVERY_MAX_BYTES) {
              throw new Error("Incremental delivery checkpoint exceeds its size limit");
            }
            contents = buffer.toString("utf8", 0, length);
          } finally {
            await handle.close();
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
          throw error;
        }
        let value: unknown;
        try {
          value = JSON.parse(contents);
        } catch (error) {
          throw new Error("Incremental delivery checkpoint is corrupt", { cause: error });
        }
        return validateCheckpoint(value, identity);
      },
      async save(checkpoint) {
        const validated = validateCheckpoint(checkpoint, identity);
        const contents = JSON.stringify(validated);
        if (Buffer.byteLength(contents, "utf8") > INCREMENTAL_DELIVERY_MAX_BYTES) {
          throw new Error("Incremental delivery checkpoint exceeds its size limit");
        }
        const temporaryFile = `${file}.${randomUUID()}.tmp`;
        const handle = await fs.open(temporaryFile, "wx", 0o600);
        try {
          await handle.writeFile(contents, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.rename(temporaryFile, file);
      },
    };
    return action(store);
  });
}
