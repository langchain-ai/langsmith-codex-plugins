import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  defaultPrivacyPath,
  inheritThreadMode,
  parseTracingCommand,
  savedTurnMode,
  submitPreference,
} from "../src/tracing-policy.js";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

// Keep real filesystem IO while exposing configurable exports for fault injection.
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
}));

let home: string;
let file: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-privacy-"));
  vi.stubEnv("HOME", home);
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key)) vi.stubEnv(key, undefined);
  }
  file = defaultPrivacyPath();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

it.each([
  "/langsmith-tracing:mute",
  " langsmith-tracing:mute",
  "langsmith-tracing:mute\n",
  "langsmith-tracing:mute now",
  "say langsmith-tracing:unmute",
  "LANGSMITH-TRACING:MUTE",
])("does not interpret ordinary prompt %j", (prompt) => {
  expect(parseTracingCommand(prompt)).toBeUndefined();
});
it("snapshots new healthy turns full; controls preserve active and queued turns", async () => {
  expect(parseTracingCommand("langsmith-tracing:mute")).toBe("mute");
  expect(parseTracingCommand("langsmith-tracing:unmute")).toBe("unmute");
  await submitPreference(file, "thread", "active", true);
  await submitPreference(file, "thread", "queued", true);
  await submitPreference(file, "thread", "active", true, "mute");
  expect(savedTurnMode(file, "thread", "active")).toBe("full");
  expect(savedTurnMode(file, "thread", "queued")).toBe("full");
  await submitPreference(file, "thread", "private", true);
  expect(savedTurnMode(file, "thread", "private")).toBe("metadata");
  await submitPreference(file, "thread", "private", true, "unmute");
  await submitPreference(file, "thread", "future", true);
  expect(savedTurnMode(file, "thread", "private")).toBe("metadata");
  expect(savedTurnMode(file, "thread", "future")).toBe("full");
  expect(savedTurnMode(file, "thread", "historical-no-evidence")).toBe("metadata");
  await submitPreference(file, "other-thread", "first", true);
  expect(savedTurnMode(file, "other-thread", "first")).toBe("full");
});
it("controls block locally and save even when master off; off turns stay off", async () => {
  const input = {
    session_id: "thread",
    turn_id: "control",
    cwd: home,
    prompt: "langsmith-tracing:mute",
  };
  const result = await handlePromptSubmit(input);
  expect(result).toEqual({
    decision: "block",
    reason: expect.stringContaining(
      "Preference saved for the next turn; the current turn is unchanged.",
    ),
  });
  expect(result?.reason).toContain("Master tracing is disabled");
  expect(savedTurnMode(file, "thread", "control")).toBe("off");
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  expect(await handlePromptSubmit({ ...input, prompt: "work", turn_id: "next" })).toBeUndefined();
  expect(savedTurnMode(file, "thread", "next")).toBe("metadata");
});
it.each(["{", "null", '{"version":1,"threads":{"x":{"preference":"full","turns":{"t":"bad"}}}}'])(
  "corrupt policy refuses overwrite and fails closed: %s",
  async (raw) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, raw);
    expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
    const result = await handlePromptSubmit({
      session_id: "thread",
      turn_id: "turn",
      cwd: home,
      prompt: "langsmith-tracing:unmute",
    });
    expect(result?.decision).toBe("block");
    expect(result?.reason).toContain("Refusing to overwrite");
    expect(await fs.readFile(file, "utf8")).toBe(raw);
  },
);
it("missing IDs refuse a control without accepting it as model input", async () => {
  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "",
    cwd: home,
    prompt: "langsmith-tracing:mute",
  });
  expect(result?.decision).toBe("block");
  expect(result?.reason).toContain("native session_id and turn_id");
});
it("serializes concurrent updates, safe prototype IDs, and writes private files", async () => {
  await Promise.all(
    Array.from({ length: 16 }, (_, i) =>
      submitPreference(file, i === 0 ? "__proto__" : `thread-${i}`, "turn", true, "mute"),
    ),
  );
  const policy = JSON.parse(await fs.readFile(file, "utf8"));
  expect(Object.keys(policy.threads)).toHaveLength(16);
  expect(policy.threads.__proto__.preference).toBe("metadata");
  expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  expect(
    (await fs.readdir(path.dirname(file))).filter(
      (name) => name.endsWith(".tmp") || name.endsWith(".lock"),
    ),
  ).toEqual([]);
});
it("never steals a stale lock; retries are bounded and actionable", async () => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.mkdir(`${file}.lock`, { mode: 0o700 });
  await fs.utimes(`${file}.lock`, 0, 0);
  const start = performance.now();
  await expect(submitPreference(file, "thread", "turn", true, "mute")).rejects.toThrow(
    "confirming no preference writer",
  );
  expect(performance.now() - start).toBeGreaterThanOrEqual(2000);
  expect(performance.now() - start).toBeLessThan(2600);
  expect((await fs.stat(`${file}.lock`)).mode & 0o777).toBe(0o700);
});
it("dangling symlinks and unreadable policy directories fail closed", async () => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.symlink(path.join(home, "missing"), file);
  await expect(submitPreference(file, "thread", "turn", true)).rejects.toThrow(
    "Refusing to overwrite",
  );
  await fs.unlink(file);
  await fs.mkdir(file);
  expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
  await expect(submitPreference(file, "thread", "turn", true)).rejects.toThrow(
    "Refusing to overwrite",
  );
});

