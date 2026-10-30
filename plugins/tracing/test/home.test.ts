import * as path from "node:path";
import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadHookFirings, pruneHookFirings } from "../src/sidecar.js";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";
import { homeDirectory } from "../src/utils/home.js";

const HOME = "/users/codex-user";
const ENGINE = path.join(HOME, ".codex", "langsmith_engine");

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
  const marker = path.join(ENGINE, "capture-hook-outputs");
  vol.fromJSON({
    [path.join(HOME, ".codex", "langsmith.json")]: JSON.stringify({ enabled: true }),
    "/on/langsmith-plugins.json": JSON.stringify({ capture_hook_outputs: true }),
    "/off/langsmith-plugins.json": "{}",
    "/untraced/langsmith-plugins.json": JSON.stringify({
      enabled: false,
      capture_hook_outputs: true,
    }),
  });
  const prompt = (cwd: string) =>
    handlePromptSubmit({ session_id: "thread", turn_id: cwd.slice(1), cwd, prompt: "work" });
  const fired = (turn: string) =>
    vol.existsSync(path.join(ENGINE, `hook-firings-thread-${turn}.jsonl`));

  await prompt("/untraced");
  expect(vol.existsSync(marker)).toBe(false);
  await prompt("/on");
  await prompt("/off");
  expect(vol.existsSync(marker)).toBe(true);
  expect([fired("untraced"), fired("on"), fired("off")]).toEqual([false, true, false]);
  vol.utimesSync(marker, 0, 0);
  await prompt("/off");
  expect(vol.existsSync(marker)).toBe(false);
});

it("drops hook firing files older than six hours and leaves every other file", async () => {
  const files = ["hook-firings-old-t.jsonl", "hook-firings-new-t.jsonl", "engine-owned.json"];
  vol.fromJSON(Object.fromEntries(files.map((name) => [path.join(ENGINE, name), ""])));
  const sevenHoursAgo = (Date.now() - 7 * 60 * 60 * 1000) / 1000;
  for (const name of [files[0], files[2]]) {
    vol.utimesSync(path.join(ENGINE, name), sevenHoursAgo, sevenHoursAgo);
  }

  await pruneHookFirings();

  expect(vol.readdirSync(ENGINE).toSorted()).toEqual([
    "engine-owned.json",
    "hook-firings-new-t.jsonl",
  ]);
});

it("loads a session's hook firings from all its turn files in time order", async () => {
  const line = (event: string, time: number) => JSON.stringify({ event, time });
  vol.fromJSON({
    [path.join(ENGINE, "hook-firings-thread-t1.jsonl")]: `${line("b", 2)}\n${line("d", 4)}\n`,
    [path.join(ENGINE, "hook-firings-thread-session.jsonl")]: line("a", 1),
    [path.join(ENGINE, "hook-firings-other-t1.jsonl")]: line("c", 3),
  });

  expect((await loadHookFirings("thread")).map(({ event }) => event)).toEqual(["a", "b", "d"]);
});
