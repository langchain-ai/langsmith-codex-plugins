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

it("loads global config", async () => {
  writeConfigFiles({
    global: {
      enabled: true,
      api_key: "global-key",
      api_url: "https://global.example",
    },
  });

  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    project: "codex",
    enabled: true,
    api_key: "global-key",
    api_url: "https://global.example",
    redact: true,
  });
});

it("loads local config", async () => {
  writeConfigFiles({
    local: {
      enabled: true,
      api_key: "local-key",
      api_url: "https://local.example",
    },
  });
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    project: "codex",
    enabled: true,
    api_key: "local-key",
    api_url: "https://local.example",
    redact: true,
  });
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

it("applies local config over global config", async () => {
  writeConfigFiles({
    global: {
      enabled: true,
      api_key: "global-key",
      api_url: "https://global.example",
      project: "global-project",
      metadata: { scope: "global" },
      replicas: [{ api_url: "https://global-replica.example" }],
    },
    local: {
      api_key: "local-key",
      api_url: "https://local.example",
      project: "local-project",
      metadata: { scope: "local" },
      replicas: [{ api_url: "https://local-replica.example" }],
    },
  });

  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({
    defaultMuted: false,
    enabled: true,
    api_key: "local-key",
    api_url: "https://local.example",
    project: "local-project",
    metadata: { scope: "local" },
    replicas: [{ api_url: "https://local-replica.example" }],
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

it("disables redaction via config file", async () => {
  writeConfigFiles({ global: { redact: false } });
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: false, project: "codex", redact: false });
});

it("falls back to defaults when an env value fails schema validation", async () => {
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  // pattern must be a string — this parses as JSON but fails the schema, so the
  // whole env layer is dropped (try/catch) rather than crashing the hook.
  vi.stubEnv("LANGSMITH_CODEX_REDACT_EXTRA", JSON.stringify([{ pattern: 123 }]));
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ defaultMuted: false, enabled: true, project: "codex", redact: true });
});

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
  ["true", true],
  ["TrUe", true],
  [" true ", true],
  ["\tTRUE\n", true],
  ["1", true],
  [" 1 ", true],
  ["yes", true],
  [" YeS ", true],
  ["on", true],
  [" ON ", true],
  ["false", false],
  ["FaLsE", false],
  [" false ", false],
  ["\tFALSE\n", false],
  ["0", false],
  [" 0 ", false],
  ["no", false],
  [" No ", false],
  ["off", false],
  [" OFF ", false],
  ["", false],
  [" \t\n", false],
  ["unknown", false],
  ["enabled", false],
] as const;
for (const files of [undefined, {}]) {
  it.each(masterEnvValues)(
    `historical master env %j with ${files === undefined ? "absent files" : "empty file fields"}`,
    async (value, expected) => {
      writeConfigFiles({ homeRoot: files, global: files, root: files, local: files });
      expect(
        await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: value } }),
      ).toMatchObject({ enabled: expected, defaultMuted: false });
    },
  );
}
for (const location of ["homeRoot", "global", "root", "local"] as const) {
  it.each(masterEnvValues)(
    `master env %j overrides ${location} enabled boolean`,
    async (value, expected) => {
      for (const enabled of [false, true]) {
        writeConfigFiles({ [location]: { enabled } });
        expect(
          (await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: value } })).enabled,
        ).toBe(value === undefined ? enabled : expected);
      }
    },
  );
}

it.each([
  [undefined, undefined, "true", true],
  [undefined, undefined, "false", false],
  [undefined, { enabled: false }, "true", true],
  [{ enabled: true }, { enabled: false }, "false", false],
  [{}, { enabled: true }, "true", true],
  [{ enabled: "true" }, { enabled: true }, "true", true],
])("enabled precedence: %j %j %s", async (local, global, env, expected) => {
  writeConfigFiles({ local, global });
  expect(
    (await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: env } })).enabled,
  ).toBe(expected);
});
it.each(["{", "[]", "null"])(
  "malformed project file restricts only switches absent from env: %s",
  async (raw) => {
    vol.fromJSON({ [path.join(CWD, ".codex/langsmith.json")]: raw });
    expect(
      await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: "true" } }),
    ).toMatchObject({ enabled: true, defaultMuted: true });
  },
);
it("dangling project symlink is not an absent config", async () => {
  const { fs } = await import("memfs");
  fs.mkdirSync(path.join(CWD, ".codex"), { recursive: true });
  fs.symlinkSync("/missing", path.join(CWD, ".codex/langsmith.json"));
  expect(
    await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: "true" } }),
  ).toMatchObject({ enabled: true, defaultMuted: true });
});