it("precommit rename failure preserves the old policy and cleans temporary files", async () => {
  await submitPreference(file, "thread", "first", true, "mute");
  const before = await fs.readFile(file, "utf8");
  vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename failed"));
  await expect(submitPreference(file, "thread", "control", true, "unmute")).rejects.toThrow(
    "rename failed",
  );
  expect(await fs.readFile(file, "utf8")).toBe(before);
  expect(await fs.readdir(path.dirname(file))).toEqual([path.basename(file)]);
});
it.each(["writeFile", "sync", "close"] as const)(
  "precommit temp %s failure preserves the old policy",
  async (fault) => {
    await submitPreference(file, "thread", "first", true, "mute");
    const before = await fs.readFile(file, "utf8");
    const original = fs.open;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await original(...args);
      if (String(args[0]).endsWith(".tmp")) {
        const close = handle.close.bind(handle);
        vi.spyOn(handle, fault).mockImplementationOnce(async () => {
          if (fault === "close") await close();
          throw new Error(`${fault} failed`);
        });
      }
      return handle;
    });
    await expect(submitPreference(file, "thread", "control", true, "unmute")).rejects.toThrow(
      `${fault} failed`,
    );
    expect(await fs.readFile(file, "utf8")).toBe(before);
    expect(await fs.readdir(path.dirname(file))).toEqual([path.basename(file)]);
  },
);
it.each(["directory open", "directory sync", "directory close", "lock rmdir"])(
  "postcommit %s failure reports saved with a warning",
  async (fault) => {
    await submitPreference(file, "thread", "first", true, "mute");
    const original = fs.open;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      if (String(args[0]) !== path.dirname(file)) return original(...args);
      if (fault === "directory open") throw new Error(`${fault} failed`);
      const handle = await original(...args);
      if (fault === "directory sync")
        vi.spyOn(handle, "sync").mockRejectedValueOnce(new Error(`${fault} failed`));
      if (fault === "directory close") {
        const close = handle.close.bind(handle);
        vi.spyOn(handle, "close").mockImplementationOnce(async () => {
          await close();
          throw new Error(`${fault} failed`);
        });
      }
      return handle;
    });
    if (fault === "lock rmdir")
      vi.spyOn(fs, "rmdir").mockRejectedValueOnce(new Error(`${fault} failed`));
    const result = await handlePromptSubmit({
      session_id: "thread",
      turn_id: "control",
      cwd: home,
      prompt: "langsmith-tracing:unmute",
    });
    expect(result?.reason).toContain(
      "Preference saved for the next turn; the current turn is unchanged.",
    );
    expect(result?.reason).toContain(`Warning:`);
    expect(result?.reason).toContain(`${fault} failed`);
    expect(result?.reason).not.toContain("Could not");
    expect(JSON.parse(await fs.readFile(file, "utf8")).threads.thread.preference).toBe("full");
  },
);
it("ordinary prompts also fail closed rather than start without durable evidence", async () => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "broken");
  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "work",
    cwd: home,
    prompt: "work",
  });
  expect(result?.decision).toBe("block");
  expect(await fs.readFile(file, "utf8")).toBe("broken");
});

