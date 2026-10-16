import { FileLockTimeoutError, withFileLock } from "@langchain/plugins-base/storage";
import { SIDECAR_SUFFIX } from "./constants.js";
import * as fs from "node:fs/promises";

export function withSidecarLock<T>(rolloutFile: string, action: () => Promise<T>): Promise<T> {
  return withFileLock(`${rolloutFile}${SIDECAR_SUFFIX}`, action);
}

export function withSidecarLockOrWithout<T>(
  rolloutFile: string,
  action: () => Promise<T>,
): Promise<T> {
  return withSidecarLock(rolloutFile, action).catch((error: unknown) => {
    if (!(error instanceof FileLockTimeoutError)) throw error;
    return action();
  });
}

export async function loadUploadedTurnIds(rolloutFile: string): Promise<Set<string>> {
  try {
    const data = await fs.readFile(`${rolloutFile}${SIDECAR_SUFFIX}`, "utf-8");
    return new Set(data.split("\n").filter(Boolean));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

export async function markTurnUploaded(rolloutFile: string, turnId: string): Promise<boolean> {
  try {
    await fs.appendFile(`${rolloutFile}${SIDECAR_SUFFIX}`, `${turnId}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
