import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

const launch = vi.hoisted(() => ({ person: true, notice: "key rejected" as string | undefined }));

vi.mock("../src/utils/launcher.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/launcher.js")>();
  return { ...actual, launchedByPerson: vi.fn(() => launch.person) };
});
vi.mock("@langchain/plugins-base/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langchain/plugins-base/auth")>()),
  readLoginNotice: () => launch.notice,
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
  launch.person = true;
  launch.notice = "key rejected";
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

it("only reminds an exec run or a muted conversation in strict mode", async () => {
  launch.person = false;
  expect(await submit("one")).toEqual({ systemMessage: "key rejected" });
  launch.person = true;
  await submit("mute", "langsmith-tracing:mute", "muted");
  expect(await submit("one", "work", "muted")).toBeUndefined();
});

it.skipIf(process.platform === "win32")(
  "reads whether Codex was started by exec from the real process list",
  async () => {
    const actual = await vi.importActual<typeof import("../src/utils/launcher.js")>(
      "../src/utils/launcher.js",
    );
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "codex-launcher-"));
    await fs.writeFile(path.join(folder, "codex"), "#!/bin/sh\nsleep 30\n", { mode: 0o755 });
    const started = (args: string[]) => {
      const child = spawn(path.join(folder, "codex"), args, { stdio: "ignore" });
      return { id: child.pid!, stop: () => child.kill() };
    };
    const exec = started(["exec", "say ok"]);
    const person = started(["--model", "m"]);
    try {
      await vi.waitFor(() => expect(actual.launchedByPerson(undefined, person.id)).toBe(true));
      expect(actual.launchedByPerson(undefined, exec.id)).toBe(false);
      expect(actual.launchedByPerson(() => undefined, person.id)).toBe(false);
    } finally {
      exec.stop();
      person.stop();
    }
  },
);
