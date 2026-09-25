import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
const onWindows = process.platform === "win32";
const SHELL_TIMEOUT_MS = 60_000;
const definition = JSON.parse(
  await fs.readFile(new URL("../hooks/hooks.json", import.meta.url), "utf8"),
);
const config = JSON.parse(
  await fs.readFile(new URL("../../../binary.config.json", import.meta.url), "utf8"),
);
const entries = Object.values(
  definition.hooks as Record<string, { hooks: Record<string, string>[] }[]>,
).flatMap((groups) => groups.flatMap((group) => group.hooks));
const registered = entries[0];

function sandbox(builds: string[]): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "codex hooks "));
  for (const folder of ["binary", "dist", "machine"]) mkdirSync(path.join(dir, folder));
  cpSync(
    path.join(pluginRoot, "binary/langsmith-tracing"),
    path.join(dir, "binary/langsmith-tracing"),
  );
  chmodSync(path.join(dir, "binary/langsmith-tracing"), 0o755);
  writeFileSync(path.join(dir, "dist/index.mjs"), 'console.log("node");\n');
  writeFileSync(
    path.join(dir, "machine/uname"),
    '#!/bin/sh\ncase "$1" in -m) echo arm64 ;; *) echo Darwin ;; esac\n',
  );
  chmodSync(path.join(dir, "machine/uname"), 0o755);
  for (const build of builds) {
    const file = path.join(dir, "binary", build);
    writeFileSync(file, `#!/bin/sh\necho "${build}"\n`);
    chmodSync(file, 0o755);
  }
  return dir;
}

function shell(dir: string): string {
  const command = onWindows
    ? registered.commandWindows.replaceAll("${PLUGIN_ROOT}", dir)
    : registered.command;
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    input: JSON.stringify({ hook_event_name: "Stop" }),
    env: onWindows
      ? process.env
      : {
          ...process.env,
          PLUGIN_ROOT: dir,
          PATH: `${path.join(dir, "machine")}${path.delimiter}${process.env.PATH ?? ""}`,
        },
  });
  expect(result.error, String(result.error)).toBeUndefined();
  return result.stdout.trim();
}

function inSandbox(builds: string[], check: (dir: string) => void): void {
  const dir = sandbox(builds);
  try {
    check(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

it("gives every hook Windows wording that starts Node at an entry the plugin carries", () => {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(entry.commandWindows, entry.command).toBe('node "${PLUGIN_ROOT}/dist/index.mjs"');
  }
  expect(existsSync(path.join(pluginRoot, "dist/index.mjs"))).toBe(true);
});

it.runIf(onWindows)(
  "reaches Node on Windows, where the carried build cannot run",
  () => {
    inSandbox([], (dir) => expect(shell(dir)).toBe("node"));
  },
  SHELL_TIMEOUT_MS,
);

it.runIf(!onWindows)(
  "runs the carried build off Windows, and Node when none is carried",
  () => {
    const build = `${config.executableName}-darwin-arm64`;
    inSandbox([build], (dir) => expect(shell(dir)).toBe(build));
    inSandbox([], (dir) => expect(shell(dir)).toBe("node"));
  },
  SHELL_TIMEOUT_MS,
);
