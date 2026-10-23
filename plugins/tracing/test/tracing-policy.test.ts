import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { tryAcquireFileLock } from "@langchain/plugins-base/storage";
import { updatePolicyFile } from "@langchain/plugins-base/plugin";
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
import { showPendingWarning } from "../src/warnings.js";

vi.mock("@langchain/plugins-base/plugin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@langchain/plugins-base/plugin")>();
  return { ...actual, updatePolicyFile: vi.fn(actual.updatePolicyFile) };
});

let home: string;
let file: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-privacy-"));
  vi.stubEnv("HOME", home);
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key)) vi.stubEnv(key, undefined);
  }
  vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", "off");
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
  await submitPreference(file, { sessionId: "thread", turnId: "active", enabled: true });
  await submitPreference(file, { sessionId: "thread", turnId: "queued", enabled: true });
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "active",
    enabled: true,
    command: "mute",
  });
  expect(savedTurnMode(file, "thread", "active")).toBe("full");
  expect(savedTurnMode(file, "thread", "queued")).toBe("full");
  await submitPreference(file, { sessionId: "thread", turnId: "private", enabled: true });
  expect(savedTurnMode(file, "thread", "private")).toBe("metadata");
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "private",
    enabled: true,
    command: "unmute",
  });
  await submitPreference(file, { sessionId: "thread", turnId: "future", enabled: true });
  expect(savedTurnMode(file, "thread", "private")).toBe("metadata");
  expect(savedTurnMode(file, "thread", "future")).toBe("full");
  expect(savedTurnMode(file, "thread", "historical-no-evidence")).toBe("metadata");
  await submitPreference(file, { sessionId: "other-thread", turnId: "first", enabled: true });
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
it("keeps a thread named like an object prototype key", async () => {
  await submitPreference(file, {
    sessionId: "__proto__",
    turnId: "turn",
    enabled: true,
    command: "mute",
  });
  const policy = JSON.parse(await fs.readFile(file, "utf8"));
  expect(Object.hasOwn(policy.threads, "__proto__")).toBe(true);
  expect(policy.threads.__proto__.preference).toBe("metadata");
});
it("reads an unreadable preference file as metadata-only for the next Stop", async () => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.symlink(path.join(home, "missing"), file);
  expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
  await fs.unlink(file);
  await fs.mkdir(file);
  expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
});
it("shows the save warning the shared store returns in the control reply", async () => {
  vi.mocked(updatePolicyFile).mockResolvedValueOnce({ warning: "directory sync failed" });
  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "control",
    cwd: home,
    prompt: "langsmith-tracing:unmute",
  });
  expect(result?.reason).toContain("Warning: directory sync failed.");
});
it.each(["corrupt", "unreadable", "locked"] as const)(
  "an ordinary prompt goes through with a warning when the preference file is %s",
  async (fault) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (fault === "corrupt") await fs.writeFile(file, "broken");
    if (fault === "unreadable") await fs.mkdir(file);
    const blocker = fault === "locked" ? await tryAcquireFileLock(file) : undefined;
    const warning = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await handlePromptSubmit({
        session_id: "thread",
        turn_id: "work",
        cwd: home,
        prompt: "work",
      });
      expect(result).toBeUndefined();
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("Could not save tracing preference/turn evidence"),
      );
    } finally {
      await blocker?.release();
    }
    if (fault === "corrupt") expect(await fs.readFile(file, "utf8")).toBe("broken");
  },
);
it("normal submissions never materialize a default preference; existing threads follow config", async () => {
  expect(savedTurnMode(file, "thread", "missing")).toBe("metadata");
  await expect(fs.stat(file)).rejects.toMatchObject({ code: "ENOENT" });
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "full",
    enabled: true,
    defaultMuted: false,
  });
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "muted",
    enabled: true,
    defaultMuted: true,
  });
  await submitPreference(file, {
    sessionId: "new-muted",
    turnId: "first",
    enabled: true,
    defaultMuted: true,
  });
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "off",
    enabled: false,
    defaultMuted: true,
  });
  await submitPreference(file, {
    sessionId: "thread",
    turnId: "future",
    enabled: true,
    defaultMuted: false,
  });
  // Repeated launch IDs retain all three snapshot modes despite config changes.
  for (const turn of ["full", "muted", "off"])
    await submitPreference(file, {
      sessionId: "thread",
      turnId: turn,
      enabled: true,
      defaultMuted: false,
    });
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
    await submitPreference(file, {
      sessionId: "thread",
      turnId: "control",
      enabled: true,
      command: "unmute",
      defaultMuted: initial,
    });
    await submitPreference(file, {
      sessionId: "thread",
      turnId: "unmuted",
      enabled: true,
      defaultMuted: true,
    });
    expect(savedTurnMode(file, "thread", "unmuted")).toBe("full");
    await submitPreference(file, {
      sessionId: "thread",
      turnId: "unmuted",
      enabled: true,
      command: "mute",
      defaultMuted: false,
    });
    await submitPreference(file, {
      sessionId: "thread",
      turnId: "muted",
      enabled: true,
      defaultMuted: false,
    });
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
    await submitPreference(file, {
      sessionId: "child",
      turnId: "control",
      enabled: true,
      command: "unmute",
      defaultMuted: true,
    });
    await submitPreference(file, {
      sessionId: "child",
      turnId: "next",
      enabled: true,
      defaultMuted: false,
    });
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
  { version: 2, threads: {} },
  { version: 1, default: "full", threads: {} },
  { version: 1, threads: { thread: { inherited: "bad", turns: {} } } },
  { version: 1, defaultMuted: false, threads: {} },
  { version: 1, threads: { thread: { preference: null, turns: {} } } },
  { version: 1, threads: { thread: { preference: "off", turns: {} } } },
  { version: 1, threads: { thread: { turns: {}, unexpected: true } } },
])("strict policy rejects invalid/extra state without migration: %j", async (policy) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const raw = JSON.stringify(policy);
  await fs.writeFile(file, raw);
  expect(savedTurnMode(file, "thread", "turn")).toBe("metadata");
  await expect(
    submitPreference(file, {
      sessionId: "thread",
      turnId: "turn",
      enabled: true,
      command: "unmute",
      defaultMuted: false,
    }),
  ).rejects.toThrow("Refusing to overwrite");
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

it("carries 0.2.0's preferences over on first use and leaves its file for a rollback", async () => {
  const legacy = path.join(path.dirname(file), "langsmith-state.privacy.json");
  const saved = { version: 1, threads: { thread: { preference: "metadata", turns: {} } } };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(legacy, JSON.stringify(saved));

  await submitPreference(file, { sessionId: "thread", turnId: "next", enabled: true });

  expect(savedTurnMode(file, "thread", "next")).toBe("metadata");
  expect(JSON.parse(await fs.readFile(legacy, "utf8"))).toEqual(saved);
});

it("never replaces existing preferences with 0.2.0's older file", async () => {
  await submitPreference(file, { sessionId: "thread", turnId: "now", enabled: true });
  const legacy = path.join(path.dirname(file), "langsmith-state.privacy.json");
  const stale = { version: 1, threads: { thread: { preference: "metadata", turns: {} } } };
  await fs.writeFile(legacy, JSON.stringify(stale));

  expect(savedTurnMode(file, "thread", "now")).toBe("full");
});

it.skipIf(process.platform === "win32")(
  "names a broken managed file once per cooldown and in a mute reply without blocking a prompt",
  async () => {
    vi.stubEnv("TRACE_TO_LANGSMITH", "true");
    const shown: unknown[] = [];
    vi.spyOn(console, "warn").mockImplementation((line) => shown.push(line));
    vi.spyOn(console, "error").mockImplementation((line) => shown.push(line));
    const submit = async (session_id: string, turn_id: string, prompt = "work") => {
      const result = await handlePromptSubmit({ session_id, turn_id, cwd: home, prompt });
      await showPendingWarning(home);
      return result;
    };
    const managed = path.join(process.env.LS_TEST_ACCOUNT_HOME!, ".langsmith-plugins");
    try {
      expect(await submit("thread", "healthy")).toBeUndefined();
      await fs.mkdir(managed, { recursive: true });
      await fs.writeFile(path.join(managed, "managed.json"), "{}");
      vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", "off");
      expect(await submit("thread", "silenced")).toBeUndefined();
      vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", undefined);
      expect(await submit("thread", "first")).toEqual({
        systemMessage: expect.stringContaining("aren't owned by root"),
      });
      expect(await submit("other", "first")).toBeUndefined();
      const reply = await submit("thread", "control", "langsmith-tracing:mute");
      expect(reply?.reason).toContain("aren't owned by root");
      expect(reply?.reason).not.toContain("Master tracing is disabled");
      expect(shown).toEqual([]);
    } finally {
      await fs.rm(path.join(managed, "managed.json"));
    }
  },
);
