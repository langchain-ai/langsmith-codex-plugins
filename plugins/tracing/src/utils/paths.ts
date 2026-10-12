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

export function absoluteTarget(value: unknown, base: string | undefined): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (path.isAbsolute(value)) return path.normalize(value);
  if (!base || !path.isAbsolute(base)) return undefined;
  return path.resolve(base, value);
}
