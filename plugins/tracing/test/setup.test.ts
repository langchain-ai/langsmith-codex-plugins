import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";
import { handlePromptSubmit, parseSetupCommand } from "../src/user-prompt-submit.js";
import { uploadAuth, uploadReplicas } from "../src/tracing-engine.js";
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

it("recognizes only the setup command, with or without arguments", () => {
  expect(parseSetupCommand("langsmith-tracing:setup")).toBe("");
  expect(parseSetupCommand("langsmith-tracing:setup my-project https://example.test")).toBe(
    " my-project https://example.test",
  );
  expect(parseSetupCommand("langsmith-tracing:setupx")).toBeUndefined();
  expect(parseSetupCommand("please run langsmith-tracing:setup")).toBeUndefined();
});

it("turns tracing on for the next turn and replies with where traces go", async () => {
  const reply = await setup("langsmith-tracing:setup");

  expect(JSON.parse(await fs.readFile(configFile, "utf8"))).toEqual({ enabled: true });
  expect(reply).toMatch(/^\[LangSmith tracing command\] /u);
  expect(reply).toContain(`Turned LangSmith tracing on in ${configFile}.`);
  expect(reply).toContain('Traces go to the "codex" project at "https://api.smith.langchain.com".');
  expect(savedTurnMode(defaultPrivacyPath(), "thread", "setup")).toBe("off");
  expect(reply).not.toContain("This thread is muted");
});

it("sets the project and URL while keeping every other key", async () => {
  await seed({ api_key: "lsv2_synthetic", redact: true });

  const reply = await setup("langsmith-tracing:setup team-traces https://eu.example.test");

  expect(JSON.parse(await fs.readFile(configFile, "utf8"))).toEqual({
    api_key: "lsv2_synthetic",
    redact: true,
    enabled: true,
    project: "team-traces",
    api_url: "https://eu.example.test",
  });
  expect(reply).toContain('Traces go to the "team-traces" project at "https://eu.example.test".');
  expect(reply).toContain("Using your LangSmith API key.");
});

it("passes a broken config file through as the reply and leaves it alone", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(configFile, "{broken");

  const reply = await setup("langsmith-tracing:setup team-traces");

  expect(reply).toContain(`Couldn't read ${configFile} as a JSON object`);
  expect(await fs.readFile(configFile, "utf8")).toBe("{broken");
});

it.each([
  {
    name: "takes a non-breaking space after the command name",
    prompt: "langsmith-tracing:setup team-traces",
    contains: ['"team-traces" project'],
  },
  {
    name: "refuses a setup line followed by another request",
    prompt: "langsmith-tracing:setup\nRefactor src/auth.ts",
    contains: ["Setup takes its project and URL on one line"],
  },
  {
    name: "warns that default muting keeps the thread muted",
    env: { LANGSMITH_CODEX_DEFAULT_MUTED: "true" },
    contains: ["This thread is muted"],
  },
  {
    name: "reports the values in effect when the environment overrides setup",
    prompt: "langsmith-tracing:setup team-traces",
    env: { LANGSMITH_PROJECT: "from-env" },
    contains: ['Traces go to the "from-env" project', "Another setting overrides part of this"],
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
    name: "reports a key LangSmith already rejected",
    settings: { api_key: "lsv2_synthetic" },
    notice: "Your LangSmith API key was rejected.",
    contains: ["Your LangSmith API key was rejected."],
    absent: ["Using your LangSmith API key."],
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
    name: "names replica destinations instead of a project that receives nothing",
    prompt: "langsmith-tracing:setup team-traces",
    settings: { replicas: [KEYED, { ...KEYED, project: "other" }] },
    contains: ["Traces go to the 2 replica destinations", "Another setting overrides part of this"],
    absent: ['"team-traces" project'],
  },
  {
    name: "counts only kept replicas and leaves a skipped-replica notice out under a login",
    settings: { replicas: [KEYED, OFF_SERVER] },
    login: LOGIN_URL,
    contains: ["Traces go to the replica destination in", "Signed in with the LangSmith CLI."],
    absent: ["need their own API key"],
  },
  {
    name: "counts only replicas with their own key when nothing else is signed in",
    settings: { replicas: [KEYED, { project: "skipped" }] },
    contains: ["Traces go to the replica destination in", "Using your LangSmith API key."],
  },
  {
    name: "counts keyless replicas the main API key covers",
    settings: { api_key: "lsv2_synthetic", replicas: [{ project: "copy" }, { project: "other" }] },
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

it("doesn't repeat a notice the setup reply already shows", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", undefined);

  const result = await handlePromptSubmit({
    session_id: "thread",
    turn_id: "setup",
    cwd: home,
    prompt: "langsmith-tracing:setup",
  });

  expect(result?.hookSpecificOutput?.additionalContext).toContain(
    "You're not signed in to LangSmith",
  );
  expect(result?.systemMessage).toBeUndefined();
});

it.skipIf(process.platform === "win32")(
  "reports a broken managed file, since nothing uploads while it's broken",
  async () => {
    await seed({ api_key: "lsv2_synthetic" });
    const managed = path.join(process.env.LS_TEST_ACCOUNT_HOME!, ".langsmith-plugins");
    await fs.mkdir(managed, { recursive: true });
    await fs.writeFile(path.join(managed, "managed.json"), "{}");
    try {
      const reply = await setup("langsmith-tracing:setup");

      expect(reply).toContain("aren't owned by root");
      expect(reply).not.toContain("Using your LangSmith API key.");
    } finally {
      await fs.rm(path.join(managed, "managed.json"));
    }
  },
);

it("reports an unsaved preference and stays muted when the preference file can't be read", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(defaultPrivacyPath(), "{not json");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Could not save tracing preference/turn evidence");
  expect(reply).toContain("This thread is muted");
  expect(reply).not.toContain("..");
});

it("keeps keyless replicas on the CLI login's server or with no URL", async () => {
  await seed({ replicas: [{ api_url: LOGIN_URL, project: "same-server" }, { project: "no-url" }] });
  auth.loginUrl = LOGIN_URL;

  const reply = await setup("langsmith-tracing:setup");
  const config = await getConfig({ home, cwd: home, env: process.env });
  const login = uploadAuth(config);

  expect(reply).toContain("Traces go to the 2 replica destinations");
  expect(login?.kind).toBe("login");
  expect(uploadReplicas(config, login!)?.map(({ projectName }) => projectName)).toEqual([
    "same-server",
    "no-url",
  ]);
});
