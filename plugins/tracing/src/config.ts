import {
  COMMON_BOOLEAN_SETTINGS,
  lockPluginFields,
  mergeCommonConfig,
  parseCommonConfig,
  readCommonConfigFiles,
} from "@langchain/plugins-base/settings";
import {
  CODEX_CONFIG_DIRECTORY,
  DEFAULT_LANGSMITH_PROJECT_NAME,
  DEFAULT_MUTED_ENV_KEYS,
  ENABLED_ENV_KEYS,
  ENV_FALSE_VALUES,
  ENV_PREFIXES,
  ENV_SUFFIXES,
  ENV_TRUE_VALUES,
  NOTICE_COOLDOWN_OFF,
  PARENT_HEADERS_FIELD,
  PARENT_TRACE_HEADER,
  STRICT_FALSE_VALUE,
  STRICT_TRUE_VALUE,
} from "./constants.js";
import type {
  Config,
  ConfigEnv,
  ConfigOptions,
  EnvironmentLayer,
  ParentHeaders,
} from "./models/config.js";
import { silenceWarnings } from "./utils/console/silence-warnings.js";
import { isRecord } from "./utils/isRecord.js";

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined) return undefined;
  if (ENV_TRUE_VALUES.includes(normalized)) return true;
  if (ENV_FALSE_VALUES.includes(normalized)) return false;
  return undefined;
}

function parseCooldown(value: string | undefined): unknown {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined || normalized === NOTICE_COOLDOWN_OFF) return normalized;
  return normalized !== "" && Number.isFinite(Number(normalized)) ? Number(normalized) : value;
}

function parseStrictBoolean(value: string): boolean | undefined {
  const normalized = value.toLowerCase();
  if (normalized === STRICT_TRUE_VALUE) return true;
  if (normalized === STRICT_FALSE_VALUE) return false;
  return undefined;
}

function parseJson(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parseParentHeaders(value: unknown): ParentHeaders | undefined {
  if (!isRecord(value) || typeof value[PARENT_TRACE_HEADER] !== "string") return undefined;
  const { baggage } = value;
  if (baggage !== undefined && typeof baggage !== "string") return undefined;
  return {
    [PARENT_TRACE_HEADER]: value[PARENT_TRACE_HEADER],
    ...(baggage === undefined ? {} : { baggage }),
  };
}

function envSwitch(
  env: ConfigEnv,
  keys: readonly string[],
  parse: (value: string) => boolean | undefined,
  restrictive: boolean,
): boolean | undefined {
  const value = keys.map((key) => env[key]).find((entry) => entry !== undefined);
  return value === undefined ? undefined : (parse(value) ?? restrictive);
}

function nonBlank(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

function envVariable(env: ConfigEnv, suffix: string): string | undefined {
  return ENV_PREFIXES.map((prefix) => nonBlank(env[`${prefix}${suffix}`])).find(
    (value) => value !== undefined,
  );
}

function readEnvironment(env: ConfigEnv): EnvironmentLayer {
  const rawParent = parseJson(envVariable(env, ENV_SUFFIXES.parentHeaders));
  const parentHeaders = rawParent === undefined ? undefined : parseParentHeaders(rawParent);
  const fields = {
    api_key: envVariable(env, ENV_SUFFIXES.apiKey),
    api_url: envVariable(env, ENV_SUFFIXES.apiUrl),
    project: envVariable(env, ENV_SUFFIXES.project),
    metadata: parseJson(envVariable(env, ENV_SUFFIXES.metadata)),
    replicas: parseJson(envVariable(env, ENV_SUFFIXES.replicas)),
    redact: parseBoolean(envVariable(env, ENV_SUFFIXES.redact)),
    redact_extra_rules: parseJson(envVariable(env, ENV_SUFFIXES.redactExtraRules)),
    notice_cooldown: parseCooldown(envVariable(env, ENV_SUFFIXES.noticeCooldown)),
  };
  const parsed = parseCommonConfig(
    Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  );
  if (parsed.status !== "valid" || (rawParent !== undefined && parentHeaders === undefined)) {
    return { common: {} };
  }
  return { common: parsed.common, parentHeaders };
}

export async function getConfig({ home, cwd, env }: ConfigOptions): Promise<Config> {
  const files = readCommonConfigFiles({ cwd, home, harnessDirectory: CODEX_CONFIG_DIRECTORY });
  const environment = readEnvironment(env);
  const { managed } = files;
  const { diagnostics, defaulted, ...common } = silenceWarnings(() =>
    mergeCommonConfig(
      {
        managed,
        userRoot: files.userRoot.common,
        user: files.user.common,
        root: files.root.common,
        harness: files.harness.common,
        env: {
          ...environment.common,
          enabled: envSwitch(
            env,
            ENABLED_ENV_KEYS,
            parseBoolean,
            COMMON_BOOLEAN_SETTINGS.enabled.restrictive,
          ),
          defaultMuted: envSwitch(
            env,
            DEFAULT_MUTED_ENV_KEYS,
            parseStrictBoolean,
            COMMON_BOOLEAN_SETTINGS.defaultMuted.restrictive,
          ),
        },
      },
      { envFirst: true },
    ),
  );
  const lockedHeaders = lockPluginFields(managed, { lockable: [PARENT_HEADERS_FIELD] });
  const parentHeaders = Object.hasOwn(lockedHeaders, PARENT_HEADERS_FIELD)
    ? parseParentHeaders(lockedHeaders[PARENT_HEADERS_FIELD])
    : (environment.parentHeaders ??
      [files.harness, files.root, files.user, files.userRoot]
        .map((file) => parseParentHeaders(file.raw?.parent_headers))
        .find((headers) => headers !== undefined));
  return {
    ...common,
    api_key: nonBlank(common.api_key),
    api_url: nonBlank(common.api_url),
    project: nonBlank(common.project) ?? DEFAULT_LANGSMITH_PROJECT_NAME,
    ...(parentHeaders === undefined ? {} : { parent_headers: parentHeaders }),
    ...(diagnostics.length === 0 ? {} : { managedConfigWarnings: diagnostics }),
  };
}
