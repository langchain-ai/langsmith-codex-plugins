import * as path from "node:path";

import { vol } from "memfs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

const HOME = "/home/codex-user";
const CWD = "/workspace/repo";

function writeConfigFiles(files: {
  homeRoot?: Partial<Record<string, unknown>>;
  global?: Partial<Record<string, unknown>>;
  root?: Partial<Record<string, unknown>>;
  local?: Partial<Record<string, unknown>>;
}) {
  vol.fromJSON({
    ...(files.homeRoot === undefined
      ? {}
      : { [path.join(HOME, ".langsmith-plugins.json")]: JSON.stringify(files.homeRoot) }),
    ...(files.global === undefined
      ? {}
      : { [path.join(HOME, ".codex", "langsmith.json")]: JSON.stringify(files.global) }),
    ...(files.root === undefined
      ? {}
      : { [path.join(CWD, "langsmith-plugins.json")]: JSON.stringify(files.root) }),
    ...(files.local === undefined
      ? {}
      : { [path.join(CWD, ".codex", "langsmith.json")]: JSON.stringify(files.local) }),
  });
}

beforeEach(() => {
  vol.reset();
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("LANGSMITH_") ||
      key.startsWith("LANGCHAIN_") ||
      key === "TRACE_TO_LANGSMITH"
    )
      vi.stubEnv(key, undefined);
  }
});
afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
});

it("returns defaults and omits missing optional properties", async () => {
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: false, project: "codex", redact: true });
});

it("loads environment config", async () => {
  const parentHeaders = {
    "langsmith-trace": "20260813T133849375587Z019ffb58-cf9f-7b51-86da-1ab91beacb97",
    baggage: "langsmith-project=parent-project",
  };
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_API_KEY", "env-key");
  vi.stubEnv("LANGSMITH_ENDPOINT", "https://env.example");
  vi.stubEnv("LANGSMITH_PROJECT", "env-project");
  vi.stubEnv("LANGSMITH_METADATA", JSON.stringify({ source: "env" }));
  vi.stubEnv(
    "LANGSMITH_RUNS_ENDPOINTS",
    JSON.stringify([{ api_url: "https://env-replica.example" }]),
  );
  vi.stubEnv("LANGSMITH_CODEX_PARENT_HEADERS", JSON.stringify(parentHeaders));
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: true,
    api_key: "env-key",
    api_url: "https://env.example",
    project: "env-project",
    metadata: { source: "env" },
    replicas: [{ api_url: "https://env-replica.example" }],
    parent_headers: parentHeaders,
    redact: true,
  });
});

it("applies all environment values over config files", async () => {
  writeConfigFiles({
    global: {
      enabled: false,
      api_key: "global-key",
      api_url: "https://global.example",
      project: "global-project",
    },
    local: {
      enabled: false,
      api_key: "local-key",
      api_url: "https://local.example",
      project: "local-project",
    },
  });

  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_API_KEY", "env-key");
  vi.stubEnv("LANGSMITH_ENDPOINT", "https://env.example");
  vi.stubEnv("LANGSMITH_PROJECT", "env-project");
  vi.stubEnv("LANGSMITH_METADATA", JSON.stringify({ source: "env" }));
  vi.stubEnv(
    "LANGSMITH_RUNS_ENDPOINTS",
    JSON.stringify([{ api_url: "https://env-replica.example" }]),
  );

  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: true,
    api_key: "env-key",
    api_url: "https://env.example",
    project: "env-project",
    metadata: { source: "env" },
    replicas: [{ api_url: "https://env-replica.example" }],
    redact: true,
  });
});

