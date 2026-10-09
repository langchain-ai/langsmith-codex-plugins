import * as fs from "node:fs/promises";
import * as path from "node:path";
import { STALE_PRIVACY_TEMP_PATTERN } from "./constants/stale-state-cleanup.js";
import { processIsAlive } from "./utils/fileLock.js";

export async function cleanupStalePrivacyTemps(file: string, cutoff: number): Promise<void> {
  const directory = path.dirname(file);
  const prefix = `${path.basename(file)}.`;
  for (const name of await fs.readdir(directory)) {
    if (!name.startsWith(prefix)) continue;
    const match = STALE_PRIVACY_TEMP_PATTERN.exec(name.slice(prefix.length));
    if (!match || processIsAlive(Number(match[1]))) continue;
    const temporary = path.join(directory, name);
    const stat = await fs.lstat(temporary);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.mtimeMs <= cutoff)
      await fs.unlink(temporary);
  }
}
