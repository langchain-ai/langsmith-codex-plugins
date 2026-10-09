import { createHash } from "node:crypto";
import * as path from "node:path";
import { ignoreMissingFile, readBoundedText, writePrivateFile } from "./utils/files.js";
import {
  INCREMENTAL_DELIVERY_LOCK_SUFFIX,
  INCREMENTAL_DELIVERY_MAX_BYTES,
  INCREMENTAL_DELIVERY_STORE_SUFFIX,
} from "./constants/incremental-delivery.js";
import type {
  IncrementalDeliveryCheckpoint,
  IncrementalDeliveryIdentity,
  IncrementalDeliveryStoreHandle,
} from "./models/incremental-delivery.js";
import { withFileLock } from "./utils/fileLock.js";
import { IncrementalDeliveryCheckpointSchema } from "./models/incremental-delivery.js";

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

export function validateCheckpoint(
  value: unknown,
  identity: IncrementalDeliveryIdentity,
): IncrementalDeliveryCheckpoint {
  const parsed = IncrementalDeliveryCheckpointSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.endpoint !== identity.endpoint ||
    parsed.data.projectName !== identity.projectName ||
    parsed.data.runId !== identity.runId ||
    parsed.data.workspaceId !== identity.workspaceId ||
    parsed.data.credentialHash !== identity.credentialHash
  )
    throw new Error("Incremental delivery checkpoint is invalid");
  return parsed.data;
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
        const contents = await readBoundedText(file, INCREMENTAL_DELIVERY_MAX_BYTES).catch(
          ignoreMissingFile,
        );
        if (contents === undefined) return undefined;
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
        await writePrivateFile(file, contents, { sync: true });
      },
    };
    return action(store);
  });
}
