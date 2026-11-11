import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CODEX_CONFIG_DIRECTORY, ROLLOUT_ENCODING } from "../constants.js";
import type { DirectoryEntry, LineSchema } from "../models/rollout.js";
import { homeDirectory } from "./home.js";

export async function* loadSession(name: string): AsyncGenerator<LineSchema> {
  const input = createReadStream(name, ROLLOUT_ENCODING);
  try {
    let pending: string[] = [];
    for await (const chunk of input) {
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
    const rest = pending.join("");
    if (rest) yield JSON.parse(rest) as LineSchema;
  } finally {
    input.destroy();
  }
}

export async function* markLast<T>(items: AsyncIterable<T>): AsyncGenerator<[T, boolean]> {
  let held: [T] | undefined;
  for await (const item of items) {
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
export async function findRolloutFileByThreadId(
  parentFileName: string,
  threadId: string,
): Promise<string | undefined> {
  const suffix = `-${threadId}.jsonl`;
  const root = resolveSessionsRoot(parentFileName);

  async function walk(dir: string): Promise<string | undefined> {
    let entries: DirectoryEntry[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        return full;
      }
    }
    return undefined;
  }

  return walk(root);
}
