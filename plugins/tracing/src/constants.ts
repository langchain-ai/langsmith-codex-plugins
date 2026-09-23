// Frozen literals for the Codex integration (see validator.json).

/** What the traced agent is for, per the coding-agent-v1 contract. */
export const LS_AGENT_PURPOSE = "coding";

/** Identifies this plugin as the trace source. */
export const LS_INTEGRATION = "openai-codex";

/** Display name of the harness the trace came from. */
export const LS_AGENT_RUNTIME = "Codex";

/** Metadata contract the emitted runs conform to. */
export const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";

/** Names this plugin's entry in the Codex plugin marketplace. */
export const CODEX_PLUGIN_SELECTOR = "tracing@langsmith-codex-plugins";

// How a published platform key is spelled in messages to the user.
export const PLATFORM_NAMES: Record<string, string> = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

export const KNOWN_FLAGS = new Set([
  "--help",
  "-h",
  "--version",
  "-v",
  "--install",
  "--print",
  "--project",
  "--tag",
  "--update",
]);

export const PLUGIN_TABLE = /^\[\s*plugins\s*\.\s*(.+?)\s*\]\s*(?:#.*)?$/;
export const ENABLED_KEY = /^enabled\s*=\s*(true|false)\s*(?:#.*)?$/;

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
