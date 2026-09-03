import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type TracingMode = "full" | "metadata";
type TurnMode = TracingMode | "skip";
type TimedMode = { mode: TurnMode; root: string; updatedAt: number };
type TimedRoot = { root: string; updatedAt: number };
type PendingSnapshot = { createdAt: number };
type TracingState = {
  version: 2;
  threads: Record<string, { tracing?: "metadata"; updatedAt: number }>;
  turns: Record<string, TimedMode>;
  roots: Record<string, TimedRoot>;
  pending: Record<string, PendingSnapshot[]>;
};

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const emptyState = (): TracingState => ({
  version: 2,
  threads: {},
  turns: {},
  roots: {},
  pending: {},
});
const sleep = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);

function statePath(home = process.env.HOME ?? os.homedir()) {
  return path.join(home, ".codex", "langsmith-state.json");
}

function parseState(data: string): TracingState | undefined {
  try {
    const value = JSON.parse(data) as Record<string, unknown>;
    if (value == null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const pending = value.pending ?? {};
    for (const entry of [value.threads, value.turns, value.roots, pending]) {
      if (entry == null || typeof entry !== "object" || Array.isArray(entry)) return undefined;
    }
    if (value.version !== 2) return undefined;
    const state = { ...value, pending } as TracingState;
    if (
      Object.values(state.threads).some(
        (entry) =>
          entry == null ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof entry.updatedAt !== "number" ||
          (entry.tracing != null && entry.tracing !== "metadata"),
      )
    )
      return undefined;
    if (
      Object.values(state.turns).some(
        (entry) =>
          entry == null ||
          typeof entry !== "object" ||
          !["full", "metadata", "skip"].includes(entry.mode) ||
          typeof entry.root !== "string" ||
          typeof entry.updatedAt !== "number",
      )
    )
      return undefined;
    if (
      Object.values(state.roots).some(
        (entry) =>
          entry == null ||
          typeof entry !== "object" ||
          typeof entry.root !== "string" ||
          typeof entry.updatedAt !== "number",
      )
    )
      return undefined;
    if (
      Object.values(state.pending).some(
        (queue) =>
          !Array.isArray(queue) ||
          queue.some(
            (entry) =>
              entry == null || typeof entry !== "object" || typeof entry.createdAt !== "number",
          ),
      )
    )
      return undefined;
    return state;
  } catch {
    return undefined;
  }
}

export function readTracingState(home?: string): { state: TracingState; malformed: boolean } {
  try {
    const parsed = parseState(fs.readFileSync(statePath(home), "utf8"));
    return parsed == null
      ? { state: emptyState(), malformed: true }
      : { state: parsed, malformed: false };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? { state: emptyState(), malformed: false }
      : { state: emptyState(), malformed: true };
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function staleLock(lock: string): boolean {
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lock, "owner.json"), "utf8")) as {
      pid?: unknown;
      created?: unknown;
    };
    return (
      typeof owner.pid !== "number" ||
      typeof owner.created !== "number" ||
      Date.now() - owner.created > 30_000 ||
      !processAlive(owner.pid)
    );
  } catch {
    try {
      return Date.now() - fs.statSync(lock).mtimeMs > 30_000;
    } catch {
      return true;
    }
  }
}

function rootForThread(state: TracingState, threadId: string): string {
  let current = threadId;
  const seen = new Set<string>();
  while (state.roots[current] != null && !seen.has(current)) {
    seen.add(current);
    current = state.roots[current].root;
  }
  return current;
}

function collectRoot(state: TracingState, root: string): void {
  delete state.threads[root];
  delete state.pending[root];
  for (const [turnId, entry] of Object.entries(state.turns)) {
    if (entry.root === root) delete state.turns[turnId];
  }
  for (const [threadId, entry] of Object.entries(state.roots)) {
    if (threadId === root || rootForThread(state, threadId) === root) delete state.roots[threadId];
  }
}

function gc(state: TracingState, now: number): void {
  const cutoff = now - RETENTION_MS;
  const activeRoots = new Set<string>();
  for (const [root, entry] of Object.entries(state.threads)) {
    if (entry.updatedAt >= cutoff) activeRoots.add(root);
  }
  for (const entry of Object.values(state.turns)) {
    if (entry.updatedAt >= cutoff) activeRoots.add(entry.root);
  }
  for (const [thread, entry] of Object.entries(state.roots)) {
    if (entry.updatedAt >= cutoff) activeRoots.add(rootForThread(state, thread));
  }
  for (const [root, queue] of Object.entries(state.pending)) {
    state.pending[root] = queue.filter((entry) => entry.createdAt >= cutoff);
    if (state.pending[root].length > 0) activeRoots.add(root);
    else delete state.pending[root];
  }
  const roots = new Set([
    ...Object.keys(state.threads),
    ...Object.values(state.turns).map((entry) => entry.root),
    ...Object.keys(state.pending),
    ...Object.keys(state.roots).map((thread) => rootForThread(state, thread)),
  ]);
  for (const root of roots) if (!activeRoots.has(root)) collectRoot(state, root);
}

