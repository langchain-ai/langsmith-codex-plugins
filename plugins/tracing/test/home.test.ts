import * as path from "node:path";
import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";
import { homeDirectory } from "../src/utils/home.js";

const HOME = "/users/codex-user";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/users/codex-user",
}));

beforeEach(() => {
  vol.reset();
  vi.stubEnv("HOME", undefined);
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key)) vi.stubEnv(key, undefined);
  }
});
afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
});

it("falls back to the operating system home when HOME is unset", () => {
  expect(homeDirectory()).toBe(HOME);
  vi.stubEnv("HOME", "/somewhere/else");
  expect(homeDirectory()).toBe("/somewhere/else");
});

it("reads the user-level config in the prompt hook when HOME is unset", async () => {
  vol.fromJSON({
    [path.join(HOME, ".codex", "langsmith.json")]: JSON.stringify({ enabled: true }),
  });
  const privacyPath = path.join(HOME, ".codex", "langsmith_state_privacy.json");
  await handlePromptSubmit({
    session_id: "thread",
    turn_id: "turn",
    cwd: "/workspace",
    prompt: "work",
  });
  const policy = JSON.parse(vol.readFileSync(privacyPath, "utf8") as string);
  expect(policy.threads.thread.turns.turn).toBe("full");
});

it("keeps the hook capture marker while any project captures, and drops it a day after", async () => {
  const marker = path.join(HOME, ".codex", "langsmith_engine", "capture-hook-outputs");
  vol.fromJSON({
    [path.join(HOME, ".codex", "langsmith.json")]: JSON.stringify({ enabled: true }),
    "/on/langsmith-plugins.json": JSON.stringify({ capture_hook_outputs: true }),
    "/off/langsmith-plugins.json": "{}",
    "/untraced/langsmith-plugins.json": JSON.stringify({
      enabled: false,
      capture_hook_outputs: true,
    }),
  });
  const base = { session_id: "thread", turn_id: "turn", prompt: "work" };
  const prompt = (cwd: string) =>
    handlePromptSubmit({ ...base, cwd, transcript_path: `${cwd}/rollout.jsonl` });
  const fired = (cwd: string) => vol.existsSync(`${cwd}/rollout.jsonl.langsmith-hooks`);

  await prompt("/untraced");
  expect(vol.existsSync(marker)).toBe(false);
  await prompt("/on");
  await prompt("/off");
  expect(vol.existsSync(marker)).toBe(true);
  expect([fired("/untraced"), fired("/on"), fired("/off")]).toEqual([false, true, false]);
  vol.utimesSync(marker, 0, 0);
  await prompt("/off");
  expect(vol.existsSync(marker)).toBe(false);
});