it.each(["project", "user"])(
  "environment overrides unreadable %s config independently",
  async (location) => {
    const { fs } = await import("memfs");
    const file = path.join(location === "project" ? CWD : HOME, ".codex/langsmith.json");
    fs.mkdirSync(file, { recursive: true });
    expect(
      await getConfig({ home: HOME, cwd: CWD, env: { TRACE_TO_LANGSMITH: "true" } }),
    ).toMatchObject({ enabled: true, defaultMuted: true });
  },
);

it.each([
  [undefined, undefined, undefined, false],
  [undefined, undefined, "TrUe", true],
  [undefined, undefined, "FaLsE", false],
  [{ enabled: true }, { defaultMuted: true }, "false", false],
  [{ defaultMuted: false }, { defaultMuted: true }, "true", true],
  [{ defaultMuted: true }, { defaultMuted: false }, "false", false],
  [{}, {}, "true", true],
  [{ defaultMuted: "false" }, { defaultMuted: false }, "false", false],
  [{ defaultMuted: null }, undefined, "false", false],
  [{ defaultMuted: 0 }, undefined, "false", false],
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
it.each(["", " true", "false ", "yes", "no", "1", "0", "unknown"])(
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
  [undefined, "false", false],
  ["false", "true", false],
  ["true", "false", true],
  ["", "false", true],
  [undefined, "invalid", true],
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
it("invalid enabled does not hide valid defaultMuted, and conversely", async () => {
  writeConfigFiles({ local: { enabled: "true", defaultMuted: false } });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: false,
    defaultMuted: false,
  });
  writeConfigFiles({ local: { enabled: true, defaultMuted: "false" } });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: true,
    defaultMuted: true,
  });
});
it.each(["project", "user"])(
  "malformed/unreadable %s files restrict both booleans",
  async (location) => {
    const { fs } = await import("memfs");
    const file = path.join(location === "project" ? CWD : HOME, ".codex/langsmith.json");
    for (const raw of ["{", "[]", "null", "true", "42", "directory", "symlink"]) {
      vol.reset();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (raw === "directory") fs.mkdirSync(file);
      else if (raw === "symlink") fs.symlinkSync("/missing", file);
      else fs.writeFileSync(file, raw);
      expect(
        await getConfig({
          home: HOME,
          cwd: CWD,
          env: {},
        }),
      ).toMatchObject({ enabled: false, defaultMuted: true });
    }
  },
);
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
  const file = path.join(HOME, ".codex/langsmith-state.privacy.json");
  const options = { home: HOME, cwd: CWD, env: { LANGSMITH_CODEX_DEFAULT_MUTED: "true" } };
  await getConfig(options);
  expect(fs.existsSync(file)).toBe(false);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "broken privacy state");
  await getConfig(options);
  expect(fs.readFileSync(file, "utf8")).toBe("broken privacy state");
});

const booleanSettings = [
  { field: "enabled", envKey: "TRACE_TO_LANGSMITH", restrictive: false },
  { field: "defaultMuted", envKey: "LANGSMITH_CODEX_DEFAULT_MUTED", restrictive: true },
] as const;
const booleanValues = [undefined, false, true];
const booleanLayers = booleanValues.flatMap((local) =>
  booleanValues.flatMap((root) =>
    booleanValues.flatMap((global) =>
      booleanValues.flatMap((homeRoot) =>
        booleanValues.map((env) => ({ local, root, global, homeRoot, env })),
      ),
    ),
  ),
);
for (const { field, envKey, restrictive } of booleanSettings) {
  it.each(booleanLayers)(
    `${field}: env > .codex > root > user > homeRoot > default: %j`,
    async (layers) => {
      writeConfigFiles({
        local: { [field]: layers.local },
        root: { [field]: layers.root },
        global: { [field]: layers.global },
        homeRoot: { [field]: layers.homeRoot },
      });
      const config = await getConfig({
        home: HOME,
        cwd: CWD,
        env: { [envKey]: layers.env?.toString() },
      });
      expect(config[field]).toBe(
        layers.env ?? layers.local ?? layers.root ?? layers.global ?? layers.homeRoot ?? false,
      );
    },
  );

  it.each(["true", "false", null, 0, [], {}])(
    `invalid root ${field} restricts only that field: %j`,
    async (value) => {
      writeConfigFiles({
        root: { enabled: true, defaultMuted: false, [field]: value },
        global: { enabled: true, defaultMuted: false },
      });
      const config = await getConfig({ home: HOME, cwd: CWD, env: {} });
      expect(config).toMatchObject({ enabled: true, defaultMuted: false, [field]: restrictive });
    },
  );
}

