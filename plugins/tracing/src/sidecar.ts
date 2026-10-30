import { FileLockTimeoutError, withFileLock } from "@langchain/plugins-base/storage";
import * as path from "node:path";
import {
  HOOK_FIRINGS_EXTENSION,
  HOOK_FIRINGS_PREFIX,
  HOOK_FIRINGS_SESSION_TURN,
  SIDECAR_SUFFIX,
  STATE_FILE_MAX_AGE_MS,
  UNSAFE_FILE_NAME_CHARS,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { CodexHookInput, HookFiring } from "./models/hook-input.js";
import * as fs from "node:fs/promises";
import { engineStorageRoot } from "./tracing-engine.js";
import { homeDirectory } from "./utils/home.js";

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

function hookFiringsName(sessionId: string, turnId: string | null | undefined): string {
  const name = `${sessionId}-${turnId ?? HOOK_FIRINGS_SESSION_TURN}`;
  return `${HOOK_FIRINGS_PREFIX}${name.replace(UNSAFE_FILE_NAME_CHARS, "_")}${HOOK_FIRINGS_EXTENSION}`;
}

export async function recordHookFiring(
  config: Config,
  input: Partial<CodexHookInput>,
): Promise<void> {
  if (!config.enabled || !config.capture_hook_outputs || !input.session_id) return;
  const firing: HookFiring = {
    event: input.hook_event_name,
    turn_id: input.turn_id,
    tool_use_id: input.tool_use_id,
    time: performance.timeOrigin,
  };
  const root = engineStorageRoot(homeDirectory());
  await fs.mkdir(root, { recursive: true });
  const file = path.join(root, hookFiringsName(input.session_id, input.turn_id));
  await fs.appendFile(file, `${JSON.stringify(firing)}\n`);
}

export async function loadHookFirings(sessionId: string): Promise<HookFiring[]> {
  const root = engineStorageRoot(homeDirectory());
  const prefix = `${HOOK_FIRINGS_PREFIX}${sessionId.replace(UNSAFE_FILE_NAME_CHARS, "_")}-`;
  const names = (await fs.readdir(root).catch(() => [])).filter((name) => name.startsWith(prefix));
  const files = names.map((name) => fs.readFile(path.join(root, name), "utf-8").catch(() => ""));
  return (await Promise.all(files))
    .join("\n")
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

export async function removeHookFirings(sessionId: string, turnId: string): Promise<void> {
  const root = engineStorageRoot(homeDirectory());
  await fs.rm(path.join(root, hookFiringsName(sessionId, turnId)), { force: true });
}

export async function pruneHookFirings(now = Date.now()): Promise<void> {
  const root = engineStorageRoot(homeDirectory());
  const names = await fs.readdir(root).catch(() => []);
  for (const name of names.filter((each) => each.startsWith(HOOK_FIRINGS_PREFIX))) {
    const file = path.join(root, name);
    const { mtimeMs } = await fs.stat(file).catch(() => ({ mtimeMs: now }));
    if (now - mtimeMs > STATE_FILE_MAX_AGE_MS) await fs.rm(file, { force: true });
  }
}
