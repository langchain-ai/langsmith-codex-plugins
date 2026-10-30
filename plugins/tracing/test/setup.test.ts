import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";
import { parseSetupCommand } from "../src/setup.js";
import { uploadAuth, uploadReplicas } from "../src/tracing-engine.js";
import { savedTurnMode, defaultPrivacyPath } from "../src/tracing-policy.js";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

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

it("accepts a non-breaking space after the command name", async () => {
  await setup("langsmith-tracing:setup\u00a0team-traces");

  expect(JSON.parse(await fs.readFile(configFile, "utf8"))).toEqual({
    enabled: true,
    project: "team-traces",
  });
});

it("refuses a setup line followed by another request instead of taking it as the project", async () => {
  const reply = await setup("langsmith-tracing:setup\nRefactor src/auth.ts");

  expect(reply).toContain("Setup takes its project and URL on one line");
  await expect(fs.access(configFile)).rejects.toThrow();
});

it("warns that traces stay muted when muting is on by default", async () => {
  vi.stubEnv("LANGSMITH_CODEX_DEFAULT_MUTED", "true");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("This thread is muted");
});

it("warns that traces stay muted after this thread was muted", async () => {
  await handlePromptSubmit({
    session_id: "thread",
    turn_id: "mute",
    cwd: home,
    prompt: "langsmith-tracing:mute",
  });

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("This thread is muted");
});

it("sets the project and URL while keeping every other key", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(configFile, '{"api_key":"lsv2_synthetic","redact":true}');

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

it("reports the values in effect when the environment overrides setup", async () => {
  vi.stubEnv("LANGSMITH_PROJECT", "from-env");

  const reply = await setup("langsmith-tracing:setup team-traces");

  expect(reply).toContain('Traces go to the "from-env" project');
  expect(reply).toContain("Another setting overrides part of this");
});

it("passes a broken config file through as the reply and leaves it alone", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(configFile, "{broken");

  const reply = await setup("langsmith-tracing:setup team-traces");

  expect(reply).toContain(`Couldn't read ${configFile} as a JSON object`);
  expect(await fs.readFile(configFile, "utf8")).toBe("{broken");
});

it("explains the plugin's own sign-in problem rather than a generic one", async () => {
  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("You're not signed in to LangSmith");
  expect(reply).not.toContain("No LangSmith login or API key found yet");
});

it("says tracing is still off when the environment keeps it off", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "false");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Tracing is still off because an environment variable");
  expect(reply).toContain("No LangSmith login or API key found yet");
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

it("reports a key LangSmith already rejected instead of saying it's in use", async () => {
  await seed({ api_key: "lsv2_synthetic" });
  auth.notice = "Your LangSmith API key was rejected.";

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Your LangSmith API key was rejected.");
  expect(reply).not.toContain("Using your LangSmith API key.");
});

it("reports a CLI login that can't upload because a replica needs its own key", async () => {
  await seed({ replicas: [{ api_url: "https://other.example.test", project: "copy" }] });
  auth.loginUrl = "https://eu.api.smith.langchain.com";

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("replicas on https://other.example.test need their own API key");
  expect(reply).not.toContain("Signed in with the LangSmith CLI.");
});

it("counts a replica's own key as signed in", async () => {
  await seed({ replicas: [{ api_key: "lsv2_synthetic", project: "copy" }] });

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Using your LangSmith API key.");
});

it("names the CLI login's own URL as where traces go", async () => {
  auth.loginUrl = "https://eu.api.smith.langchain.com";

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain('project at "https://eu.api.smith.langchain.com".');
  expect(reply).toContain("Signed in with the LangSmith CLI.");
});

it("names the agent when one is set", async () => {
  await seed({ agent_id: "shared-codex" });

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain('Traces go to the "shared-codex" agent');
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

it("tells the user this turn's preference couldn't be saved", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(defaultPrivacyPath(), "{not json");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Turned LangSmith tracing on");
  expect(reply).toContain("Could not save tracing preference/turn evidence");
  expect(reply).not.toContain("..");
});

it("warns that traces stay muted when the preference file can't be read", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(defaultPrivacyPath(), "{not json");

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("This thread is muted");
});

it("names the URL given to setup when nothing is signed in yet", async () => {
  const reply = await setup("langsmith-tracing:setup team-traces https://eu.example.test");

  expect(reply).toContain('Traces go to the "team-traces" project at "https://eu.example.test".');
});

it("names the replica destinations instead of a project that receives nothing", async () => {
  await seed({
    replicas: [
      { api_key: "lsv2_synthetic", project: "copy" },
      { api_key: "lsv2_synthetic", project: "other" },
    ],
  });

  const reply = await setup("langsmith-tracing:setup team-traces");

  expect(reply).toContain("Traces go to the 2 replica destinations in your settings");
  expect(reply).not.toContain('"team-traces" project');
  expect(reply).toContain("Another setting overrides part of this");
});

it("leaves a skipped-replica notice out of a working sign-in", async () => {
  await seed({
    replicas: [
      { api_key: "lsv2_synthetic", project: "copy" },
      { api_url: "https://other.example.test", project: "skipped" },
    ],
  });
  auth.loginUrl = "https://eu.api.smith.langchain.com";

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).not.toContain("need their own API key");
  expect(reply).toContain("Signed in with the LangSmith CLI.");
  expect(reply).toContain("Traces go to the replica destination in your settings");
});

it("counts only replicas with their own key when nothing else is signed in", async () => {
  await fs.mkdir(path.dirname(configFile));
  await fs.writeFile(
    configFile,
    JSON.stringify({
      replicas: [{ api_key: "lsv2_synthetic", project: "copy" }, { project: "skipped" }],
    }),
  );

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Traces go to the replica destination in your settings");
});

it("counts a replica without its own key when the main API key covers it", async () => {
  await seed({ api_key: "lsv2_synthetic", replicas: [{ project: "copy" }, { project: "other" }] });

  const reply = await setup("langsmith-tracing:setup");

  expect(reply).toContain("Traces go to the 2 replica destinations");
});

it("keeps keyless replicas on the CLI login's server or with no URL", async () => {
  await seed({
    replicas: [
      { api_url: "https://eu.api.smith.langchain.com", project: "same-server" },
      { project: "no-url" },
    ],
  });
  auth.loginUrl = "https://eu.api.smith.langchain.com";

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