it("serializes independent hook processes and retains preferences after restart", async () => {
  const run = promisify(execFile);
  const moduleUrl = new URL("../src/tracing-policy.ts", import.meta.url).href;
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      run(process.execPath, [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import { submitPreference } from ${JSON.stringify(moduleUrl)}; await submitPreference(${JSON.stringify(file)}, "process-${i}", "control", true, "mute");`,
      ]),
    ),
  );
  expect(Object.keys(JSON.parse(await fs.readFile(file, "utf8")).threads)).toHaveLength(8);
  await run(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "-e",
    `import { submitPreference } from ${JSON.stringify(moduleUrl)}; await submitPreference(${JSON.stringify(file)}, "process-0", "after-restart", true);`,
  ]);
  expect(savedTurnMode(file, "process-0", "after-restart")).toBe("metadata");
});

it("normal submissions never materialize a default preference; existing threads follow config", async () => {
  expect(savedTurnMode(file, "thread", "missing")).toBe("metadata");
  await expect(fs.readFile(file, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  await submitPreference(file, "thread", "full", true, undefined, false);
  await submitPreference(file, "thread", "muted", true, undefined, true);
  await submitPreference(file, "new-muted", "first", true, undefined, true);
  await submitPreference(file, "thread", "off", false, undefined, true);
  await submitPreference(file, "thread", "future", true, undefined, false);
  // Repeated launch IDs retain all three snapshot modes despite config changes.
  for (const turn of ["full", "muted", "off"])
    await submitPreference(file, "thread", turn, true, undefined, false);
  const policy = JSON.parse(await fs.readFile(file, "utf8"));
  expect(policy).toEqual({
    version: 1,
    threads: {
      thread: { turns: { full: "full", muted: "metadata", off: "off", future: "full" } },
      "new-muted": { turns: { first: "metadata" } },
    },
  });
});
it.each([true, false])(
  "explicit overrides win over changing defaults, initial=%s",
  async (initial) => {
    await submitPreference(file, "thread", "control", true, "unmute", initial);
    await submitPreference(file, "thread", "unmuted", true, undefined, true);
    expect(savedTurnMode(file, "thread", "unmuted")).toBe("full");
    await submitPreference(file, "thread", "unmuted", true, "mute", false);
    await submitPreference(file, "thread", "muted", true, undefined, false);
    expect(savedTurnMode(file, "thread", "muted")).toBe("metadata");
    expect(savedTurnMode(file, "thread", "control")).toBe(initial ? "metadata" : "full");
    expect(savedTurnMode(file, "thread", "unknown")).toBe("metadata");
  },
);
it.each(["full", "metadata", "off"] as const)(
  "inheritance preserves %s launch, not config or child preference",
  async (mode) => {
    await inheritThreadMode(file, "child", mode);
    expect(JSON.parse(await fs.readFile(file, "utf8")).threads.child).toEqual({
      inherited: mode,
      turns: {},
    });
    await submitPreference(file, "child", "control", true, "unmute", true);
    await submitPreference(file, "child", "next", true, undefined, false);
    await inheritThreadMode(file, "child", "metadata");
    expect(savedTurnMode(file, "child", "next")).toBe(mode);
  },
);
it("the hook resolves config at each submission using payload cwd, without saving a global default", async () => {
  const cwd = path.join(home, "project");
  await fs.mkdir(path.join(cwd, ".codex"), { recursive: true });
  const configPath = path.join(cwd, ".codex/langsmith.json");
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  const input = { session_id: "thread", turn_id: "muted", cwd, prompt: "work" };
  await fs.writeFile(configPath, JSON.stringify({ defaultMuted: true }));
  expect(await handlePromptSubmit(input)).toBeUndefined();
  await fs.writeFile(configPath, JSON.stringify({ defaultMuted: false }));
  expect(await handlePromptSubmit({ ...input, turn_id: "full" })).toBeUndefined();
  vi.stubEnv("LANGSMITH_CODEX_DEFAULT_MUTED", "true");
  expect(await handlePromptSubmit({ ...input, turn_id: "env-muted" })).toBeUndefined();
  await fs.writeFile(configPath, JSON.stringify({ defaultMuted: true }));
  vi.stubEnv("LANGSMITH_CODEX_DEFAULT_MUTED", "false");
  expect(await handlePromptSubmit({ ...input, turn_id: "env-full" })).toBeUndefined();
  // Re-submitting earlier turn IDs cannot rewrite their immutable launch snapshots.
  expect(await handlePromptSubmit(input)).toBeUndefined();
  expect(JSON.parse(await fs.readFile(file, "utf8"))).toEqual({
    version: 1,
    threads: {
      thread: {
        turns: { muted: "metadata", full: "full", "env-muted": "metadata", "env-full": "full" },
      },
    },
  });
});
it.each([
  { version: 1, default: "full", threads: {} },
  { version: 1, defaultMuted: false, threads: {} },
  { version: 1, threads: { thread: { preference: null, turns: {} } } },
  { version: 1, threads: { thread: { preference: "off", turns: {} } } },
  { version: 1, threads: { thread: { turns: {}, unexpected: true } } },
])("strict policy rejects invalid/extra state without migration: %j", async (policy) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const raw = JSON.stringify(policy);
  await fs.writeFile(file, raw);
  expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
  await expect(submitPreference(file, "thread", "turn", true, "unmute", false)).rejects.toThrow(
    "Refusing to overwrite",
  );
  expect(await fs.readFile(file, "utf8")).toBe(raw);
});

it("unmute under default mute saves an explicit override even while master off", async () => {
  vi.stubEnv("LANGSMITH_CODEX_DEFAULT_MUTED", "true");
  const input = {
    session_id: "thread",
    turn_id: "off",
    cwd: home,
    prompt: "langsmith-tracing:unmute",
  };
  const result = await handlePromptSubmit(input);
  expect(result?.decision).toBe("block");
  expect(result?.reason).toContain("Master tracing is disabled");
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  expect(await handlePromptSubmit({ ...input, turn_id: "next", prompt: "work" })).toBeUndefined();
  expect(savedTurnMode(file, "thread", "off")).toBe("off");
  expect(savedTurnMode(file, "thread", "next")).toBe("full");
});