function withLock<T>(
  home: string | undefined,
  update: (state: TracingState, now: number) => T,
  recoverMalformed = false,
): T {
  const file = statePath(home);
  const dir = path.dirname(file);
  const lock = path.join(dir, "langsmith-state.lock");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      fs.writeFileSync(
        path.join(lock, "owner.json"),
        JSON.stringify({ pid: process.pid, created: Date.now() }),
      );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (staleLock(lock)) {
        fs.rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (attempt >= 200) throw new Error("Timed out waiting for LangSmith tracing state lock");
      sleep();
    }
  }
  try {
    const loaded = readTracingState(home);
    if (loaded.malformed && !recoverMalformed) throw new Error("Malformed LangSmith tracing state");
    if (loaded.malformed && fs.existsSync(file)) {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}-${process.pid}`);
    }
    const state = loaded.malformed ? emptyState() : loaded.state;
    const now = Date.now();
    gc(state, now);
    const result = update(state, now);
    const temp = path.join(dir, `.langsmith-state-${process.pid}-${Date.now()}.tmp`);
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temp, file);
    return result;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function modeInState(state: TracingState, threadId: string): TracingMode {
  return state.threads[rootForThread(state, threadId)]?.tracing === "metadata"
    ? "metadata"
    : "full";
}

export function getThreadMode(threadId: string, home?: string): TracingMode {
  const loaded = readTracingState(home);
  return loaded.malformed ? "metadata" : modeInState(loaded.state, threadId);
}

export function setThreadMode(threadId: string, mode: TracingMode, home?: string): void {
  withLock(
    home,
    (state, now) => {
      const root = rootForThread(state, threadId);
      state.threads[root] = {
        ...(mode === "metadata" ? { tracing: "metadata" as const } : {}),
        updatedAt: now,
      };
    },
    true,
  );
}

export function linkThreadRoot(threadId: string, rootId: string, home?: string): void {
  withLock(home, (state, now) => {
    const oldMode = modeInState(state, threadId);
    const root = rootForThread(state, rootId);
    state.roots[threadId] = { root, updatedAt: now };
    if (oldMode === "metadata") state.threads[root] = { tracing: "metadata", updatedAt: now };
  });
}

export function enqueuePendingMode(threadId: string, home?: string): void {
  withLock(home, (state, now) => {
    const root = rootForThread(state, threadId);
    (state.pending[root] ??= []).push({ createdAt: now });
  });
}

export function snapshotCurrentTurnMode(
  threadId: string,
  turnId: string,
  home?: string,
): TracingMode {
  return withLock(home, (state, now) => {
    const existing = state.turns[turnId];
    if (existing != null) return existing.mode === "full" ? "full" : "metadata";
    const root = rootForThread(state, threadId);
    const mode = modeInState(state, root);
    state.turns[turnId] = { mode, root, updatedAt: now };
    return mode;
  });
}

export function snapshotTurnMode(
  threadId: string,
  turnId: string,
  inheritedMode?: TracingMode,
  home?: string,
): TracingMode {
  return withLock(home, (state, now) => {
    const existing = state.turns[turnId];
    if (existing != null) return existing.mode === "full" ? "full" : "metadata";
    const root = rootForThread(state, threadId);
    const queue = state.pending[root];
    if (queue != null) {
      queue.shift();
      if (queue.length === 0) delete state.pending[root];
    }
    const mode = inheritedMode ?? "metadata";
    state.turns[turnId] = { mode, root, updatedAt: now };
    return mode;
  });
}

export function markTurnHandled(turnId: string, home?: string): void {
  withLock(home, (state, now) => {
    const existing = state.turns[turnId];
    state.turns[turnId] = {
      mode: "skip",
      root: existing?.root ?? "unknown",
      updatedAt: now,
    };
  });
}

export function isTurnHandled(turnId: string, home?: string): boolean {
  const loaded = readTracingState(home);
  return !loaded.malformed && loaded.state.turns[turnId]?.mode === "skip";
}

export function getTurnMode(
  turnId: string | undefined,
  _threadId: string,
  home?: string,
): TracingMode {
  const loaded = readTracingState(home);
  if (loaded.malformed || turnId == null) return "metadata";
  return loaded.state.turns[turnId]?.mode === "full" ? "full" : "metadata";
}