it.each([
  [{ enabled: true }, { defaultMuted: true }, { defaultMuted: false }, true, true],
  [{ defaultMuted: false }, { enabled: true }, { enabled: false }, true, false],
  [{}, { enabled: false }, { defaultMuted: true }, false, true],
  [{}, { defaultMuted: false }, { enabled: true }, true, false],
])(
  "root fields resolve independently: %j %j %j",
  async (local, root, global, enabled, defaultMuted) => {
    writeConfigFiles({ local, root, global });
    expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
      enabled,
      defaultMuted,
    });
  },
);

const ignoredOldRootFiles = [
  '{"enabled":false,"defaultMuted":true,"project":"old-root"}',
  "{",
  '{"enabled":true,"defaultMuted":true,"project":"old-root"}',
];
it.each(ignoredOldRootFiles)("old root langsmith.json is not a fallback: %s", async (raw) => {
  vol.fromJSON({ [path.join(CWD, "langsmith.json")]: raw });
  const options = { home: HOME, cwd: CWD, env: {} };
  expect(await getConfig(options)).toEqual({
    enabled: false,
    defaultMuted: false,
    project: "codex",
    redact: true,
  });
  expect(await getConfig({ ...options, env: { TRACE_TO_LANGSMITH: "true" } })).toMatchObject({
    enabled: true,
    defaultMuted: false,
  });
  writeConfigFiles({ global: { enabled: true, defaultMuted: false, project: "user" } });
  expect(await getConfig(options)).toMatchObject({
    enabled: true,
    defaultMuted: false,
    project: "user",
  });
});

it.each(ignoredOldRootFiles)(
  "new root is honored alongside ignored old root, and .codex still wins: %s",
  async (raw) => {
    vol.fromJSON({ [path.join(CWD, "langsmith.json")]: raw });
    writeConfigFiles({
      global: { enabled: false, defaultMuted: true, project: "user" },
      root: { enabled: true, defaultMuted: false, project: "new-root" },
    });
    const options = { home: HOME, cwd: CWD, env: {} };
    expect(await getConfig(options)).toMatchObject({
      enabled: true,
      defaultMuted: false,
      project: "new-root",
    });
    writeConfigFiles({ local: { enabled: false, defaultMuted: true, project: "harness" } });
    expect(await getConfig(options)).toMatchObject({
      enabled: false,
      defaultMuted: true,
      project: "harness",
    });
  },
);

const invalidRootFiles = [
  "{",
  "[]",
  "null",
  "true",
  "42",
  '"text"',
  // Existing schema validation rejects the entire file for invalid supported fields.
  '{"enabled":true,"defaultMuted":false,"api_key":123}',
  "directory",
  "symlink",
];
it.each(invalidRootFiles)("invalid/unreadable root fails closed per field: %s", async (raw) => {
  const { fs } = await import("memfs");
  writeConfigFiles({ global: { enabled: true, defaultMuted: false } });
  const file = path.join(CWD, "langsmith-plugins.json");
  fs.mkdirSync(CWD, { recursive: true });
  if (raw === "directory") fs.mkdirSync(file);
  else if (raw === "symlink") fs.symlinkSync("/missing", file);
  else fs.writeFileSync(file, raw);

  const options = {
    home: HOME,
    cwd: CWD,
    env: {},
  };
  expect(await getConfig(options)).toMatchObject({ enabled: false, defaultMuted: true });
  writeConfigFiles({ local: { enabled: true } });
  expect(await getConfig(options)).toMatchObject({ enabled: true, defaultMuted: true });
  writeConfigFiles({ local: { defaultMuted: false } });
  expect(await getConfig(options)).toMatchObject({ enabled: false, defaultMuted: false });
  writeConfigFiles({ local: { enabled: true, defaultMuted: false } });
  expect(await getConfig(options)).toMatchObject({ enabled: true, defaultMuted: false });
});

it("loads root from configured cwd, not process cwd, and never searches ancestors", async () => {
  vol.fromJSON({
    [path.join(process.cwd(), "langsmith-plugins.json")]: '{"enabled":false,"defaultMuted":true}',
    [path.join(CWD, "langsmith-plugins.json")]: '{"enabled":true,"defaultMuted":false}',
  });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: true,
    defaultMuted: false,
  });
  expect(await getConfig({ home: HOME, cwd: path.join(CWD, "nested"), env: {} })).toMatchObject({
    enabled: false,
    defaultMuted: false,
  });
});

