import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { z } from "zod";

const ReplicaSchema = z.preprocess(
  (value) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) return value;

    const replica = value as Record<string, unknown>;
    return {
      apiUrl: replica.apiUrl ?? replica.api_url,
      apiKey: replica.apiKey ?? replica.api_key,
      workspaceId: replica.workspaceId ?? replica.workspace_id,
      projectName: replica.projectName ?? replica.project_name ?? replica.project,
      primary: replica.primary,
      updates: replica.updates,
      fromEnv: replica.fromEnv ?? replica.from_env,
      reroot: replica.reroot,
    };
  },
  z.object({
    apiUrl: z.string().optional(),
    apiKey: z.string().optional(),
    workspaceId: z.string().optional(),
    projectName: z.string().optional(),
    primary: z.boolean().optional(),
    updates: z.record(z.string(), z.unknown()).optional(),
    fromEnv: z.boolean().optional(),
    reroot: z.boolean().optional(),
  }),
);

export const ConfigSchema = z.object({
  // TRACE_TO_LANGSMITH == true
  enabled: z.boolean(),

  // LANGSMITH_CODEX_API_KEY or LANGSMITH_API_KEY
  api_key: z.string().optional(),

  // LANGSMITH_CODEX_ENDPOINT or LANGSMITH_ENDPOINT
  api_url: z.string().optional(),

  // LANGSMITH_CODEX_PROJECT or LANGSMITH_PROJECT
  project: z.string().optional(),

  // LANGSMITH_CODEX_METADATA
  metadata: z.record(z.string(), z.unknown()).optional(),

  // LANGSMITH_CODEX_RUNS_ENDPOINTS
  replicas: z.array(ReplicaSchema).optional(),

  // LANGSMITH_CODEX_PARENT_HEADERS
  parent_headers: z
    .object({
      "langsmith-trace": z.string(),
      baggage: z.string().optional(),
    })
    .optional(),

  // LANGSMITH_CODEX_REDACT (default true) — redact secrets before upload
  redact: z.boolean(),

  // LANGSMITH_CODEX_REDACT_EXTRA — extra { pattern, replace } redaction rules
  redact_extra_rules: z
    .array(z.object({ pattern: z.string(), replace: z.string().optional() }))
    .optional(),
});

const PartialConfigSchema = ConfigSchema.partial();

export type Config = z.infer<typeof ConfigSchema>;

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  if (value.trim().length === 0) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    return undefined;
  }
}

const stripUndefined = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
};

async function readConfigFile(
  file: string,
): Promise<{ config?: Partial<Config>; invalid: boolean }> {
  let data: string;
  try {
    data = await fs.readFile(file, "utf-8");
  } catch (error) {
    return {
      invalid: !(
        error != null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ),
    };
  }
  try {
    return { config: PartialConfigSchema.parse(JSON.parse(data)), invalid: false };
  } catch {
    return { invalid: true };
  }
}

function getVar(suffix: string, env: Record<string, string | undefined>): string | undefined {
  return env[`LANGSMITH_CODEX_${suffix}`] ?? env[`LANGSMITH_${suffix}`];
}

const readConfigEnv = (
  env: Record<string, string | undefined>,
): { config: Partial<Config>; invalid: boolean } => {
  const names = [
    "TRACE_TO_LANGSMITH",
    "METADATA",
    "RUNS_ENDPOINTS",
    "PARENT_HEADERS",
    "REDACT",
    "REDACT_EXTRA",
  ];
  const present = names.some((name) =>
    name === "TRACE_TO_LANGSMITH" ? env[name] != null : getVar(name, env) != null,
  );
  try {
    const config = stripUndefined(
      PartialConfigSchema.parse({
        enabled: parseBoolean(env.TRACE_TO_LANGSMITH),
        api_key: getVar("API_KEY", env),
        api_url: getVar("ENDPOINT", env),
        project: getVar("PROJECT", env),
        metadata: parseJson(getVar("METADATA", env)),
        replicas: parseJson(getVar("RUNS_ENDPOINTS", env)),
        parent_headers: parseJson(getVar("PARENT_HEADERS", env)),
        redact: parseBoolean(getVar("REDACT", env)),
        redact_extra_rules: parseJson(getVar("REDACT_EXTRA", env)),
      }),
    );
    const invalid =
      (env.TRACE_TO_LANGSMITH != null && config.enabled == null) ||
      ["METADATA", "RUNS_ENDPOINTS", "PARENT_HEADERS", "REDACT_EXTRA"].some(
        (name) => getVar(name, env) != null && parseJson(getVar(name, env)) == null,
      ) ||
      (getVar("REDACT", env) != null && config.redact == null);
    return { config, invalid };
  } catch {
    return { config: {}, invalid: present };
  }
};

const getHomeDir = () => process.env.HOME ?? os.homedir();

export async function getConfig(options?: {
  home: string;
  cwd: string;
  env: Record<string, string | undefined>;
}) {
  const home = options?.home ?? getHomeDir();
  const cwd = options?.cwd ?? process.cwd();
  const env = options?.env ?? process.env;

  const envConfig = readConfigEnv(env);
  const [globalConfig, localConfig] = await Promise.all([
    readConfigFile(path.join(home, ".codex", "langsmith.json")),
    readConfigFile(path.join(cwd, ".codex", "langsmith.json")),
  ]);
  const invalid = envConfig.invalid || globalConfig.invalid || localConfig.invalid;

  return ConfigSchema.parse({
    project: "codex",
    enabled: false,
    redact: true,
    ...globalConfig.config,
    ...localConfig.config,
    ...envConfig.config,
    ...(invalid ? { enabled: false } : {}),
  });
}
