import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { mkdir, open, rename, rmdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import * as os from "node:os";
import * as path from "node:path";

export type TracingMode = "full" | "metadata";
export type TurnMode = TracingMode | "off";

interface ThreadPolicy {
  preference?: TracingMode;
  turns: Record<string, TurnMode>;
  inherited?: TurnMode;
}
interface TracingPolicy {
  version: 1;
  threads: Record<string, ThreadPolicy>;
}
function isMode(value: unknown): value is TracingMode {
  return value === "full" || value === "metadata";
}
function isTurnMode(value: unknown): value is TurnMode {
  return isMode(value) || value === "off";
}
function validThread(value: unknown): boolean {
  return (
    isObject(value) &&
    (!Object.hasOwn(value, "preference") || isMode(value.preference)) &&
    isObject(value.turns) &&
    Object.values(value.turns).every(isTurnMode) &&
    (value.inherited === undefined || isTurnMode(value.inherited)) &&
    Object.keys(value).every((key) => ["preference", "turns", "inherited"].includes(key))
  );
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCode(error: unknown, code: string): boolean {
  return isObject(error) && error.code === code;
}

/** Missing policy has no overrides/evidence; every other read failure is fail-closed. */
function readPolicy(path: string): TracingPolicy {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      // A dangling symlink is an unreadable policy, not an absent preference.
      try {
        lstatSync(path);
      } catch (statError) {
        if (hasCode(statError, "ENOENT")) return { version: 1, threads: {} };
        throw statError;
      }
    }
    throw error;
  }
  const value: unknown = JSON.parse(raw);
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isObject(value.threads) ||
    Object.values(value.threads).some((thread) => !validThread(thread)) ||
    Object.keys(value).some((key) => key !== "version" && key !== "threads")
  ) {
    throw new Error("Invalid tracing preference format");
  }
  return value as unknown as TracingPolicy;
}

export function defaultPrivacyPath(): string {
  return path.join(process.env.HOME ?? os.homedir(), ".codex", "langsmith-state.privacy.json");
}

function threadPolicy(policy: TracingPolicy, id: string): ThreadPolicy | undefined {
  return Object.hasOwn(policy.threads, id) ? policy.threads[id] : undefined;
}

/** No launch evidence means metadata-only, never today's sticky preference. */
export function savedTurnMode(file: string, sessionId: string, turnId?: string): TurnMode {
  try {
    const thread = threadPolicy(readPolicy(file), sessionId);
    if (thread?.inherited) return thread.inherited;
    return turnId && thread && Object.hasOwn(thread.turns, turnId)
      ? thread.turns[turnId]
      : "metadata";
  } catch {
    return "metadata";
  }
}

/** Exact, argument-free commands only; ordinary prompts are never interpreted. */
export function parseTracingCommand(prompt: string): "mute" | "unmute" | undefined {
  if (prompt === "langsmith-tracing:mute") return "mute";
  if (prompt === "langsmith-tracing:unmute") return "unmute";
  return undefined;
}

/**
 * Independent of tracing state and its pruning. Writers serialize through an
 * exclusive directory lock (mkdir avoids O_EXCL's network-filesystem caveats).
 * No age/PID-based stealing: even a slow live writer is safe.
 * A crashed writer's lock requires explicit removal after confirming it is idle.
 * Rename commits the effective preference. Later durability/cleanup failures are
 * returned as local warnings, not thrown as if the preference were unchanged.
 */
