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
