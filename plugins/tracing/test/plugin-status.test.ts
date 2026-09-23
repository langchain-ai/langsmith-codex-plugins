import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CODEX_PLUGIN_SELECTOR } from "../src/constants.js";
import { runInstall } from "../src/install.js";
import {
  codexPluginEnabled,
  pluginEnabledInToml,
  printStandDownNotice,
  standDownNotice,
} from "../src/plugin-status.js";
import { codexFile } from "../src/utils/paths.js";

vi.mock("@langchain/langsmith-plugin-binary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@langchain/langsmith-plugin-binary")>();
  return {
    ...actual,
    defineBinaryTarget: (options: Parameters<typeof actual.defineBinaryTarget>[0]) => {
      const target = actual.defineBinaryTarget(options);
      return {
        ...target,
        installLocalCopy: (
          executable: string,
          version: string,
          options: Parameters<typeof target.installLocalCopy>[2] = {},
        ) =>
          target.installLocalCopy(executable, version, {
            verifySignature: () => Promise.resolve(),
            ...options,
          }),
      };
    },
  };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, default: actual, platform: () => "darwin", arch: () => "arm64" };
});

const EXECUTABLE = JSON.parse(
  readFileSync(new URL("../../../binary.config.json", import.meta.url), "utf8"),
).executableName;
const SELECTOR = CODEX_PLUGIN_SELECTOR;
const REMOVE = `  codex plugin remove ${SELECTOR}`;
const ENABLED_TOML = `[plugins."${SELECTOR}"]\nenabled = true\n`;
const DISABLED_TOML = `[plugins."${SELECTOR}"]\nenabled = false\n`;
const ROOT_CAN_READ_ANYTHING = process.getuid?.() === 0;

let home: string;
let codexHome: string;
let project: string;
let savedHome: string | undefined;
let savedCodexHome: string | undefined;
let savedCwd: string;
let savedExitCode: typeof process.exitCode;

beforeEach(async () => {
  savedCwd = process.cwd();
  savedExitCode = process.exitCode;
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-plugin-status-"));
  codexHome = path.join(home, ".codex");
  project = path.join(home, "project");
  await fs.mkdir(codexHome, { recursive: true });
  await fs.mkdir(project, { recursive: true });
  savedHome = process.env.HOME;
  savedCodexHome = process.env.CODEX_HOME;
  process.env.HOME = home;
  process.env.CODEX_HOME = codexHome;
  process.chdir(project);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.chdir(savedCwd);
  process.exitCode = savedExitCode;
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = savedCodexHome;
  await fs.chmod(path.join(codexHome, "config.toml"), 0o600).catch(() => undefined);
  await fs.rm(home, { recursive: true, force: true });
});

async function writeUserConfig(contents: string) {
  await fs.writeFile(path.join(codexHome, "config.toml"), contents);
}

async function writeProjectConfig(contents: string) {
  await fs.mkdir(path.join(project, ".codex"), { recursive: true });
  await fs.writeFile(path.join(project, ".codex", "config.toml"), contents);
}

