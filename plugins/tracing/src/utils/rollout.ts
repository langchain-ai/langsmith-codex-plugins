import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CODEX_CONFIG_DIRECTORY } from "../constants.js";
import type { DirectoryEntry, LineSchema } from "../models/rollout.js";
import { homeDirectory } from "./home.js";

export async function loadSession(name: string) {
  const data = await fs.readFile(name, "utf-8");

  const result = data
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LineSchema);

  return result;
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
