import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";
import { savedTurnMode, defaultPrivacyPath } from "../src/tracing-policy.js";

const auth = vi.hoisted(() => ({
  loginUrl: undefined as string | undefined,
  notice: undefined as string | undefined,
}));

vi.mock("@langchain/plugins-base/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@langchain/plugins-base/auth")>();
  return {
    ...actual,
    resolveUploadCredential: (...args: Parameters<typeof actual.resolveUploadCredential>) =>
      auth.loginUrl === undefined
        ? actual.resolveUploadCredential(...args)
        : { kind: "login", login: {}, apiUrl: auth.loginUrl },
    readLoginNotice: (...args: Parameters<typeof actual.readLoginNotice>) =>
      auth.notice ?? actual.readLoginNotice(...args),
  };
});

let home: string;
let configFile: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-setup-"));
  configFile = path.join(home, ".codex", "langsmith.json");
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key)) vi.stubEnv(key, undefined);
  }
  vi.stubEnv("HOME", home);
  vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", "off");
  auth.loginUrl = undefined;
  auth.notice = undefined;
});

const seed = async (settings: object) => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(configFile, JSON.stringify(settings));
};

const LOGIN_URL = "https://eu.api.smith.langchain.com";
const KEYED = { api_key: "lsv2_synthetic", project: "copy" };
const OFF_SERVER = { api_url: "https://other.example.test", project: "skipped" };

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const setup = async (prompt: string) => {
  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "setup",
    cwd: home,
    prompt,
  });
  expect(result?.decision).toBeUndefined();
  return result?.hookSpecificOutput?.additionalContext;
};

it("turns tracing on for the next turn and replies with where traces go", async () => {
  const reply = await setup("langsmith-tracing:setup");

  expect(JSON.parse(await fs.readFile(configFile, "utf8"))).toEqual({ enabled: true });
  expect(reply).toMatch(/^\[LangSmith tracing command\] /u);
  expect(reply).toContain(`Turned LangSmith tracing on in ${configFile}.`);
  expect(reply).toContain('Traces go to the "codex" project at "https://api.smith.langchain.com".');
  expect(savedTurnMode(defaultPrivacyPath(), "thread", "setup")).toBe("off");
  expect(reply).not.toContain("This thread is muted");
});

it.each([
  {
    name: "warns that default muting keeps the thread muted",
    env: { LANGSMITH_CODEX_DEFAULT_MUTED: "true" },
    contains: ["This thread is muted"],
  },
  {
    name: "explains the plugin's own sign-in problem",
    contains: ["You're not signed in to LangSmith"],
    absent: ["No LangSmith login or API key found yet"],
  },
  {
    name: "says tracing is still off when the environment keeps it off",
    env: { TRACE_TO_LANGSMITH: "false" },
    contains: ["Tracing is still off because", "No LangSmith login or API key found yet"],
  },
  {
    name: "reports a CLI login that can't upload because a replica needs its own key",
    settings: { replicas: [OFF_SERVER] },
    login: LOGIN_URL,
    contains: ["replicas on https://other.example.test need their own API key"],
    absent: ["Signed in with the LangSmith CLI."],
  },
  {
    name: "names the CLI login's own URL",
    login: LOGIN_URL,
    contains: [`project at "${LOGIN_URL}".`, "Signed in with the LangSmith CLI."],
  },
  {
    name: "names the agent when one is set",
    settings: { agent_id: "shared-codex" },
    contains: ['Traces go to the "shared-codex" agent'],
  },
  {
    name: "names the URL given to setup when nothing is signed in yet",
    prompt: "langsmith-tracing:setup team-traces https://eu.example.test",
    contains: ['Traces go to the "team-traces" project at "https://eu.example.test".'],
  },
  {
    name: "counts a keyless replica only when the CLI login reaches its server",
    settings: { replicas: [{ api_url: LOGIN_URL, project: "same-server" }, OFF_SERVER] },
    login: LOGIN_URL,
    contains: ["Traces go to the replica destination in"],
  },
  {
    name: "counts the replicas in the plugin's own settings",
    settings: { replicas: [KEYED, { ...KEYED, project: "other" }] },
    contains: ["Traces go to the 2 replica destinations"],
  },
] as {
  name: string;
  prompt?: string;
  settings?: object;
  env?: Record<string, string>;
  login?: string;
  notice?: string;
  contains: string[];
  absent?: string[];
}[])("$name", async ({ prompt, settings, env, login, notice, contains, absent = [] }) => {
  if (settings) await seed(settings);
  for (const [key, value] of Object.entries(env ?? {})) vi.stubEnv(key, value);
  auth.loginUrl = login;
  auth.notice = notice;

  const reply = await setup(prompt ?? "langsmith-tracing:setup");

  for (const text of contains) expect(reply).toContain(text);
  for (const text of absent) expect(reply).not.toContain(text);
});

it("warns that traces stay muted after this thread was muted", async () => {
  await handlePromptSubmit({
    session_id: "thread",
    turn_id: "mute",
    cwd: home,
    prompt: "langsmith-tracing:mute",
  });

  expect(await setup("langsmith-tracing:setup")).toContain("This thread is muted");
});

it.skipIf(process.platform === "win32")(
  "reports a broken managed file, since nothing uploads while it's broken",
  async () => {
    await seed({ api_key: "lsv2_synthetic", replicas: [KEYED] });
    const managed = path.join(process.env.LS_TEST_ACCOUNT_HOME!, ".langsmith-plugins");
    await fs.mkdir(managed, { recursive: true });
    await fs.writeFile(path.join(managed, "managed.json"), "{}");
    try {
      const reply = await setup("langsmith-tracing:setup");

      expect(reply).toContain("aren't owned by root");
      expect(reply).not.toContain("Using your LangSmith API key.");
      expect(reply).not.toContain("replica destination");
    } finally {
      await fs.rm(path.join(managed, "managed.json"));
    }
  },
);

it("shows each notice once beside the setup reply, dropping only the one the reply holds", async () => {
  await seed({ replicas: [KEYED, OFF_SERVER] });
  vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", undefined);
  auth.loginUrl = LOGIN_URL;
  auth.notice = "Your LangSmith login expired.";

  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "setup",
    cwd: home,
    prompt: "langsmith-tracing:setup",
  });

  expect(result?.hookSpecificOutput?.additionalContext).toContain("Your LangSmith login expired.");
  expect(result?.systemMessage).toBe(
    `LangSmith replicas on https://other.example.test need their own API key, so they're skipped.`,
  );
});

it("keeps the unsaved-preference failure when setup itself fails", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(defaultPrivacyPath(), "{not json");

  const reply = await setup(
    "langsmith-tracing:setup https://a.example.test https://b.example.test",
  );

  expect(reply).toContain("Setup takes one URL");
  expect(reply).toContain("Could not save tracing preference/turn evidence");
});

it("reports an unsaved preference and stays muted when the preference file can't be read", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(defaultPrivacyPath(), "{not json");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Could not save tracing preference/turn evidence");
  expect(reply).toContain("This thread is muted");
  expect(reply).not.toContain("..");
});
