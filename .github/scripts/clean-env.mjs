import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ALWAYS_KEPT = ["path", "pathext", "systemroot", "windir", "comspec", "lang"];

export function cleanEnvironment(prefix, kept = []) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const home = join(root, "home");
  const temporary = join(root, "tmp");
  mkdirSync(home);
  mkdirSync(temporary);
  const allowed = new Set([...ALWAYS_KEPT, ...kept.map((name) => name.toLowerCase())]);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())),
  );
  return {
    ...env,
    CI: "1",
    HOME: home,
    USERPROFILE: home,
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
  };
}
