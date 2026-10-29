import { FileLockTimeoutError, withFileLock } from "@langchain/plugins-base/storage";
import { HOOK_FIRINGS_SUFFIX, SIDECAR_SUFFIX } from "./constants.js";
import type { Config } from "./models/config.js";
import type { CodexHookInput, HookFiring } from "./models/hook-input.js";
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

export async function recordHookFiring(
  config: Config,
  input: Partial<CodexHookInput>,
): Promise<void> {
  if (!config.enabled || !config.capture_hook_outputs || !input.transcript_path) return;
  const firing: HookFiring = {
    event: input.hook_event_name,
    turn_id: input.turn_id,
    tool_use_id: input.tool_use_id,
    time: performance.timeOrigin,
  };
  await fs.appendFile(
    `${input.transcript_path}${HOOK_FIRINGS_SUFFIX}`,
    `${JSON.stringify(firing)}\n`,
  );
}

export async function loadHookFirings(rolloutFile: string): Promise<HookFiring[]> {
  const data = await fs.readFile(`${rolloutFile}${HOOK_FIRINGS_SUFFIX}`, "utf-8").catch(() => "");
  return data
    .split("\n")
    .flatMap((line): HookFiring[] => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
    .toSorted((a, b) => a.time - b.time);
}
