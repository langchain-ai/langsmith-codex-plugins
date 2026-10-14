import { readFile, rm, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { CODEX_CONFIG_DIRECTORY, STATE_FILE_MAX_AGE_MS, WARNING_FILE_NAME } from "./constants.js";

function warningPath(home: string): string {
  return path.join(home, CODEX_CONFIG_DIRECTORY, WARNING_FILE_NAME);
}

export async function recordWarning(home: string, message: string): Promise<void> {
  await writeFile(warningPath(home), message, { mode: 0o600 });
}

export async function showPendingWarning(home: string): Promise<void> {
  try {
    const stale = Date.now() - (await stat(warningPath(home))).mtimeMs > STATE_FILE_MAX_AGE_MS;
    const message = await readFile(warningPath(home), "utf8");
    await rm(warningPath(home), { force: true });
    if (message && !stale) console.error(message);
  } catch {
    return;
  }
}
