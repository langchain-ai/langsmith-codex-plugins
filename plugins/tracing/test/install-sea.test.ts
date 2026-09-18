import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flagValue, installBinary, renderHooksFile } from "../src/install.js";
import type { InstallBinaryOptions } from "../src/sea-models.js";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
}));

const repoRoot = new URL("../../../", import.meta.url);
const seaSettings = JSON.parse(readFileSync(new URL("sea-config.json", repoRoot), "utf8"));
const builtBinary = fileURLToPath(new URL(seaSettings.output, repoRoot));
const binaryExists = existsSync(builtBinary);
const EXECUTABLE = "langsmith-codex-tracing";
const RELEASE_API = "http://releases.test/releases";
const BODY = new TextEncoder().encode("the released binary");
const DEVELOPER_TRACING_VARS = /^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/;

let home: string;
let installDir: string;
let installed: string;
let codexHome: string;
let hooksPath: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-install-"));
  installDir = path.join(home, ".langsmith");
  installed = path.join(installDir, EXECUTABLE);
  codexHome = path.join(home, ".codex");
  hooksPath = path.join(codexHome, "hooks.json");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(home, { recursive: true, force: true });
});

function run(command: string, args: string[], extraEnv: Record<string, string>, stdin?: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !DEVELOPER_TRACING_VARS.test(key)),
  );
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: home,
      env: { ...env, HOME: home, CODEX_HOME: codexHome, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin ?? "");
  });
}

function hooksFile() {
  return JSON.parse(readFileSync(hooksPath, "utf8"));
}

function install(overrides: Partial<InstallBinaryOptions> = {}) {
  return installBinary({
    source: path.join(home, "downloaded"),
    installDir,
    hooksFile: hooksPath,
    releaseApi: RELEASE_API,
    runtimePlatform: "darwin",
    runtimeArch: "arm64",
    verifySignature: () => Promise.resolve(),
    ...overrides,
  });
}

function releaseFetch(tags: string[]) {
  const digest = `sha256:${createHash("sha256").update(BODY).digest("hex")}`;
  const releases = tags.map((tag) => ({
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: [
      {
        name: `${EXECUTABLE}-darwin-arm64-${tag}-unsigned`,
        browser_download_url: `http://releases.test/download/${tag}`,
        size: BODY.byteLength,
        digest,
      },
    ],
  }));
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(releases))
    .mockResolvedValueOnce(new Response(BODY));
}

function commandFor(file: Record<string, any>, event: string): string {
  return file.hooks[event].at(-1).hooks[0].command;
}

function fireHook(event: string, prompt: string) {
  return run(
    "/bin/sh",
    ["-lc", commandFor(hooksFile(), event)],
    { TRACE_TO_LANGSMITH: "false" },
    JSON.stringify({
      hook_event_name: event,
      session_id: "thread",
      turn_id: "control",
      transcript_path: path.join(home, "rollout.jsonl"),
      cwd: home,
      prompt,
    }),
  );
}

it("points our events at the installed path and keeps every other hook", () => {
  const mine = { type: "command", command: "echo unrelated" };
  const stale = { type: "command", command: `'/somewhere/else/${EXECUTABLE}'` };
  const binary = `/home/o'brien/.langsmith/${EXECUTABLE}`;

  const rendered = renderHooksFile(
    {
      description: "mine",
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "echo hello" }] }],
        Stop: [{ hooks: [mine] }, { hooks: [stale] }],
      },
    },
    binary,
  );

  expect(Object.keys(rendered)).toEqual(["description", "hooks"]);
  expect(rendered.description).toBe("mine");
  expect((rendered.hooks as any).SessionStart).toEqual([
    { hooks: [{ type: "command", command: "echo hello" }] },
  ]);
  expect(commandFor(rendered, "Stop")).toBe(`'/home/o'\\''brien/.langsmith/${EXECUTABLE}'`);
  expect(commandFor(rendered, "UserPromptSubmit")).toBe(
    `'/home/o'\\''brien/.langsmith/${EXECUTABLE}'`,
  );
  expect((rendered.hooks as any).Stop).toHaveLength(2);
  expect((rendered.hooks as any).Stop[0].hooks).toEqual([mine]);
  expect((rendered.hooks as any).Stop[1].hooks[0].timeout).toBe(30);
  expect(renderHooksFile("not an object", binary)).toEqual({ hooks: expect.any(Object) });
});

