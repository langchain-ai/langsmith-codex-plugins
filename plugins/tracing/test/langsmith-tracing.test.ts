import { execFile, execFileSync, spawnSync } from "node:child_process";
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

async function unstartableBuild(name: string) {
  const file = path.join(binaries, name);
  await fs.writeFile(file, "#!/langsmith/no-such-interpreter\n", { mode: 0o755 });
}

async function killedBuild(name: string) {
  await fs.writeFile(path.join(binaries, name), "#!/bin/sh\nkill -9 $$\n", { mode: 0o755 });
}

async function killedMidEvent(name: string, reads: number) {
  const body = `#!/bin/sh\nhead -c ${reads} >/dev/null\nkill -9 $$\n`;
  await fs.writeFile(path.join(binaries, name), body, { mode: 0o755 });
}

async function refusingBuild(name: string, says: string) {
  const body = `#!/bin/sh\necho "${says}"\nexit 3\n`;
  await fs.writeFile(path.join(binaries, name), body, { mode: 0o755 });
}

async function countingBuild(name: string) {
  const body = '#!/bin/sh\necho "build $(wc -c | tr -d " ") bytes"\n';
  await fs.writeFile(path.join(binaries, name), body, { mode: 0o755 });
}

async function attempt(machine: string, input?: string) {
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, `#!/bin/sh\n[ "$1" = "-m" ] && echo ${machine} || echo Darwin\n`, {
    mode: 0o755,
  });
  return spawnSync(path.join(root, relative), [], {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, PLUGIN_ROOT: root },
  });
}

function pick(machine: string, system = "Darwin", from = root) {
  const fakeUname = path.join(from, "uname");
  return fs
    .writeFile(fakeUname, `#!/bin/sh\n[ "$1" = "-m" ] && echo ${machine} || echo ${system}\n`, {
      mode: 0o755,
    })
    .then(() =>
      spawnSync(path.join(from, relative), [], {
        encoding: "utf8",
        input: "",
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

it("falls back to Node when every carried build is too broken to start", async () => {
  await unstartableBuild(ARM64);
  await unstartableBuild(X64);
  expect(await pick("arm64")).toBe("node fallback");
});

it("falls back to Node when the carried build is killed the moment it starts", async () => {
  await killedBuild(ARM64);
  await killedBuild(X64);
  expect(await pick("arm64")).toBe("node fallback");
});

it("tries the Intel build when the Apple silicon one cannot start", async () => {
  await unstartableBuild(ARM64);
  await build(X64, "x64 build");
  expect(await pick("arm64")).toBe("x64 build");
});

it("falls back to Node when a build exits a code our own binary never returns", async () => {
  await refusingBuild(ARM64, "arm64 refused");
  const result = await attempt("arm64");
  expect(result.stdout.trim().split("\n").at(-1)).toBe("node fallback");
  expect(result.status).toBe(0);
});

it("lets a build that exits zero finish the turn, and never starts Node as well", async () => {
  await build(ARM64, "arm64 build");
  const result = await attempt("arm64");
  expect(result.stdout.trim()).toBe("arm64 build");
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});

it("never runs the Apple silicon build on an Intel Mac", async () => {
  await build(ARM64, "arm64 build");
  expect(await pick("x86_64")).toBe("node fallback");
});

it("says once that a build could not run, and says nothing when none is carried", async () => {
  await unstartableBuild(ARM64);
  await unstartableBuild(X64);
  const broken = await attempt("arm64");
  const said = broken.stderr.split("could not run, falling back to Node").length - 1;
  expect(said).toBe(1);
  await fs.rm(path.join(binaries, ARM64));
  await fs.rm(path.join(binaries, X64));
  expect((await attempt("arm64")).stderr).toBe("");
});

it("hands Node an event far larger than a pipe buffer when no build starts", async () => {
  await unstartableBuild(ARM64);
  await unstartableBuild(X64);
  const counts = 'let n=0;process.stdin.on("data",(c)=>{n+=c.length});';
  const reports = 'process.stdin.on("end",()=>console.log("node "+n+" bytes"));\n';
  await fs.writeFile(path.join(root, "dist", "index.mjs"), counts + reports);
  const result = await attempt("arm64", "x".repeat(1_048_576));
  expect(result.stdout.trim()).toBe("node 1048576 bytes");
});

it("hands Node the whole event when a build is killed after reading part of it", async () => {
  await killedMidEvent(ARM64, 10);
  await killedMidEvent(X64, 10);
  const counts = 'let n=0;process.stdin.on("data",(c)=>{n+=c.length});';
  const reports = 'process.stdin.on("end",()=>console.log("node "+n+" bytes"));\n';
  await fs.writeFile(path.join(root, "dist", "index.mjs"), counts + reports);
  const result = await attempt("arm64", "x".repeat(4096));
  expect(result.stdout.trim()).toBe("node 4096 bytes");
});

it("leaves no copy of the event behind once a carried build has run", async () => {
  await build(ARM64, "arm64 build");
  const spool = await fs.mkdtemp(path.join(os.tmpdir(), "codex-spool-"));
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
    mode: 0o755,
  });
  try {
    const result = spawnSync(path.join(root, relative), [], {
      encoding: "utf8",
      input: "x".repeat(4096),
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        PLUGIN_ROOT: root,
        TMPDIR: spool,
      },
    });
    expect(result.stdout.trim()).toBe("arm64 build");
    expect(await fs.readdir(spool)).toEqual([]);
  } finally {
    await fs.rm(spool, { recursive: true, force: true });
  }
});

it("keeps the copy of the event unreadable to anyone else on the machine", async () => {
  const lists = 'for f in "$TMPDIR"/langsmith-tracing.*; do ls -l "$f" | cut -c1-10; done\n';
  await fs.writeFile(path.join(binaries, ARM64), `#!/bin/sh\n${lists}`, { mode: 0o755 });
  const spool = await fs.mkdtemp(path.join(os.tmpdir(), "codex-spool-"));
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
    mode: 0o755,
  });
  try {
    const result = spawnSync(path.join(root, relative), [], {
      encoding: "utf8",
      input: "the prompt and the code the user just shared",
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        PLUGIN_ROOT: root,
        TMPDIR: spool,
      },
    });
    expect(result.stdout.trim()).toBe("-rw-------");
  } finally {
    await fs.rm(spool, { recursive: true, force: true });
  }
});

