import * as os from "node:os";
import * as path from "node:path";

import { z } from "zod";
import {
  COMMON_BOOLEAN_SETTINGS,
  mergeCommonConfig,
  readCommonConfigFile,
  type CommonConfigResult,
} from "./shared-config.js";

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
  // Environment > project .codex > project root > user .codex > home root > false
  enabled: z.boolean(),

  // Default for threads without an explicit override; independent of enabled.
  defaultMuted: z.boolean(),

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

/** Default mute deliberately accepts no aliases or surrounding whitespace. */
function parseStrictBoolean(value: string): boolean | undefined {
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

const BOOLEAN_SETTINGS = {
  enabled: {
    env: ["TRACE_TO_LANGSMITH"],
    parse: parseBoolean, // Preserve the historical trimmed master-switch aliases.
    ...COMMON_BOOLEAN_SETTINGS.enabled,
  },
  defaultMuted: {
    env: ["LANGSMITH_CODEX_DEFAULT_MUTED", "LANGSMITH_DEFAULT_MUTED"],
    parse: parseStrictBoolean,
    ...COMMON_BOOLEAN_SETTINGS.defaultMuted,
  },
} as const;
type BooleanSetting = keyof typeof BOOLEAN_SETTINGS;
/** File extensions are independent: malformed parent headers cannot disable common tracing. */
function parentHeaders(result: CommonConfigResult): Config["parent_headers"] {
  const parsed = ConfigSchema.shape.parent_headers.safeParse(result.raw?.parent_headers);
  return parsed.success ? parsed.data : undefined;
}

/** Keep each switch's adapter-owned environment parser and restrictive fallback. */
function envBoolean(
  field: BooleanSetting,
  env: Record<string, string | undefined>,
): boolean | undefined {
  const setting = BOOLEAN_SETTINGS[field];
  const value = setting.env.map((key) => env[key]).find((value) => value !== undefined);
  if (value === undefined) return undefined;
  return setting.parse(value) ?? setting.restrictive;
}

function getVar(suffix: string, env: Record<string, string | undefined>): string | undefined {
  return env[`LANGSMITH_CODEX_${suffix}`] ?? env[`LANGSMITH_${suffix}`];
}

const readConfigEnv = (env: Record<string, string | undefined>): Partial<Config> => {
  try {
    return stripUndefined(
      PartialConfigSchema.parse({
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
  } catch {
    // A malformed env value (e.g. METADATA / RUNS_ENDPOINTS / REDACT_EXTRA that
    // parses as JSON but doesn't match the schema) would otherwise throw and
    // crash the hook. Preserve the legacy whole ordinary-env-layer fallback.
    // Privacy switches are parsed independently; files use the common contract.
    return {};
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
  const user = readCommonConfigFile(path.join(home, ".codex", "langsmith.json"));
  const root = readCommonConfigFile(path.join(cwd, "langsmith-plugins.json"));
  const harness = readCommonConfigFile(path.join(cwd, ".codex", "langsmith.json"));
  const userRoot = readCommonConfigFile(path.join(home, ".langsmith-plugins.json"));
  const common = mergeCommonConfig(
    {
      userRoot: userRoot.common,
      user: user.common,
      root: root.common,
      harness: harness.common,
      env: {
        ...envConfig,
        enabled: envBoolean("enabled", env),
        defaultMuted: envBoolean("defaultMuted", env),
      },
      defaults: { project: "codex" },
    },
    { envFirst: true },
  );

  const parent =
    envConfig.parent_headers ??
    parentHeaders(harness) ??
    parentHeaders(root) ??
    parentHeaders(user) ??
    parentHeaders(userRoot);
  // Common fields are already validated. Do not run them through the extension/env schema.
  return {
    ...stripUndefined({ ...common }),
    enabled: common.enabled,
    defaultMuted: common.defaultMuted,
    redact: common.redact,
    ...(parent === undefined ? {} : { parent_headers: parent }),
  } satisfies Config;
}