it("copies the running binary into place as an executable, without the network", async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  await fs.writeFile(path.join(home, "downloaded"), "the downloaded asset", { mode: 0o644 });

  expect(await install({ fetchImpl })).toEqual({ binary: installed, hooks: hooksPath });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(await fs.readFile(installed, "utf8")).toBe("the downloaded asset");
  expect((await fs.stat(installed)).mode & 0o777).toBe(0o755);
  expect((await fs.stat(installDir)).mode & 0o777).toBe(0o700);
  expect(await fs.readdir(installDir)).toEqual([EXECUTABLE]);
  expect(commandFor(hooksFile(), "Stop")).toBe(`'${installed}'`);
});

it.each([
  ["an older tag is asked for", "v0.2.0", "v0.2.0"],
  ["it is not running from a built binary", undefined, "v0.3.0"],
])("downloads the release when %s", async (_label, tag, wanted) => {
  const fetchImpl = releaseFetch(["v0.2.0", "v0.3.0"]);

  await install({ tag, source: tag ? path.join(home, "downloaded") : undefined, fetchImpl });

  expect(fetchImpl.mock.calls[0][0]).toBe(`${RELEASE_API}?per_page=30`);
  expect(fetchImpl.mock.calls[1][0]).toEqual(new URL(`http://releases.test/download/${wanted}`));
  expect(await fs.readFile(installed)).toEqual(Buffer.from(BODY));
  expect(commandFor(hooksFile(), "Stop")).toBe(`'${installed}'`);
});

