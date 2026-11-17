import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import * as path from "node:path";
import { CODEX_CONFIG_DIRECTORY, ROLLOUT_CHUNK_BYTES, ROLLOUT_ENCODING } from "../constants.js";
import type { DirectoryEntry, LineSchema } from "../models/rollout.js";
import { homeDirectory } from "./home.js";

export function* readSession(name: string): Generator<LineSchema> {
  const file = openSync(name, "r");
  const decoder = new StringDecoder(ROLLOUT_ENCODING);
  const buffer = Buffer.alloc(ROLLOUT_CHUNK_BYTES);
  try {
    let pending: string[] = [];
    for (let size = readSync(file, buffer); size > 0; size = readSync(file, buffer)) {
      const chunk = decoder.write(buffer.subarray(0, size));
      let start = 0;
      let end: number;
      while ((end = chunk.indexOf("\n", start)) !== -1) {
        const line = pending.join("") + chunk.slice(start, end);
        pending = [];
        if (line) yield JSON.parse(line) as LineSchema;
        start = end + 1;
      }
      pending.push(chunk.slice(start));
    }
    const rest = pending.join("") + decoder.end();
    if (rest) yield JSON.parse(rest) as LineSchema;
  } finally {
    closeSync(file);
  }
}

export async function* loadSession(name: string): AsyncGenerator<LineSchema> {
  yield* readSession(name);
}

export function* markLast<T>(items: Iterable<T>): Generator<[T, boolean]> {
  let held: [T] | undefined;
  for (const item of items) {
    if (held) yield [held[0], false];
    held = [item];
  }
  if (held) yield [held[0], true];
}

// Anchor at the real sessions root (nearest `sessions` ancestor, or
// ~/.codex/sessions) rather than a fragile fixed depth.
function resolveSessionsRoot(parentFileName: string): string {
  let dir = path.dirname(path.resolve(parentFileName));
  while (true) {
    if (path.basename(dir) === "sessions") return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.join(homeDirectory(), CODEX_CONFIG_DIRECTORY, "sessions");
}

// Recursively find the rollout file whose name ends with the subagent's thread id.
export function findRolloutFileByThreadId(
  parentFileName: string,
  threadId: string,
): string | undefined {
  const suffix = `-${threadId}.jsonl`;
  const root = resolveSessionsRoot(parentFileName);

  function walk(dir: string): string | undefined {
    let entries: DirectoryEntry[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        return full;
      }
    }
    return undefined;
  }

  return walk(root);
}

export function isoTime(time: number | string): string {
  return new Date(time).toISOString();
}