it("prefers Codex-specific environment values over standard LangSmith values", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");

  vi.stubEnv("LANGSMITH_API_KEY", "standard-key");
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", "codex-key");

  vi.stubEnv("LANGSMITH_ENDPOINT", "https://standard.example");
  vi.stubEnv("LANGSMITH_CODEX_ENDPOINT", "https://codex.example");

  vi.stubEnv("LANGSMITH_PROJECT", "standard-project");
  vi.stubEnv("LANGSMITH_CODEX_PROJECT", "codex-project");

  vi.stubEnv("LANGSMITH_METADATA", JSON.stringify({ source: "standard" }));
  vi.stubEnv("LANGSMITH_CODEX_METADATA", JSON.stringify({ source: "codex" }));

  vi.stubEnv(
    "LANGSMITH_RUNS_ENDPOINTS",
    JSON.stringify([{ api_url: "https://standard-replica.example" }]),
  );
  vi.stubEnv(
    "LANGSMITH_CODEX_RUNS_ENDPOINTS",
    JSON.stringify([{ api_url: "https://codex-replica.example" }]),
  );

  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: true,
    api_key: "codex-key",
    api_url: "https://codex.example",
    project: "codex-project",
    metadata: { source: "codex" },
    replicas: [{ api_url: "https://codex-replica.example" }],
    redact: true,
  });
});

it("disables redaction when LANGSMITH_CODEX_REDACT is falsy", async () => {
  vi.stubEnv("LANGSMITH_CODEX_REDACT", "false");
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: false, project: "codex", redact: false });
});

it("enables redaction explicitly via LANGSMITH_CODEX_REDACT", async () => {
  vi.stubEnv("LANGSMITH_CODEX_REDACT", "true");
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: false, project: "codex", redact: true });
});

it("reads redact_extra_rules from the environment", async () => {
  vi.stubEnv(
    "LANGSMITH_CODEX_REDACT_EXTRA",
    JSON.stringify([{ pattern: "ACME-\\w+", replace: "[REDACTED]" }]),
  );
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: false,
    project: "codex",
    redact: true,
    redact_extra_rules: [{ pattern: "ACME-\\w+", replace: "[REDACTED]" }],
  });
});

it("falls back to defaults when an env value fails schema validation", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  // pattern must be a string — this parses as JSON but fails the schema, so the
  // whole env layer is dropped (try/catch) rather than crashing the hook.
  vi.stubEnv("LANGSMITH_CODEX_REDACT_EXTRA", JSON.stringify([{ pattern: 123 }]));
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: true, project: "codex", redact: true });
});

it("drops the whole environment layer when the parent headers are malformed", async () => {
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", "env-key");
  vi.stubEnv("LANGSMITH_CODEX_PARENT_HEADERS", JSON.stringify({ "langsmith-trace": 1 }));
  expect(await getConfig({ home: HOME, cwd: CWD, env: process.env })).toEqual({
    defaultMuted: false,
    enabled: false,
    project: "codex",
    redact: true,
  });
});

it("drops valid parent headers when another environment value is malformed", async () => {
  vi.stubEnv("LANGSMITH_CODEX_REDACT_EXTRA", JSON.stringify([{ pattern: 123 }]));
  vi.stubEnv("LANGSMITH_CODEX_PARENT_HEADERS", JSON.stringify({ "langsmith-trace": "ok" }));
  expect(
    (await getConfig({ home: HOME, cwd: CWD, env: process.env })).parent_headers,
  ).toBeUndefined();
});

it.each([
  [
    "empty project",
    { LANGSMITH_CODEX_PROJECT: "", LANGSMITH_PROJECT: "generic-project" },
    "project",
    "generic-project",
  ],
  [
    "empty API key",
    { LANGSMITH_CODEX_API_KEY: "", LANGSMITH_API_KEY: "generic-key" },
    "api_key",
    "generic-key",
  ],
  [
    "blank API key",
    { LANGSMITH_CODEX_API_KEY: "  ", LANGSMITH_API_KEY: "generic-key" },
    "api_key",
    "generic-key",
  ],
  [
    "empty endpoint",
    { LANGSMITH_CODEX_ENDPOINT: "", LANGSMITH_ENDPOINT: "https://generic.example" },
    "api_url",
    "https://generic.example",
  ],
])(
  "treats an %s as unset and falls through to the generic variable",
  async (_name, env, field, expected) => {
    expect((await getConfig({ home: HOME, cwd: CWD, env }))[field as "project"]).toBe(expected);
  },
);

it.each([{ api_key: "   " }, { api_key: "", project: " " }])(
  "ignores blank file values %j instead of sending them",
  async (file) => {
    writeConfigFiles({ local: file });
    const config = await getConfig({ home: HOME, cwd: CWD, env: {} });
    expect(config.api_key).toBeUndefined();
    expect(config.project).toBe("codex");
  },
);