describe("writing the hooks file", () => {
  const theirs = {
    description: "mine",
    hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
  };

  async function seedHooksFile(mode: number): Promise<string> {
    const original = `${JSON.stringify(theirs, null, 2)}\n`;
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(hooksPath, original);
    await fs.chmod(hooksPath, mode);
    await fs.writeFile(path.join(home, "downloaded"), "the downloaded asset");
    return original;
  }

  it("keeps the old hooks file when the write dies partway through", async () => {
    const original = await seedHooksFile(0o600);
    const realWriteFile = fs.writeFile;
    let wrote = "";
    vi.spyOn(fs, "writeFile").mockImplementationOnce(async (file, data) => {
      wrote = String(file);
      const text = String(data);
      await realWriteFile(file, text.slice(0, Math.floor(text.length / 2)));
      throw new Error("no space left on device");
    });

    await expect(install({ fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow(
      "no space left on device",
    );

    expect(path.dirname(wrote)).toBe(codexHome);
    expect(wrote).not.toBe(hooksPath);
    expect(readFileSync(hooksPath, "utf8")).toBe(original);
    expect(await fs.readdir(codexHome)).toEqual(["hooks.json"]);
  });

  it("keeps the old hooks file when the rename fails", async () => {
    const original = await seedHooksFile(0o600);
    const realRename = fs.rename;
    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (to === hooksPath) throw new Error("rename failed");
      return realRename(from, to);
    });

    await expect(install({ fetchImpl: vi.fn<typeof fetch>() })).rejects.toThrow("rename failed");

    expect(readFileSync(hooksPath, "utf8")).toBe(original);
    expect(await fs.readdir(codexHome)).toEqual(["hooks.json"]);
  });

  it("keeps the mode of the file it replaces and leaves no temporary file", async () => {
    await seedHooksFile(0o600);

    await install({ fetchImpl: vi.fn<typeof fetch>() });

    expect((await fs.stat(hooksPath)).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(codexHome)).toEqual(["hooks.json"]);
    expect(commandFor(hooksFile(), "Stop")).toBe(`'${installed}'`);
    expect(hooksFile().description).toBe("mine");
  });
});

it("takes the value after --tag, and nothing else", () => {
  expect(flagValue(["binary", "--install", "--tag", "v0.2.0"], "--tag")).toBe("v0.2.0");
  expect(flagValue(["binary", "--tag", "--print"], "--tag")).toBeUndefined();
  expect(flagValue(["binary", "--tag"], "--tag")).toBeUndefined();
  expect(flagValue(["binary", "--install"], "--tag")).toBeUndefined();
});

it.each<[string, Partial<InstallBinaryOptions>, string]>([
  [
    "the platform has no published binary",
    { runtimePlatform: "win32", runtimeArch: "x64" },
    "only runs on macOS arm64",
  ],
  [
    "the copy fails its signature check",
    { verifySignature: () => Promise.reject(new Error("invalid signature")) },
    "invalid signature",
  ],
  [
    "no release carries this tag",
    { tag: "v9.9.9", fetchImpl: () => Promise.resolve(Response.json([])) },
    "no published release is tagged v9.9.9",
  ],
  [
    "no release carries this asset",
    { source: undefined, fetchImpl: () => Promise.resolve(Response.json([])) },
    "no published release carries a",
  ],
])("installs nothing when %s", async (_label, overrides, message) => {
  await fs.writeFile(path.join(home, "downloaded"), "the downloaded asset");
  await fs.mkdir(installDir, { recursive: true });

  await expect(install(overrides)).rejects.toThrow(message);
  expect(await fs.readdir(installDir)).toEqual([]);
  expect(existsSync(hooksPath)).toBe(false);
});

it("downloads rather than copying the interpreter when run through node", async () => {
  const bundle = fileURLToPath(new URL("../dist/index.mjs", import.meta.url));
  const result = await run(process.execPath, [bundle, "--install"], {
    LANGSMITH_CODEX_RELEASE_API: "http://127.0.0.1:1/releases",
  });

  expect(result.code).toBe(1);
  expect(result.stderr).toContain("install failed");
  expect(existsSync(installed)).toBe(false);
  expect(existsSync(hooksPath)).toBe(false);
});

describe("the command line", () => {
  const bundle = () => fileURLToPath(new URL("../dist/index.mjs", import.meta.url));

  it.each(["--help", "-h"])("prints the usage for %s and installs nothing", async (flag) => {
    const result = await run(process.execPath, [bundle(), flag], {});

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain(`${EXECUTABLE} --install`);
    expect(result.stdout).toContain("--help, -h");
    expect(result.stdout).toContain("--version, -v");
    expect(existsSync(hooksPath)).toBe(false);
  });

  it("prints the same version for -v as for --version", async () => {
    const long = await run(process.execPath, [bundle(), "--version"], {});
    const short = await run(process.execPath, [bundle(), "-v"], {});

    expect(long.code).toBe(0);
    expect(short.code).toBe(0);
    expect(short.stdout.trim()).toBe(long.stdout.trim());
    expect(short.stdout.trim()).not.toBe("");
  });

  it("rejects an unknown option with the usage and installs nothing", async () => {
    const result = await run(process.execPath, [bundle(), "--instal"], {});

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown option: --instal");
    expect(result.stderr).toContain("Usage:");
    expect(existsSync(installed)).toBe(false);
    expect(existsSync(hooksPath)).toBe(false);
  });

  it("rejects an unknown option even beside a known one", async () => {
    const result = await run(process.execPath, [bundle(), "--print", "--bogus"], {});

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unknown option: --bogus");
  });
});

describe.runIf(binaryExists)("installing the binary", () => {
  it("copies itself into place, then the installed hook handles events", async () => {
    const printed = await run(builtBinary, ["--print"], {});
    expect(JSON.parse(printed.stdout).hooks.Stop[0].hooks[0].command).toBe(`'${installed}'`);
    expect(existsSync(installed)).toBe(false);

    const result = await run(builtBinary, ["--install"], {});
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(statSync(installed).size).toBe(statSync(builtBinary).size);
    expect(statSync(installed).mode & 0o777).toBe(0o755);
    expect(commandFor(hooksFile(), "Stop")).toBe(`'${installed}'`);
    expect(commandFor(hooksFile(), "UserPromptSubmit")).toBe(`'${installed}'`);
    expect((await run(installed, ["--version"], {})).stdout.trim()).toBe("0.1.0");

    const submit = await fireHook("UserPromptSubmit", "langsmith-tracing:mute");
    expect(submit.stderr).toBe("");
    expect(JSON.parse(submit.stdout)).toEqual({
      decision: "block",
      reason: expect.stringContaining("Thread tracing muted (metadata-only)."),
    });
    const policy = JSON.parse(
      readFileSync(path.join(codexHome, "langsmith-state.privacy.json"), "utf8"),
    );
    expect(policy.threads.thread.turns).toEqual({ control: "off" });

    const stop = await fireHook("Stop", "work");
    expect(stop.stderr).toBe("");
    expect(stop.stdout).toBe("");
  });
});
