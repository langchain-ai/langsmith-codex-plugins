import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function nearestExistingDirectory(target: string): Promise<string | undefined> {
  let current = path.resolve(target);
  for (;;) {
    try {
      if ((await fs.stat(current)).isDirectory()) return current;
    } catch {}
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
