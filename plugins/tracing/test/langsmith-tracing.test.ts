import { execFile, execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, it } from "vitest";

const run = promisify(execFile);
const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
const hooks = JSON.parse(
  await fs.readFile(new URL("../hooks/hooks.json", import.meta.url), "utf8"),
);
const registered = hooks.hooks.UserPromptSubmit[0].hooks[0].command as string;
const relative = registered.replaceAll('"', "").replace("$PLUGIN_ROOT/", "");
const picker = path.join(pluginRoot, relative);

const config = JSON.parse(
  await fs.readFile(new URL("../../../binary.config.json", import.meta.url), "utf8"),
);
const ARM64 = `${config.executableName}-darwin-arm64`;
const X64 = `${config.executableName}-darwin-x64`;

let root: string;
let binaries: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-picker-"));
  binaries = path.join(root, path.dirname(relative));
  await fs.mkdir(binaries, { recursive: true });
  await fs.copyFile(picker, path.join(root, relative));
  await fs.chmod(path.join(root, relative), 0o755);
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  await fs.writeFile(path.join(root, "dist", "index.mjs"), 'console.log("node fallback");\n');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function build(name: string, says: string) {
  const file = path.join(binaries, name);
  await fs.writeFile(file, `#!/bin/sh\necho "${says}"\n`, { mode: 0o755 });
}

function pick(machine: string, system = "Darwin", from = root) {
  const fakeUname = path.join(from, "uname");
  return fs
    .writeFile(fakeUname, `#!/bin/sh\n[ "$1" = "-m" ] && echo ${machine} || echo ${system}\n`, {
      mode: 0o755,
    })
    .then(() =>
      run(path.join(from, relative), [], {
        env: { ...process.env, PATH: `${from}:${process.env.PATH}`, PLUGIN_ROOT: from },
      }),
    )
    .then((result) => result.stdout.trim());
}

it("runs the Apple silicon build on an Apple silicon Mac", async () => {
  await build(ARM64, "arm64 build");
  await build(X64, "x64 build");
  expect(await pick("arm64")).toBe("arm64 build");
});

it("runs the Intel build under Rosetta when it is the only build carried", async () => {
  await build(X64, "x64 build");
  expect(await pick("arm64")).toBe("x64 build");
});

it("runs the Intel build on an Intel Mac and never the Apple silicon one", async () => {
  await build(ARM64, "arm64 build");
  await build(X64, "x64 build");
  expect(await pick("x86_64")).toBe("x64 build");
});

it("falls back to Node when no build is carried", async () => {
  expect(await pick("arm64")).toBe("node fallback");
});

it("falls back to Node when the carried build is not executable", async () => {
  await build(ARM64, "arm64 build");
  await fs.chmod(path.join(binaries, ARM64), 0o644);
  expect(await pick("arm64")).toBe("node fallback");
});

it("falls back to Node off macOS even with both builds in place", async () => {
  await build(ARM64, "arm64 build");
  await build(X64, "x64 build");
  expect(await pick("x86_64", "Linux")).toBe("node fallback");
});

it("runs the carried build when the plugin folder has a space in its name", async () => {
  await build(ARM64, "arm64 build");
  const holder = await fs.mkdtemp(path.join(os.tmpdir(), "codex-picker-"));
  const spaced = path.join(holder, "My Plugins");
  try {
    await fs.cp(root, spaced, { recursive: true });
    expect(await pick("arm64", "Darwin", spaced)).toBe("arm64 build");
  } finally {
    await fs.rm(holder, { recursive: true, force: true });
  }
});

it("survives a Windows clone runnable, where Git rewrites line endings", async () => {
  const converted = execFileSync(
    "git",
    ["-c", "core.autocrlf=true", "cat-file", "--filters", `:./${relative}`],
    { cwd: pluginRoot },
  );
  await build(ARM64, "arm64 build");
  await fs.writeFile(path.join(root, relative), converted);
  await fs.chmod(path.join(root, relative), 0o755);
  expect(await pick("arm64")).toBe("arm64 build");
});

it("the hook command points at a committed script the clone can execute", async () => {
  const mode = (await fs.stat(picker)).mode;
  expect(mode & 0o111).toBe(0o111);
  const tracked = await run("git", ["ls-files", "-s", relative], { cwd: pluginRoot });
  expect(tracked.stdout.split(" ")[0]).toBe("100755");
});
