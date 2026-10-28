import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

const launch = vi.hoisted(() => ({
  notice: "key rejected" as string | undefined,
  profile: undefined as string | undefined,
}));

vi.mock("@langchain/plugins-base/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langchain/plugins-base/auth")>()),
  readLoginNotice: (...args: unknown[]) => {
    launch.profile = args[3] as string | undefined;
    return launch.notice;
  },
}));

let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-strict-"));
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key)) vi.stubEnv(key, undefined);
  }
  vi.stubEnv("HOME", home);
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", "synthetic-key");
  vi.stubEnv("LANGSMITH_CODEX_STRICT_AUTH", "true");
  launch.notice = "key rejected";
  launch.profile = undefined;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const submit = (turn_id: string, prompt = "work", session_id = "thread") =>
  handlePromptSubmit({ session_id, turn_id, cwd: home, prompt });

it("refuses every prompt in strict mode until the key is fixed", async () => {
  expect(await submit("one")).toEqual({ decision: "block", reason: "key rejected" });
  expect(await submit("two")).toEqual({ decision: "block", reason: "key rejected" });
  launch.notice = undefined;
  expect(await submit("three")).toBeUndefined();
});

it("refuses a prompt in strict mode when nothing is signed in at all", async () => {
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", undefined);
  expect(await submit("one")).toEqual({
    decision: "block",
    reason: expect.stringContaining("not signed in to LangSmith"),
  });
});

it("only reminds without strict mode", async () => {
  vi.stubEnv("LANGSMITH_CODEX_STRICT_AUTH", undefined);
  expect(await submit("one")).toEqual({ systemMessage: "key rejected" });
});

it("refuses a muted conversation in strict mode too", async () => {
  await submit("mute", "langsmith-tracing:mute", "muted");
  expect(await submit("one", "work", "muted")).toEqual({
    decision: "block",
    reason: "key rejected",
  });
});

it("asks for the sign-in notice of the configured CLI profile", async () => {
  await fs.writeFile(path.join(home, ".langsmith-plugins.json"), '{"profile":"work"}');
  await submit("one");
  expect(launch.profile).toBe("work");
});