describe("reading the plugin table out of config.toml", () => {
  it.each<[string, string, boolean | undefined]>([
    ["the table Codex writes on install", ENABLED_TOML, true],
    ["a disabled table", DISABLED_TOML, false],
    ["a single-quoted key", `[plugins.'${SELECTOR}']\nenabled = true\n`, true],
    ["an unquoted key", `[plugins.${SELECTOR}]\nenabled = true\n`, true],
    ["padding inside the header", `[ plugins . "${SELECTOR}" ]\nenabled = true\n`, true],
    ["a trailing comment", `[plugins."${SELECTOR}"] # ours\nenabled = true # on\n`, true],
    ["no spaces around the value", `[plugins."${SELECTOR}"]\nenabled=true\n`, true],
    ["carriage returns", `[plugins."${SELECTOR}"]\r\nenabled = true\r\n`, true],
    ["an empty file", "", undefined],
    ["no plugins table at all", 'model = "gpt-5"\n', undefined],
    ["another plugin only", '[plugins."browser@openai-bundled"]\nenabled = true\n', undefined],
    [
      "a later table ending ours",
      `[plugins."${SELECTOR}"]\n[plugins."browser@openai-bundled"]\nenabled = true\n`,
      undefined,
    ],
    [
      "a marketplace table before ours",
      `[marketplaces.langsmith-codex-plugins]\nsource_type = "git"\n\n${ENABLED_TOML}`,
      true,
    ],
    ["our table with no enabled key", `[plugins."${SELECTOR}"]\n`, undefined],
    ["a non-boolean value", `[plugins."${SELECTOR}"]\nenabled = "true"\n`, undefined],
    [
      "a value that merely starts with true",
      `[plugins."${SELECTOR}"]\nenabled = truely\n`,
      undefined,
    ],
    [
      "a plugin whose name only contains ours",
      '[plugins."tracing@other"]\nenabled = true\n',
      undefined,
    ],
    [
      "a plugin whose name extends ours",
      `[plugins."${SELECTOR}-beta"]\nenabled = true\n`,
      undefined,
    ],
    ["an array of tables", `[[plugins."${SELECTOR}"]]\nenabled = true\n`, undefined],
    [
      "the first enabled key winning",
      `[plugins."${SELECTOR}"]\nenabled = false\nenabled = true\n`,
      false,
    ],
    ["garbage that is not TOML", "}{ not toml at all\n", undefined],
  ])("reads %s", (_label, toml, expected) => {
    expect(pluginEnabledInToml(toml)).toBe(expected);
  });
});

describe("choosing which config.toml answers", () => {
  it("reports the plugin enabled from the user config", async () => {
    await writeUserConfig(ENABLED_TOML);

    expect(await codexPluginEnabled()).toBe(true);
  });

  it("reports the plugin enabled from the project config", async () => {
    await writeProjectConfig(ENABLED_TOML);

    expect(await codexPluginEnabled()).toBe(true);
  });

  it("lets the project config disable what the user config enabled", async () => {
    await writeUserConfig(ENABLED_TOML);
    await writeProjectConfig(DISABLED_TOML);

    expect(await codexPluginEnabled()).toBe(false);
  });

  it("falls through a project config that says nothing about the plugin", async () => {
    await writeUserConfig(ENABLED_TOML);
    await writeProjectConfig("[features]\nhooks = true\n");

    expect(await codexPluginEnabled()).toBe(true);
  });

  it("reports the plugin off when no config file exists", async () => {
    expect(await codexPluginEnabled()).toBe(false);
  });

  it("reports the plugin off when the config file is a directory", async () => {
    await fs.mkdir(path.join(codexHome, "config.toml"));

    expect(await codexPluginEnabled()).toBe(false);
  });

  it.skipIf(ROOT_CAN_READ_ANYTHING)(
    "reports the plugin off when the config file cannot be read",
    async () => {
      await writeUserConfig(ENABLED_TOML);
      await fs.chmod(path.join(codexHome, "config.toml"), 0o000);

      expect(await codexPluginEnabled()).toBe(false);
    },
  );

  it("prefers CODEX_HOME over the home directory", async () => {
    const elsewhere = path.join(home, "elsewhere");
    await fs.mkdir(elsewhere);
    await fs.writeFile(path.join(elsewhere, "config.toml"), ENABLED_TOML);
    process.env.CODEX_HOME = elsewhere;

    expect(codexFile("config.toml", false)).toBe(path.join(elsewhere, "config.toml"));
    expect(await codexPluginEnabled()).toBe(true);
  });

  it("falls back to the home directory without CODEX_HOME", async () => {
    delete process.env.CODEX_HOME;
    await writeUserConfig(ENABLED_TOML);

    expect(codexFile("config.toml", false)).toBe(path.join(codexHome, "config.toml"));
    expect(await codexPluginEnabled()).toBe(true);
  });
});