it("normalizes replica camelCase aliases", async () => {
  vi.stubEnv(
    "LANGSMITH_CODEX_RUNS_ENDPOINTS",
    JSON.stringify([
      {
        apiUrl: "https://replica.example",
        apiKey: "replica-key",
        projectName: "replica-project",
        updates: { mode: "append" },
      },
    ]),
  );

  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: false,
    project: "codex",
    replicas: [
      {
        api_url: "https://replica.example",
        api_key: "replica-key",
        project: "replica-project",
        updates: { mode: "append" },
      },
    ],
    redact: true,
  });
});

const masterEnvValues = [
  [undefined, false],
  ["TrUe", true],
  [" 1 ", true],
  [" YeS ", true],
  ["on", true],
  ["\tFALSE\n", false],
  ["0", false],
  ["no", false],
  ["", false],
  ["unknown", false],
] as const;
it.each(masterEnvValues)("historical master env %j", async (value, expected) => {
  expect(
    await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: value } }),
  ).toMatchObject({ enabled: expected, defaultMuted: false });
});
it.each([true, false])("master env beats a file that says enabled is %j", async (enabled) => {
  writeConfigFiles({ local: { enabled } });
  expect(
    (await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: String(!enabled) } }))
      .enabled,
  ).toBe(!enabled);
});

it.each([
  [undefined, undefined, undefined, false],
  [undefined, undefined, "TrUe", true],
  [{ defaultMuted: true }, { defaultMuted: false }, "false", false],
  [{ defaultMuted: "false" }, { defaultMuted: false }, "false", false],
])("defaultMuted precedence: %j %j %s", async (local, global, value, expected) => {
  writeConfigFiles({ local, global });
  const config = await getConfig({
    home: HOME,
    cwd: CWD,
    env: {
      TRACE_TO_LANGSMITH: "true",
      LANGSMITH_CODEX_DEFAULT_MUTED: value,
    },
  });
  expect(config.defaultMuted).toBe(expected);
  expect(config.enabled).toBe(true);
});
it.each(["", "false ", "yes"])(
  "invalid defaultMuted env %j stays muted without trimming or accepting aliases",
  async (value) => {
    const config = await getConfig({
      home: HOME,
      cwd: CWD,
      env: {
        TRACE_TO_LANGSMITH: "true",
        LANGSMITH_CODEX_DEFAULT_MUTED: value,
      },
    });
    expect(config).toMatchObject({ enabled: true, defaultMuted: true });
  },
);
it.each([
  [undefined, "true", true],
  ["false", "true", false],
  ["", "false", true],
])("Codex default env wins over the standard alias: %s %s", async (codex, standard, expected) => {
  expect(
    (
      await getConfig({
        home: HOME,
        cwd: CWD,
        env: {
          LANGSMITH_CODEX_DEFAULT_MUTED: codex,
          LANGSMITH_DEFAULT_MUTED: standard,
        },
      })
    ).defaultMuted,
  ).toBe(expected);
});

it("unrelated invalid env cannot discard the configured mute default", async () => {
  expect(
    await getConfig({
      home: HOME,
      cwd: CWD,
      env: {
        TRACE_TO_LANGSMITH: "true",
        LANGSMITH_CODEX_DEFAULT_MUTED: "true",
        LANGSMITH_CODEX_REDACT_EXTRA: '[{"pattern":123}]',
      },
    }),
  ).toMatchObject({ enabled: true, defaultMuted: true });
});

it("config lookup alone does not create or modify privacy state", async () => {
  const { fs } = await import("memfs");
  const file = path.join(HOME, ".codex/langsmith_state_privacy.json");
  const options = { home: HOME, cwd: CWD, env: { LANGSMITH_CODEX_DEFAULT_MUTED: "true" } };
  await getConfig(options);
  expect(fs.existsSync(file)).toBe(false);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "broken privacy state");
  await getConfig(options);
  expect(fs.readFileSync(file, "utf8")).toBe("broken privacy state");
});

