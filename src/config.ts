import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { z } from "zod";

const ReplicaSchema = z.preprocess(
  (value) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    const replica = value as Record<string, unknown>;
    return {
      api_url: replica.api_url ?? replica.apiUrl,
      api_key: replica.api_key ?? replica.apiKey,
      project: replica.project ?? replica.projectName,
      updates: replica.updates,
    };
  },
  z.object({
    api_url: z.string().optional(),
    api_key: z.string().optional(),
    project: z.string().optional(),
    updates: z.record(z.string(), z.unknown()).optional(),
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

async function readConfigFile(file: string): Promise<Partial<Config> | undefined> {
  try {
    const data = await fs.readFile(file, "utf-8");
    return PartialConfigSchema.parse(JSON.parse(data));
  } catch {
    return undefined;
  }
}

function getVar(suffix: string, env: Record<string, string | undefined>): string | undefined {
  return env[`LANGSMITH_CODEX_${suffix}`] ?? env[`LANGSMITH_${suffix}`];
}

const readConfigEnv = (env: Record<string, string | undefined>): Partial<Config> => {
  const enabled = parseBoolean(env.TRACE_TO_LANGSMITH);

  return stripUndefined(
    PartialConfigSchema.parse({
      enabled,
      api_key: getVar("API_KEY", env),
      api_url: getVar("ENDPOINT", env),
      project: getVar("PROJECT", env),
      metadata: parseJson(getVar("METADATA", env)),
      replicas: parseJson(getVar("RUNS_ENDPOINTS", env)),
    }),
  );
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

  return ConfigSchema.parse({
    project: "codex",
    enabled: false,
    ...globalConfig,
    ...localConfig,
    ...envConfig,
  });
}
