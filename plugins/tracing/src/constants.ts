// Frozen literals for the Codex integration (see validator.json).

/** Identifies this plugin as the trace source. */
export const LS_INTEGRATION = "openai-codex";

export const CODEX_CONFIG_DIRECTORY = ".codex";
export const PRIVACY_FILE_NAME = "langsmith-state.privacy.json";
export const SIDECAR_SUFFIX = ".langsmith";

// Null run-type-scoped keys on llm/tool runs to override langsmith's
// parent->child metadata inheritance (serialization drops undefined).
export const CHILD_SCOPE_RESET = {
  approval_policy: undefined,
  ls_is_error_interrupt: undefined,
  ls_subagent_id: undefined,
  ls_subagent_type: undefined,
} as const;

export const MODE_FULL = "full";
export const MODE_METADATA = "metadata";
export const MODE_OFF = "off";

export const DEFAULT_LANGSMITH_PROJECT_NAME = "codex";
export const ENV_PREFIXES = ["LANGSMITH_CODEX_", "LANGSMITH_"] as const;
export const ENV_SUFFIXES = {
  apiKey: "API_KEY",
  apiUrl: "ENDPOINT",
  project: "PROJECT",
  metadata: "METADATA",
  replicas: "RUNS_ENDPOINTS",
  redact: "REDACT",
  redactExtraRules: "REDACT_EXTRA",
  parentHeaders: "PARENT_HEADERS",
} as const;
export const STRICT_TRUE_VALUE = "true";
export const STRICT_FALSE_VALUE = "false";
export const PARENT_TRACE_HEADER = "langsmith-trace";
export const ENABLED_ENV_KEYS = ["TRACE_TO_LANGSMITH"] as const;
export const DEFAULT_MUTED_ENV_KEYS = [
  "LANGSMITH_CODEX_DEFAULT_MUTED",
  "LANGSMITH_DEFAULT_MUTED",
] as const;
export const ENV_TRUE_VALUES: readonly string[] = ["1", "true", "yes", "on"];
export const ENV_FALSE_VALUES: readonly string[] = ["0", "false", "no", "off"];

export const POLICY_VERSION = 1;
export const POLICY_THREAD_KEYS: readonly string[] = ["preference", "turns", "inherited"];
export const POLICY_TOP_LEVEL_KEYS: readonly string[] = ["version", "threads"];
export const POLICY_INVALID_MESSAGE = "Invalid tracing preference format";
export const PREFERENCE_WARNING_PREFIX = "Tracing preference warning:";
export const MUTE_COMMAND = "langsmith-tracing:mute";
export const UNMUTE_COMMAND = "langsmith-tracing:unmute";

export const SUBAGENT_SCOPE_RESET = {
  approval_policy: undefined,
  ls_is_error_interrupt: undefined,
} as const;

export const SKILL_SCOPE_RESET = {
  ...CHILD_SCOPE_RESET,
  usage_metadata: undefined,
} as const;

export const RESETTABLE_METADATA_KEYS = Object.keys(SKILL_SCOPE_RESET);
export const GIT_SCP_REMOTE_PATTERN = /^[^/@]+@([^:/]+):(.+)$/;
export const GIT_HTTP_CREDENTIALS_PATTERN = /^(https?:\/\/)[^/@]+@/i;
export const GIT_PATH_PREFIX_PATTERN = /^\/+/;
export const GIT_SUFFIX_PATTERN = /\.git$/;

export const KNOWN_FLAGS = new Set(["--help", "-h", "--version", "-v"]);

// Plugin version, injected at build time via bundler `define`.
// `typeof` guards the case where the define was not applied.
declare const __LS_INTEGRATION_VERSION__: string;

/** Plugin version, or undefined outside a bundled build. */
export const LS_INTEGRATION_VERSION: string | undefined =
  typeof __LS_INTEGRATION_VERSION__ === "string" && __LS_INTEGRATION_VERSION__.length > 0
    ? __LS_INTEGRATION_VERSION__
    : undefined;

// Patterns for reading a skill name out of a shell command.

// Codex 0.153+ calls the shell tool `exec`; older versions call it `exec_command`.
export const SHELL_TOOL_NAMES = new Set(["exec", "exec_command"]);

// A shell word: no whitespace, no quotes.
export const SHELL_WORD = /[^\s"']+/g;
export const SKILL_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Anchored, so a read verb inside a path argument is not mistaken for the command.
export const READ_COMMAND =
  /^\s*(?:\S*\/)?(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;

// A write, not a read; the digit guard spares `2>/dev/null`.
export const WRITES_TO_FILE = /(?<![-=<>!0-9])>>?\s*\S|\bsed\b[^\n]*\s-i\b/;

// Quoted runs are data, not syntax: `grep '>' file` redirects nothing.
export const QUOTED_RUN = /"[^"]*"|'[^']*'/g;

// The `cmd:` string of one exec_command call, in double, single or backtick quotes.
export const COMMAND_LITERAL =
  /\bcmd["']?\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|`((?:[^`\\]|\\[\s\S])*)`)/g;

// The literal is source text, so `\n` between two commands arrives as two characters.
export const BACKSLASH_ESCAPE = /\\([\s\S])/g;
export const STRING_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

// One command per run of non-separator characters; a quoted separator does not split.
export const SHELL_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;|&\n"'])+/g;