it("all existing file-supported fields use the same root overlay and environment precedence", async () => {
  const layer = (scope: string) => ({
    api_key: `${scope}-key`,
    api_url: `https://${scope}.example`,
    project: `${scope}-project`,
    metadata: { [scope]: true },
    replicas: [{ api_url: `https://${scope}-replica.example` }],
    parent_headers: { "langsmith-trace": `${scope}-trace` },
    redact: scope === "global",
    redact_extra_rules: [{ pattern: scope }],
  });
  const global = layer("global");
  const root = layer("root");
  const local = layer("local");
  const env = layer("env");
  writeConfigFiles({ global, root });
  const options = { home: HOME, cwd: CWD, env: {} };
  expect(await getConfig(options)).toEqual({
    enabled: false,
    defaultMuted: false,
    ...root,
    metadata: { ...global.metadata, ...root.metadata },
  });
  // Omitted fields fall through; arrays replace and metadata merges per key.
  writeConfigFiles({ root: { metadata: root.metadata, replicas: root.replicas } });
  expect(await getConfig(options)).toEqual({
    enabled: false,
    defaultMuted: false,
    ...global,
    metadata: { ...global.metadata, ...root.metadata },
    replicas: root.replicas,
  });
  writeConfigFiles({ root, local });
  expect(await getConfig(options)).toEqual({
    enabled: false,
    defaultMuted: false,
    ...local,
    metadata: { ...global.metadata, ...root.metadata, ...local.metadata },
  });
  // Root-only files also normalize replica aliases via the shared reader.
  writeConfigFiles({
    local: {},
    root: {
      ...root,
      replicas: [
        { apiUrl: "https://alias.example", apiKey: "alias-key", projectName: "alias-project" },
      ],
    },
  });
  expect((await getConfig(options)).replicas).toEqual([
    { api_url: "https://alias.example", api_key: "alias-key", project: "alias-project" },
  ]);
  expect(
    await getConfig({
      ...options,
      env: {
        LANGSMITH_CODEX_API_KEY: env.api_key,
        LANGSMITH_CODEX_ENDPOINT: env.api_url,
        LANGSMITH_CODEX_PROJECT: env.project,
        LANGSMITH_CODEX_METADATA: JSON.stringify(env.metadata),
        LANGSMITH_CODEX_RUNS_ENDPOINTS: JSON.stringify(env.replicas),
        LANGSMITH_CODEX_PARENT_HEADERS: JSON.stringify(env.parent_headers),
        LANGSMITH_CODEX_REDACT: "true",
        LANGSMITH_CODEX_REDACT_EXTRA: JSON.stringify(env.redact_extra_rules),
      },
    }),
  ).toEqual({
    enabled: false,
    defaultMuted: false,
    ...env,
    redact: true,
    metadata: { ...global.metadata, ...root.metadata, ...env.metadata },
  });
});

it.each([[], { "langsmith-trace": 1 }, { "langsmith-trace": "ok", baggage: 1 }])(
  "invalid parent_headers %j is omitted without affecting common config",
  async (parent_headers) => {
    writeConfigFiles({
      root: {
        enabled: true,
        defaultMuted: false,
        api_key: "kept",
        parent_headers,
        claude: null,
        cursor: [],
      },
    });
    expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toEqual({
      enabled: true,
      defaultMuted: false,
      api_key: "kept",
      project: "codex",
      redact: true,
    });
  },
);

it("parent headers validate independently even when common fields are invalid", async () => {
  const parent_headers = { "langsmith-trace": "root-parent" };
  writeConfigFiles({ root: { project: null, parent_headers }, local: { parent_headers: [] } });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: false,
    defaultMuted: true,
    project: "codex",
    parent_headers,
  });
});

it("home parent headers validate independently of common fields and higher invalid extensions", async () => {
  const parent_headers = { "langsmith-trace": "home-parent", baggage: "home-baggage" };
  writeConfigFiles({
    homeRoot: { project: null, parent_headers },
    global: { parent_headers: [] },
    root: { parent_headers: null },
    local: { parent_headers: { "langsmith-trace": 1 } },
  });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toEqual({
    enabled: false,
    defaultMuted: true,
    redact: true,
    project: "codex",
    parent_headers,
  });
  writeConfigFiles({ homeRoot: { enabled: true, project: "home", parent_headers: [] } });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toEqual({
    enabled: true,
    defaultMuted: false,
    redact: true,
    project: "home",
  });
});
