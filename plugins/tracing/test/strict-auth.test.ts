import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

const launch = vi.hoisted(() => ({
  person: true,
  exec: false,
  notice: "key rejected" as string | undefined,
}));

vi.mock("../src/utils/rollout.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/rollout.js")>();
  return { ...actual, startedByPerson: vi.fn(async () => launch.person) };
});
vi.mock("../src/utils/launcher.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/launcher.js")>();
  return { ...actual, launchedByExec: vi.fn(() => launch.exec) };
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
  launch.exec = false;
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

it("refuses a prompt in strict mode when nothing is signed in at all", async () => {
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", undefined);
  expect(await submit("one")).toEqual({
    decision: "block",
    reason: expect.stringContaining("isn't signed in"),
  });
});

it("only reminds without strict mode", async () => {
  vi.stubEnv("LANGSMITH_CODEX_STRICT_AUTH", undefined);
  expect(await submit("one")).toEqual({ systemMessage: "key rejected" });
});

it("only reminds an exec run, even one resuming a person's session", async () => {
  launch.exec = true;
  expect(await submit("one")).toEqual({ systemMessage: "key rejected" });
});

it("only reminds a session a script started or a muted conversation in strict mode", async () => {
  launch.person = false;
  expect(await submit("one")).toEqual({ systemMessage: "key rejected" });
  launch.person = true;
  await submit("mute", "langsmith-tracing:mute", "muted");
  expect(await submit("one", "work", "muted")).toBeUndefined();
});

it("counts only a terminal or editor session as a person typing", async () => {
  const actual =
    await vi.importActual<typeof import("../src/utils/rollout.js")>("../src/utils/rollout.js");
  const rollout = async (source: unknown) => {
    const file = path.join(home, `${JSON.stringify(source)}.jsonl`);
    const meta = { timestamp: "t", type: "session_meta", payload: { id: "s", source } };
    await fs.writeFile(file, `${JSON.stringify(meta)}\n{"type":"event_msg"}\n`);
    return file;
  };
  expect(await actual.startedByPerson(await rollout("cli"))).toBe(true);
  expect(await actual.startedByPerson(await rollout("vscode"))).toBe(true);
  expect(await actual.startedByPerson(await rollout("exec"))).toBe(false);
  expect(await actual.startedByPerson(await rollout({ subagent: "review" }))).toBe(false);
  expect(await actual.startedByPerson(path.join(home, "missing.jsonl"))).toBe(false);
  expect(await actual.startedByPerson(undefined)).toBe(false);
});

it.skipIf(process.platform === "win32")(
  "reads an exec launch, including exec resume, from the real process list, and counts an unknown one as exec",
  async () => {
    const actual = await vi.importActual<typeof import("../src/utils/launcher.js")>(
      "../src/utils/launcher.js",
    );
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "codex launcher "));
    await fs.writeFile(path.join(folder, "codex"), "#!/bin/sh\nsleep 30\n", { mode: 0o755 });
    const started = (args: string[]) =>
      spawn(path.join(folder, "codex"), args, { stdio: "ignore" });
    const resumed = started(["exec", "resume", "id", "go"]);
    const person = started(["resume", "--last"]);
    try {
      await vi.waitFor(() => expect(actual.launchedByExec(undefined, resumed.pid!)).toBe(true));
      expect(actual.launchedByExec(undefined, person.pid!)).toBe(false);
      expect(actual.launchedByExec(() => undefined, person.pid!)).toBe(true);
    } finally {
      resumed.kill();
      person.kill();
    }
  },
);
