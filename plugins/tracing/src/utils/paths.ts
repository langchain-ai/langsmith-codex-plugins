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

export async function pathHasSymbolicLink(target: string): Promise<boolean> {
  const parsed = path.parse(path.resolve(target));
  let current = parsed.root;
  for (const part of path
    .resolve(target)
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function absoluteTarget(value: unknown, base: string | undefined): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (path.isAbsolute(value)) return path.normalize(value);
  if (!base || !path.isAbsolute(base)) return undefined;
  return path.resolve(base, value);
}