it("root uses the existing schema: unknown keys are ignored, not new configuration", async () => {
  writeConfigFiles({
    root: { unsupported: true, apiKey: "not-a-supported-top-level-alias" },
    global: { enabled: true, defaultMuted: false, api_key: "user-key" },
  });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toEqual({
    enabled: true,
    defaultMuted: false,
    api_key: "user-key",
    project: "codex",
    redact: true,
  });
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

it.each([null, [], 123, {}, { "langsmith-trace": 1 }, { "langsmith-trace": "ok", baggage: 1 }])(
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

it("metadata merges per key user/root/harness/env with nested replacement and safe own keys", async () => {
  writeConfigFiles({
    global: { metadata: { user: true, winner: "user", nested: { user: true } } },
    root: { metadata: { root: true, winner: "root", nested: { root: true } } },
    local: { metadata: { local: true, winner: "local" } },
  });
  const env = { LANGSMITH_METADATA: JSON.stringify({ env: true, winner: "env" }) };
  expect((await getConfig({ home: HOME, cwd: CWD, env })).metadata).toEqual({
    user: true,
    root: true,
    local: true,
    env: true,
    winner: "env",
    nested: { root: true },
  });
  writeConfigFiles({ local: { metadata: JSON.parse('{"__proto__":{"safe":true}}') } });
  const metadata = (await getConfig({ home: HOME, cwd: CWD, env: { LANGSMITH_METADATA: "{}" } }))
    .metadata!;
  expect(Object.hasOwn(metadata, "__proto__")).toBe(true);
  expect(Object.getPrototypeOf(metadata)).toBe(Object.prototype);
  expect(metadata.user).toBe(true);
});

it("readable regular symlinks supply common fields and parent extensions", async () => {
  const { fs } = await import("memfs");
  writeConfigFiles({
    global: {
      enabled: true,
      metadata: { symlink: true },
      parent_headers: { "langsmith-trace": "parent" },
    },
  });
  fs.mkdirSync(CWD, { recursive: true });
  fs.symlinkSync(
    path.join(HOME, ".codex/langsmith.json"),
    path.join(CWD, "langsmith-plugins.json"),
  );
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: true,
    metadata: { symlink: true },
    parent_headers: { "langsmith-trace": "parent" },
  });
});

it.each([
  { replicas: [{ api_url: null, apiUrl: "alias" }] },
  { redact_extra_rules: [{ pattern: "[" }] },
])("common-only validation rejects %j and discards ordinary file fields", async (bad) => {
  writeConfigFiles({
    root: { enabled: true, project: "discard", ...bad },
    global: { project: "fallback" },
  });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toMatchObject({
    enabled: false,
    defaultMuted: true,
    project: "fallback",
  });
});

it("empty replica and rule arrays replace lower arrays while ordinary env failures remain legacy", async () => {
  writeConfigFiles({
    global: { replicas: [{ project: "lower" }], redact_extra_rules: [{ pattern: "lower" }] },
    root: { replicas: [], redact_extra_rules: [] },
  });
  const config = await getConfig({
    home: HOME,
    cwd: CWD,
    env: { LANGSMITH_CODEX_METADATA: "[]", LANGSMITH_CODEX_PROJECT: "discard" },
  });
  expect(config).toMatchObject({ replicas: [], redact_extra_rules: [], project: "codex" });
});

for (const location of ["homeRoot", "global", "root", "local"] as const) {
  it.each(invalidRootFiles)(
    `higher environment overrides malformed ${location} independently: %s`,
    async (raw) => {
      const { fs } = await import("memfs");
      const files = {
        homeRoot: path.join(HOME, ".langsmith-plugins.json"),
        global: path.join(HOME, ".codex/langsmith.json"),
        root: path.join(CWD, "langsmith-plugins.json"),
        local: path.join(CWD, ".codex/langsmith.json"),
      };
      const file = files[location];
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (raw === "directory") fs.mkdirSync(file);
      else if (raw === "symlink") fs.symlinkSync("/missing", file);
      else fs.writeFileSync(file, raw);
      const options = { home: HOME, cwd: CWD };
      expect(await getConfig({ ...options, env: {} })).toMatchObject({
        enabled: false,
        defaultMuted: true,
      });
      expect(await getConfig({ ...options, env: { TRACE_TO_LANGSMITH: "true" } })).toMatchObject({
        enabled: true,
        defaultMuted: true,
      });
      expect(
        await getConfig({ ...options, env: { LANGSMITH_CODEX_DEFAULT_MUTED: "false" } }),
      ).toMatchObject({ enabled: false, defaultMuted: false });
      expect(
        await getConfig({
          ...options,
          env: {
            TRACE_TO_LANGSMITH: "true",
            LANGSMITH_CODEX_DEFAULT_MUTED: "false",
            LANGSMITH_CODEX_API_KEY: "env-key",
          },
        }),
      ).toMatchObject({ enabled: true, defaultMuted: false, api_key: "env-key" });
    },
  );
}

it("home root supplies the entire config and every higher layer overrides per field", async () => {
  const layer = (scope: string) => ({
    enabled: true,
    defaultMuted: true,
    api_key: `${scope}-key`,
    api_url: `https://${scope}.example`,
    project: scope,
    metadata: { [scope]: true, winner: scope, nested: { [scope]: true } },
    replicas: [{ project: scope }],
    redact: false,
    redact_extra_rules: [{ pattern: scope }],
    parent_headers: { "langsmith-trace": scope },
  });
  const homeRoot = layer("home");
  writeConfigFiles({ homeRoot });
  const options = { home: HOME, cwd: CWD, env: {} };
  expect(await getConfig(options)).toEqual(homeRoot);
  let metadata = homeRoot.metadata;
  for (const location of ["global", "root", "local"] as const) {
    const higher = layer(location);
    writeConfigFiles({ [location]: higher });
    metadata = { ...metadata, ...higher.metadata };
    expect(await getConfig(options)).toEqual({ ...higher, metadata });
  }
  const env = layer("env");
  expect(
    await getConfig({
      ...options,
      env: {
        TRACE_TO_LANGSMITH: "false",
        LANGSMITH_CODEX_DEFAULT_MUTED: "false",
        LANGSMITH_CODEX_API_KEY: "",
        LANGSMITH_CODEX_ENDPOINT: env.api_url,
        LANGSMITH_CODEX_PROJECT: env.project,
        LANGSMITH_CODEX_METADATA: JSON.stringify(env.metadata),
        LANGSMITH_CODEX_RUNS_ENDPOINTS: "[]",
        LANGSMITH_CODEX_REDACT: "true",
        LANGSMITH_CODEX_REDACT_EXTRA: "[]",
        LANGSMITH_CODEX_PARENT_HEADERS: JSON.stringify(env.parent_headers),
      },
    }),
  ).toEqual({
    ...env,
    enabled: false,
    defaultMuted: false,
    api_key: "",
    redact: true,
    replicas: [],
    redact_extra_rules: [],
    metadata: { ...metadata, ...env.metadata },
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

it("home langsmith.json is ignored, not an alias for home .langsmith-plugins.json", async () => {
  vol.fromJSON({ [path.join(HOME, "langsmith.json")]: "{" });
  expect(await getConfig({ home: HOME, cwd: CWD, env: {} })).toEqual({
    enabled: false,
    defaultMuted: false,
    project: "codex",
    redact: true,
  });
});

it.each([
  JSON.stringify({
    enabled: true,
    defaultMuted: true,
    api_key: "old-key",
    api_url: "https://old.example",
    project: "old",
    metadata: { old: true },
    replicas: [{ project: "old" }],
    redact: false,
    redact_extra_rules: [{ pattern: "old" }],
    parent_headers: { "langsmith-trace": "old" },
  }),
  "{",
])("nonhidden home config is not a fallback, even when invalid: %s", async (raw) => {
  vol.fromJSON({ [path.join(HOME, "langsmith-plugins.json")]: raw });
  const options = { home: HOME, cwd: CWD, env: {} };
  expect(await getConfig(options)).toEqual({
    enabled: false,
    defaultMuted: false,
    project: "codex",
    redact: true,
  });
  writeConfigFiles({ homeRoot: { enabled: true, project: "hidden" } });
  expect(await getConfig(options)).toEqual({
    enabled: true,
    defaultMuted: false,
    project: "hidden",
    redact: true,
  });
});

it("when cwd is home, the nonhidden file is still a higher-priority project source", async () => {
  writeConfigFiles({
    homeRoot: { enabled: false, defaultMuted: true, api_key: "hidden-key", project: "hidden" },
  });
  vol.fromJSON({
    [path.join(HOME, "langsmith-plugins.json")]: JSON.stringify({
      enabled: true,
      defaultMuted: false,
      project: "project-at-home",
    }),
  });
  expect(await getConfig({ home: HOME, cwd: HOME, env: {} })).toEqual({
    enabled: true,
    defaultMuted: false,
    api_key: "hidden-key",
    project: "project-at-home",
    redact: true,
  });
});
