import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CODEX_SESSION_DISCOVERY_MAX_ENTRIES,
  CODEX_SESSION_METADATA_MAX_BYTES,
  CODEX_SESSION_UUID_PATTERN,
} from "./constants.js";
import { asRecord } from "./utils/objects.js";

export function createCodexSessionCwdResolver(
  home: string,
  maximumEntries = CODEX_SESSION_DISCOVERY_MAX_ENTRIES,
) {
  let rolloutPaths: Promise<Map<string, string[]>> | undefined;

  return async (sessionId: string): Promise<string | undefined> => {
    rolloutPaths ??= indexCodexRollouts(path.join(home, ".codex", "sessions"), maximumEntries);
    const files = (await rolloutPaths).get(sessionId) ?? [];
    const workingDirectories = new Set<string>();
    for (const file of files) {
      const cwd = await readCodexSessionCwd(file, sessionId);
      if (cwd) workingDirectories.add(cwd);
    }
    if (workingDirectories.size > 1) {
      throw new Error("Original Codex session working directory is ambiguous");
    }
    return workingDirectories.values().next().value;
  };
}

async function indexCodexRollouts(
  root: string,
  maximumEntries: number,
): Promise<Map<string, string[]>> {
  const paths = new Map<string, string[]>();
  const directories = [root];
  let scannedEntries = 0;

  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index]!;
    let handle: Awaited<ReturnType<typeof fs.opendir>>;
    try {
      handle = await fs.opendir(directory);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) continue;
      throw error;
    }

    for await (const entry of handle) {
      scannedEntries += 1;
      if (scannedEntries > maximumEntries) {
        throw new Error("Codex session directory exceeds the recovery entry limit");
      }
      if (entry.isDirectory()) {
        directories.push(path.join(directory, entry.name));
        continue;
      }
      if (!entry.isFile() || !entry.name.startsWith("rollout-") || !entry.name.endsWith(".jsonl"))
        continue;
      const identity = entry.name.slice("rollout-".length, -".jsonl".length);
      if (!identity) continue;
      const file = path.join(directory, entry.name);
      const uuid = identity.match(CODEX_SESSION_UUID_PATTERN)?.[0];
      const sessionId =
        uuid ??
        (identity.startsWith("subagents-") ? identity.slice("subagents-".length) : identity);
      const files = paths.get(sessionId) ?? [];
      files.push(file);
      paths.set(sessionId, files);
    }
  }

  return paths;
}

async function readCodexSessionCwd(file: string, sessionId: string): Promise<string | undefined> {
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(file, "r");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return undefined;
    throw error;
  }

  try {
    const buffer = Buffer.alloc(CODEX_SESSION_METADATA_MAX_BYTES + 1);
    let length = 0;
    let newline = -1;
    while (length < buffer.length && newline < 0) {
      const result = await handle.read(buffer, length, buffer.length - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
      newline = buffer.subarray(0, length).indexOf(0x0a);
    }
    if (newline < 0 && length > CODEX_SESSION_METADATA_MAX_BYTES) return undefined;

    let event: unknown;
    try {
      event = JSON.parse(buffer.subarray(0, newline < 0 ? length : newline).toString("utf8"));
    } catch {
      return undefined;
    }
    const record = asRecord(event);
    if (record.type !== "session_meta") return undefined;
    const payload = asRecord(record.payload);
    return payload.id === sessionId &&
      typeof payload.cwd === "string" &&
      path.isAbsolute(payload.cwd)
      ? payload.cwd
      : undefined;
  } finally {
    await handle.close();
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return asRecord(error).code === code;
}