it("hands a working build an event far larger than a pipe buffer", async () => {
  await countingBuild(ARM64);
  const result = await attempt("arm64", "x".repeat(1_048_576));
  expect(result.stdout.trim()).toBe("build 1048576 bytes");
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

it("runs the carried build when the event cannot be read at all", async () => {
  await build(ARM64, "arm64 build");
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
    mode: 0o755,
  });
  const closed = spawnSync("/bin/sh", ["-c", `"${path.join(root, relative)}" 0<&-`], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, PLUGIN_ROOT: root },
  });
  expect(closed.stdout.trim()).toBe("arm64 build");
  expect(closed.status).toBe(0);
  const folder = spawnSync("/bin/sh", ["-c", `"${path.join(root, relative)}" <"${root}"`], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, PLUGIN_ROOT: root },
  });
  expect(folder.stdout.trim()).toBe("arm64 build");
  expect(folder.status).toBe(0);
});

it("falls back to Node when the line about falling back cannot be written", async () => {
  await unstartableBuild(ARM64);
  await unstartableBuild(X64);
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
    mode: 0o755,
  });
  const launcher = path.join(root, relative);
  const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, PLUGIN_ROOT: root };
  const shut = spawnSync("/bin/sh", ["-c", `"${launcher}" </dev/null 2>&-`], {
    encoding: "utf8",
    env,
  });
  expect(shut.stdout.trim()).toBe("node fallback");
  expect(shut.status).toBe(0);
  const dead = spawnSync(
    "/bin/sh",
    ["-c", `exec 3>&1; { "${launcher}" </dev/null 2>&1 1>&3; echo "code $?" >&3; } | true`],
    { encoding: "utf8", env },
  );
  expect(dead.stdout.trim().split("\n")).toEqual(["node fallback", "code 0"]);
});

it("falls back to Node when there is nowhere to put the copy of the event", async () => {
  await build(ARM64, "arm64 build");
  const fakeUname = path.join(root, "uname");
  await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
    mode: 0o755,
  });
  const result = spawnSync(path.join(root, relative), [], {
    encoding: "utf8",
    input: "the event",
    env: {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      PLUGIN_ROOT: root,
      TMPDIR: path.join(root, "no-such-spool"),
    },
  });
  expect(result.stdout.trim()).toBe("node fallback");
  expect(result.status).toBe(0);
});

it("starts Node from the plugin root rather than the folder holding the launcher", async () => {
  const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "codex-root-"));
  try {
    await fs.mkdir(path.join(elsewhere, "dist"), { recursive: true });
    await fs.writeFile(
      path.join(elsewhere, "dist", "index.mjs"),
      'console.log("node from the plugin root");\n',
    );
    const fakeUname = path.join(root, "uname");
    await fs.writeFile(fakeUname, '#!/bin/sh\n[ "$1" = "-m" ] && echo arm64 || echo Darwin\n', {
      mode: 0o755,
    });
    const result = spawnSync(path.join(root, relative), [], {
      encoding: "utf8",
      input: "",
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, PLUGIN_ROOT: elsewhere },
    });
    expect(result.stdout.trim()).toBe("node from the plugin root");
  } finally {
    await fs.rm(elsewhere, { recursive: true, force: true });
  }
});

it("the hook command points at a committed script the clone can execute", async () => {
  const mode = (await fs.stat(picker)).mode;
  expect(mode & 0o111).toBe(0o111);
  const tracked = await run("git", ["ls-files", "-s", relative], { cwd: pluginRoot });
  expect(tracked.stdout.split(" ")[0]).toBe("100755");
});
