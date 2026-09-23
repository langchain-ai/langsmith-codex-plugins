import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { pluginShouldStandDown } from "../src/stand-down.js";
import { DRAIN_TIMEOUT_MS } from "../src/utils/stdin.js";

const EXECUTABLE = JSON.parse(
  readFileSync(new URL("../../../binary.config.json", import.meta.url), "utf8"),
).executableName;
const BUNDLE = fileURLToPath(new URL("../dist/index.mjs", import.meta.url));
const STDIN_SOURCE = new URL("../src/utils/stdin.ts", import.meta.url).href;
const BINARY_HOOKS = new URL("../hooks/hooks.binary.json", import.meta.url);
const DEVELOPER_TRACING_VARS = /^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/;
const ROOT_CAN_READ_ANYTHING = process.getuid?.() === 0;

let home: string;
let installed: string;
let userHooks: string;
let project: string;
let projectHooks: string;
let savedHome: string | undefined;
let savedCodexHome: string | undefined;
let savedCwd: string;

beforeEach(async () => {
  savedCwd = process.cwd();
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-standdown-"));
  installed = path.join(home, ".langsmith", EXECUTABLE);
  userHooks = path.join(home, ".codex", "hooks.json");
  project = path.join(home, "project");
  projectHooks = path.join(project, ".codex", "hooks.json");
  await fs.mkdir(project);
  savedHome = process.env.HOME;
  savedCodexHome = process.env.CODEX_HOME;
  process.env.HOME = home;
  delete process.env.CODEX_HOME;
});

afterEach(async () => {
  process.chdir(savedCwd);
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = savedCodexHome;
  await fs.chmod(userHooks, 0o600).catch(() => undefined);
  await fs.rm(home, { recursive: true, force: true });
});

async function installBinary() {
  await fs.mkdir(path.dirname(installed), { recursive: true });
  await fs.writeFile(installed, "#!/bin/sh\n", { mode: 0o755 });
}

async function writeHooks(file: string, contents: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}

function hooksRunning(command: string) {
  return JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: "command", command, timeout: 30 }] }] },
  });
}

function runBundle(prompt: string, cwd = home) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !DEVELOPER_TRACING_VARS.test(key)),
  );
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
    stdinError?: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, [BUNDLE], {
      env: { ...env, HOME: home, TRACE_TO_LANGSMITH: "true" },
      cwd,
    });
    let stdout = "";
    let stderr = "";
    let stdinError: string | undefined;
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.stdin.on("error", (error: Error) => (stdinError = error.message));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr, stdinError }));
    child.stdin.end(
      JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "thread",
        turn_id: "control",
        cwd,
        prompt,
      }),
    );
  });
}

it("stands down when the installed binary exists and the user hooks file runs it", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  expect(await pluginShouldStandDown()).toBe(true);
});

it("keeps tracing when the hooks file runs a binary that is not installed", async () => {
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  expect(await pluginShouldStandDown()).toBe(false);
});

it("keeps tracing when the binary is installed but no hooks file runs it", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning('node "$PLUGIN_ROOT/dist/index.mjs"'));
  expect(await pluginShouldStandDown()).toBe(false);
});

it("stands down when the hooks file runs the installed path unquoted", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(installed));
  expect(await pluginShouldStandDown()).toBe(true);
});

it("stands down when the registered command carries surrounding whitespace", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`  '${installed}'  `));
  expect(await pluginShouldStandDown()).toBe(true);
});

it("keeps tracing when a hook command only mentions the executable name", async () => {
  await installBinary();
  for (const command of [
    EXECUTABLE,
    `echo ${EXECUTABLE}`,
    `'${installed}' --update`,
    `node ./tools/${EXECUTABLE}-lint.mjs`,
  ]) {
    await writeHooks(userHooks, hooksRunning(command));
    expect(await pluginShouldStandDown(), command).toBe(false);
  }
});

it("stands down when a malformed entry sits beside the registered one", async () => {
  await installBinary();
  await writeHooks(
    userHooks,
    JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: 12 },
              { type: "command", command: `'${installed}'` },
            ],
          },
        ],
      },
    }),
  );
  expect(await pluginShouldStandDown()).toBe(true);
});

it("keeps tracing when the hooks file runs a same-named binary from elsewhere", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${path.join(home, "elsewhere", EXECUTABLE)}'`));
  expect(await pluginShouldStandDown()).toBe(false);
});