describe("the notice itself", () => {
  it("names the double install and the command that ends it", async () => {
    await writeUserConfig(ENABLED_TOML);

    const notice = (await standDownNotice()).join("\n");

    expect(notice).toContain("installed twice");
    expect(notice).toContain("Only the binary traces");
    expect(notice).toContain("starts on every hook");
    expect(notice).toContain(REMOVE);
    expect(notice).not.toContain("—");
  });

  it.each([
    ["the plugin is disabled", DISABLED_TOML],
    ["the config says nothing about the plugin", "[features]\nhooks = true\n"],
    ["the config is malformed", "}{ not toml at all\n"],
  ])("says nothing when %s", async (_label, toml) => {
    await writeUserConfig(toml);

    expect(await standDownNotice()).toEqual([]);
  });

  it("says nothing when there is no config at all", async () => {
    expect(await standDownNotice()).toEqual([]);
  });

  it("swallows an unexpected failure rather than printing", async () => {
    vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("no cwd");
    });

    const lines: string[] = [];
    await expect(printStandDownNotice((line) => lines.push(line))).resolves.toBeUndefined();
    expect(lines).toEqual([]);
  });

  it("swallows a logger that throws rather than failing the caller", async () => {
    await writeUserConfig(ENABLED_TOML);

    await expect(
      printStandDownNotice(() => {
        throw new Error("EPIPE");
      }),
    ).resolves.toBeUndefined();
  });
});

describe("what --install prints", () => {
  let source: string;
  let logged: string[];

  beforeEach(async () => {
    source = path.join(home, EXECUTABLE);
    await fs.writeFile(source, "#!/bin/sh\necho 0.1.0\n", { mode: 0o755 });
    logged = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      logged.push(line);
    });
  });

  async function install() {
    await runInstall({ source, currentVersion: "0.1.0" });
    return logged.join("\n");
  }

  it("tells the user about the second install when the plugin is enabled", async () => {
    await writeUserConfig(ENABLED_TOML);

    const output = await install();

    expect(process.exitCode).not.toBe(1);
    expect(output.split("\n").slice(0, 7)).toEqual([
      `Installed ${EXECUTABLE} 0.1.0 to ~/.langsmith`,
      "Registered 2 hooks in ~/.codex/hooks.json",
      "",
      "Next:",
      "  1. Create ~/.codex/langsmith.json (if it doesn't exist already):",
      `       {"enabled": true, "api_key": "<your-api-key>", "project": "my-project"}`,
      '  2. Restart Codex, then choose "Trust all and continue" when it asks',
    ]);
    expect(output).toContain("installed twice");
    expect(output).toContain(REMOVE);
  });

  it.each([
    ["the plugin is disabled", DISABLED_TOML],
    ["the config is malformed", "}{ not toml at all\n"],
  ])("stays quiet and still succeeds when %s", async (_label, toml) => {
    await writeUserConfig(toml);

    const output = await install();

    expect(process.exitCode).not.toBe(1);
    expect(output).toContain(`Installed ${EXECUTABLE} 0.1.0 to ~/.langsmith`);
    expect(output).not.toContain("installed twice");
    expect(output).not.toContain("codex plugin remove");
    expect(output).toContain("  1. Create ~/.codex/langsmith.json (if it doesn't exist already):");
  });

  it("stays quiet and still succeeds when no config exists", async () => {
    const output = await install();

    expect(process.exitCode).not.toBe(1);
    expect(output).toContain(`Installed ${EXECUTABLE} 0.1.0 to ~/.langsmith`);
    expect(output).not.toContain("installed twice");
    expect(output).toContain("  1. Create ~/.codex/langsmith.json (if it doesn't exist already):");
  });

  it("succeeds even when the config file cannot be read", async () => {
    await writeUserConfig(ENABLED_TOML);
    await fs.chmod(path.join(codexHome, "config.toml"), 0o000);

    const output = await install();

    expect(process.exitCode).not.toBe(1);
    expect(output).toContain(`Installed ${EXECUTABLE} 0.1.0 to ~/.langsmith`);
    expect(output).toContain("  1. Create ~/.codex/langsmith.json (if it doesn't exist already):");
  });
});
