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
    const rejected = args[2] as { apiUrl: string } | undefined;
    return launch.notice?.replace("{apiUrl}", rejected?.apiUrl ?? "");
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

it("runs a command in strict mode but still refuses the prompt, reply first", async () => {
  expect(await submit("one", "langsmith-tracing:mute")).toEqual({
    decision: "block",
    reason: expect.stringMatching(/^Thread tracing muted \(metadata-only\)\..*\n\nkey rejected$/su),
  });
  const setup = await submit("two", "langsmith-tracing:setup team-traces");
  expect(setup?.decision).toBe("block");
  expect(setup?.reason).toMatch(/^Turned LangSmith tracing on in .* key rejected$/su);
  expect(setup?.reason?.split("key rejected")).toHaveLength(2);
  expect(
    JSON.parse(await fs.readFile(path.join(home, ".codex", "langsmith.json"), "utf8")),
  ).toEqual({
    enabled: true,
    project: "team-traces",
  });
});

it("refuses a setup prompt with the sign-in problem for the URL setup just saved", async () => {
  await fs.mkdir(path.join(home, ".codex"));
  await fs.writeFile(
    path.join(home, ".codex", "langsmith.json"),
    '{"api_url":"http://127.0.0.1:8"}',
  );
  launch.notice = "key rejected by {apiUrl}";

  const result = await submit("one", "langsmith-tracing:setup proj http://127.0.0.1:9");

  expect(result?.decision).toBe("block");
  expect(result?.reason).toContain("key rejected by http://127.0.0.1:9");
  expect(result?.reason).not.toContain("http://127.0.0.1:8");
});

it("refuses a setup prompt that turns tracing on with nothing signed in", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", undefined);
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", undefined);

  const result = await submit("one", "langsmith-tracing:setup");

  expect(result?.decision).toBe("block");
  expect(result?.reason).toContain("not signed in to LangSmith");
});

it("still refuses a command and an ordinary prompt when the preference file is broken", async () => {
  await fs.mkdir(path.join(home, ".codex"));
  await fs.writeFile(path.join(home, ".codex", "langsmith_state_privacy.json"), "{not json");
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  expect((await submit("one", "langsmith-tracing:mute"))?.reason).toMatch(
    /^Could not save tracing preference.*\n\nkey rejected$/su,
  );
  expect(await submit("two")).toEqual({ decision: "block", reason: "key rejected" });
});