it("keeps tracing when the hooks file is missing", async () => {
  await installBinary();
  expect(existsSync(userHooks)).toBe(false);
  expect(await pluginShouldStandDown()).toBe(false);
});

it.skipIf(ROOT_CAN_READ_ANYTHING)("keeps tracing when the hooks file cannot be read", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  await fs.chmod(userHooks, 0o000);
  expect(await pluginShouldStandDown()).toBe(false);
});

it("keeps tracing when the hooks file is malformed", async () => {
  await installBinary();
  await writeHooks(userHooks, `${hooksRunning(`'${installed}'`)} and then some`);
  expect(await pluginShouldStandDown()).toBe(false);
});

it("keeps tracing when the hooks file holds shapes it does not expect", async () => {
  await installBinary();
  for (const contents of [
    "null",
    "[]",
    `"${installed}"`,
    JSON.stringify({ hooks: installed }),
    JSON.stringify({ hooks: { Stop: installed } }),
    JSON.stringify({ hooks: { Stop: [{ hooks: installed }] } }),
    JSON.stringify({ hooks: { Stop: [{ hooks: [null] }] } }),
    JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: 12 }] }] } }),
  ]) {
    await writeHooks(userHooks, contents);
    expect(await pluginShouldStandDown(), contents).toBe(false);
  }
});

it("still reads the project hooks file when the user hooks file is broken", async () => {
  await installBinary();
  await writeHooks(userHooks, "{");
  await writeHooks(projectHooks, hooksRunning(`'${installed}'`));
  process.chdir(project);
  expect(await pluginShouldStandDown()).toBe(true);
});

it("keeps tracing when the working directory no longer exists", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  const deleted = path.join(home, "deleted");
  await fs.mkdir(deleted);
  process.chdir(deleted);
  await fs.rm(deleted, { recursive: true, force: true });
  expect(await pluginShouldStandDown()).toBe(false);
});

it("stands down when only the project hooks file runs the binary", async () => {
  await installBinary();
  await writeHooks(projectHooks, hooksRunning(`'${installed}'`));
  const result = await runBundle("langsmith-tracing:mute", project);
  expect(result).toMatchObject({ code: 0, stdout: "", stderr: "" });
  expect(existsSync(path.join(home, ".codex/langsmith-state.privacy.json"))).toBe(false);
});

it("the production bundle answers a control prompt while no binary is registered", async () => {
  await writeHooks(userHooks, hooksRunning('node "$PLUGIN_ROOT/dist/index.mjs"'));
  const result = await runBundle("langsmith-tracing:mute");
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).decision).toBe("block");
});

it("the production bundle answers nothing at all while the binary is registered", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  const result = await runBundle("langsmith-tracing:mute");
  expect(result).toMatchObject({ code: 0, stdout: "", stderr: "" });
  expect(existsSync(path.join(home, ".codex/langsmith-state.privacy.json"))).toBe(false);
});

it("the production bundle drains a prompt too big for the pipe buffer", async () => {
  await installBinary();
  await writeHooks(userHooks, hooksRunning(`'${installed}'`));
  const result = await runBundle("x".repeat(200_000));
  expect(result).toMatchObject({ code: 0, stdout: "", stderr: "", stdinError: undefined });
});

function drainInChild(setup: string, timeoutMs: number) {
  const script = `${setup};import(${JSON.stringify(STDIN_SOURCE)}).then((m) => m.drainStdin(${timeoutMs}))`;
  return new Promise<number | null | "hung">((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script], { stdio: ["pipe", "ignore", "inherit"] });
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL");
      resolve("hung");
    }, 2_500);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(watchdog);
      resolve(code);
    });
  });
}

it("gives up on a pipe the parent never closes", async () => {
  expect(await drainInChild("", 50)).toBe(0);
});

it("reads nothing at all when stdin is a terminal", async () => {
  expect(await drainInChild("process.stdin.isTTY=true", 60_000)).toBe(0);
});

it("bounds the drain below every hook timeout Codex enforces", async () => {
  const groups = Object.values(JSON.parse(await fs.readFile(BINARY_HOOKS, "utf-8")).hooks);
  const timeouts = groups
    .flatMap((event) => event as { hooks: { timeout?: number }[] }[])
    .flatMap((group) => group.hooks)
    .map((hook) => hook.timeout ?? 0);
  expect(timeouts.length).toBeGreaterThan(0);
  expect(DRAIN_TIMEOUT_MS).toBeLessThan(Math.min(...timeouts) * 1000);
});