async function updatePolicy(
  path: string,
  update: (policy: TracingPolicy) => void,
): Promise<{ warning?: string }> {
  const lockPath = `${path}.lock`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const deadline = performance.now() + 2000;
  let locked = false;
  while (!locked) {
    try {
      // Must not be recursive: an existing directory means another writer owns it.
      await mkdir(lockPath, { mode: 0o700 });
      locked = true;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      if (performance.now() >= deadline) {
        throw new Error(
          `Timed out waiting for tracing preference lock ${lockPath}. Retry; if it persists, remove the lock only after confirming no preference writer is running.`,
        );
      }
      // Jitter keeps competing writers from retrying in lockstep.
      await delay(10 + Math.random() * 20);
    }
  }

  const warnings: string[] = [];
  // Cleanup attempts are independent and must never replace a precommit error.
  // These filesystem details are for local command output only, never tracing.
  async function bestEffort(action: () => Promise<unknown>, message: string): Promise<void> {
    try {
      await action();
    } catch (error) {
      warnings.push(`${message}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let tempPath: string | undefined;
  try {
    let policy: TracingPolicy;
    try {
      policy = readPolicy(path);
    } catch (error) {
      throw new Error(
        `Cannot read tracing preferences at ${path}. Refusing to overwrite them; repair the file or its permissions before retrying. No preferences were changed.`,
        { cause: error },
      );
    }
    update(policy);
    tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const temp = await open(tempPath, "wx", 0o600);
    try {
      await temp.writeFile(`${JSON.stringify(policy)}\n`, "utf8");
      await temp.sync();
    } catch (error) {
      await bestEffort(() => temp.close(), "Temporary file close failed");
      throw error;
    }
    await temp.close();
    await rename(tempPath, path);
    // Commit point: readers now see the requested mode, even if fsync fails.
    tempPath = undefined;
    await bestEffort(async () => {
      const directory = await open(dirname(path), "r");
      try {
        await directory.sync();
      } finally {
        await bestEffort(() => directory.close(), "Directory close cleanup failed");
      }
    }, "Preference is effective, but crash durability could not be confirmed; retry saving");
  } finally {
    if (tempPath) {
      await bestEffort(() => unlink(tempPath!), "Temporary file cleanup failed");
    }
    await bestEffort(
      () => rmdir(lockPath),
      `Preference lock cleanup failed at ${lockPath}. Before retrying, remove the lock only after confirming no preference writer is running`,
    );
  }
  return warnings.length ? { warning: warnings.join("; ") } : {};
}

function requireIds(sessionId: string, turnId?: string): void {
  if (typeof sessionId !== "string" || !sessionId || typeof turnId !== "string" || !turnId) {
    throw new Error(
      "Nonempty native session_id and turn_id are required; update Codex and enable synchronous UserPromptSubmit hooks",
    );
  }
}

/** One atomic transaction preserves active/queued snapshots before changing preference. */
export async function submitPreference(
  file: string,
  sessionId: string,
  turnId: string,
  enabled: boolean,
  command?: "mute" | "unmute",
): Promise<{ warning?: string }> {
  requireIds(sessionId, turnId);
  return updatePolicy(file, (policy) => {
    const thread: ThreadPolicy = threadPolicy(policy, sessionId) ?? { turns: {} };
    if (!Object.hasOwn(thread.turns, turnId)) {
      thread.turns = {
        ...thread.turns,
        [turnId]: thread.inherited ?? (enabled ? (thread.preference ?? "full") : "off"),
      };
    }
    if (command) thread.preference = command === "mute" ? "metadata" : "full";
    policy.threads = { ...policy.threads, [sessionId]: thread };
  });
}

/** First launch wins, even after unmute, a direct child Stop, or sidecar deletion. */
export async function inheritThreadMode(
  file: string,
  sessionId: string,
  mode: TurnMode,
): Promise<TurnMode> {
  let inherited: TurnMode = "metadata";
  const result = await updatePolicy(file, (policy) => {
    const thread: ThreadPolicy = threadPolicy(policy, sessionId) ?? { turns: {} };
    thread.inherited ??= mode;
    inherited = thread.inherited;
    policy.threads = { ...policy.threads, [sessionId]: thread };
  });
  if (result.warning) console.error(`Tracing preference warning: ${result.warning}`);
  return inherited;
}
