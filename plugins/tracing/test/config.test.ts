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
  global?: Partial<Record<string, unknown>>;
  local?: Partial<Record<string, unknown>>;
}) {
  vol.fromJSON({
    [path.join(HOME, ".codex", "langsmith.json")]: JSON.stringify(files.global),
    [path.join(CWD, ".codex", "langsmith.json")]: JSON.stringify(files.local),
  });
}

beforeEach(() => vol.reset());
afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
});

it("returns defaults and omits missing optional properties", async () => {
  const config = await getConfig({ home: HOME, cwd: CWD, env: process.env });
  expect(config).toEqual({ enabled: false, project: "codex", redact: true });
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
    project: "codex",
    enabled: true,
    api_key: "local-key",
    api_url: "https://local.example",
    redact: true,
  });
});

it("loads environment config", async () => {
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
    enabled: true,
    api_key: "env-key",
    api_url: "https://env.example",
    project: "env-project",
    metadata: { source: "env" },
    replicas: [{ api_url: "https://env-replica.example" }],
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
    enabled: true,
    api_key: "local-key",
    api_url: "https://local.example",
    project: "local-project",
    metadata: { scope: "local" },
    replicas: [{ api_url: "https://local-replica.example" }],
    redact: true,
  });
});

it("applies environment values over config files", async () => {
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
  vi.stubEnv("TRACE_TO_LANGSMITH", "yes");

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
    enabled: true,
    api_key: "codex-key",
    api_url: "https://codex.example",
    project: "codex-project",
    metadata: { source: "codex" },
    replicas: [{ api_url: "https://codex-replica.example" }],
    redact: true,
  });
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
