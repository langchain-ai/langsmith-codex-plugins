// Frozen literals for the Codex integration (see validator.json).
import { LOGIN_NOTICE_KIND } from "@langchain/plugins-base/auth";
import type { HookPlacement } from "./models/hook-input.js";

/** Identifies this plugin as the trace source. */
export const LS_INTEGRATION = "openai-codex";

export const CODEX_CONFIG_DIRECTORY = ".codex";
export const PRIVACY_FILE_NAME = "langsmith_state_privacy.json";
export const LEGACY_PRIVACY_FILE_NAME = "langsmith-state.privacy.json";
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
export const PLUGIN_ENV_PREFIX = "LANGSMITH_CODEX_";
export const ENV_PREFIXES = [PLUGIN_ENV_PREFIX, "LANGSMITH_"] as const;
export const ENV_SUFFIXES = {
  apiKey: "API_KEY",
  apiUrl: "ENDPOINT",
  project: "PROJECT",
  metadata: "METADATA",
  replicas: "RUNS_ENDPOINTS",
  redact: "REDACT",
  redactExtraRules: "REDACT_EXTRA",
  strictAuth: "STRICT_AUTH",
  captureHookOutputs: "CAPTURE_HOOK_OUTPUTS",
  parentHeaders: "PARENT_HEADERS",
  noticeCooldown: "NOTICE_COOLDOWN",
} as const;
export const STRICT_TRUE_VALUE = "true";
export const STRICT_FALSE_VALUE = "false";
export const PARENT_PROJECT_PROBE = "codex-parent-without-project";
export const PARENT_TRACE_HEADER = "langsmith-trace";
export const ENABLED_ENV_KEYS = ["TRACE_TO_LANGSMITH"] as const;
export const AGENT_ID_ENV_KEY = "LANGSMITH_AGENT_ID";
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
export const LOCKED_MUTE_REPLY = "Thread tracing stays muted because your admin locked muting.";

export const SUBAGENT_SCOPE_RESET = {
  approval_policy: undefined,
  ls_is_error_interrupt: undefined,
} as const;

export const SKILL_SCOPE_RESET = {
  ...CHILD_SCOPE_RESET,
  usage_metadata: undefined,
} as const;

export const RESETTABLE_METADATA_KEYS = Object.keys(SKILL_SCOPE_RESET);
export const TOOL_PATH_INPUT_KEYS = ["file_path", "path", "workdir", "cwd"] as const;
export const PATCH_FILE_PATTERN = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/m;
export const GITHUB_LOGIN_MARKER_FILE_NAME = "langsmith_gh_login.json";
export const NORMALIZED_SNAPSHOT_OPTIONAL_FIELDS = [
  "start_time",
  "end_time",
  "parent_run_id",
  "trace_id",
  "dotted_order",
  "tags",
  "error",
  "serialized",
  "events",
  "reference_example_id",
] as const;
export const ENGINE_STORAGE_DIRECTORY = "langsmith_engine";
export const ENGINE_WORKER_FLAG = "--engine-worker";
export const RECORD_HOOK_FLAG = "--record-hook";
export const CAPTURE_FLAG_FILE = "capture-hook-outputs";
export const CAPTURE_FLAG_KEEP_MS = 86_400_000;
export const DEFAULT_LANGSMITH_API_URL = "https://api.smith.langchain.com";
export const TRACE_RUN_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export const TRACE_RUN_ID_PREFIX = "langsmith-codex:";
export const TRACE_RUN_EVENT_PREFIX = "codex-run:";
export const LIVE_RUN_EVENT_PREFIX = "codex-live-run:";
export const TRACE_RUN_PATCH_EVENT_PREFIX = "codex-run-patch:";
export const RUN_PATCH_FIELDS = ["outputs", "end_time", "error"] as const;
export const RUN_CONTEXT_FIELDS = [
  "start_time",
  "parent_run_id",
  "trace_id",
  "dotted_order",
] as const;
export const CAPTURE_SAVED_STATUSES: readonly string[] = ["published", "duplicate"];
export const LIVE_RUN_NOT_SAVED_MESSAGE = "Could not save a Codex tool run for upload:";
export const TOOL_RUN_ID_SEGMENT = ":tool:";
export const TOOL_OUTPUT_WAIT_MS = 3_000;
export const TOOL_OUTPUT_POLL_MS = 100;
export const TOOL_END_EVENT_SUFFIX = "_end";
export const OPEN_TURN_END = "langsmith_open_turn_end";
export const ITEM_COMPLETED_EVENT = "item_completed";
export const TOOL_ITEM_TYPES: readonly unknown[] = [
  "CommandExecution",
  "DynamicToolCall",
  "FileChange",
  "McpToolCall",
];
export const FAILED_TOOL_STATUSES: readonly unknown[] = ["failed", "declined"];
export const TOOL_RESULT_TYPE_SUFFIX = "_output";
export const HOOK_CONTEXT_KIND = "hooks.additional_context";
export const HOOK_FIRINGS_SUFFIX = ".langsmith-hooks";
export const UNKNOWN_HOOK_NAME = "Hook";
export const LATE_RUN_ID_PREFIX = "late:";
export const TURN_END_EVENTS: readonly unknown[] = [
  "task_complete",
  "turn_complete",
  "turn_aborted",
];
export const UNKNOWN_HOOK_PLACEMENT: HookPlacement = { direction: "input", scope: "turn" };
export const HOOK_PLACEMENTS: Record<string, HookPlacement> = {
  SessionStart: { direction: "input", scope: "turn" },
  UserPromptSubmit: { direction: "input", scope: "turn" },
  SubagentStart: { direction: "input", scope: "turn" },
  PreToolUse: { direction: "input", scope: "tool" },
  PostToolUse: { direction: "output", scope: "tool" },
};
export const TOOL_STATUS_ERROR_PREFIX = "Tool ";
export const SUBAGENT_AGENT_TYPE = "subagent";
export const OPEN_CLOSURE = "open";
export const PATCH_OPERATION = "patch";
export const RUN_RUNNING = "running";
export const RUN_COMPLETED = "completed";
export const RUN_ERROR = "error";
export const RECONSTRUCTION_EVENT_PREFIX = "codex-reconstruction:";
export const TRANSCRIPT_LOCATOR_PREFIX = "codex-transcript:";
export const CONTEXT_LOCATOR_PREFIX = "codex-context:";
export const JOB_STATE_FILE_NAME = "langsmith_state.json";
export const CONTEXT_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
export const STATE_FILE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const WARNING_FILE_NAME = "langsmith_warning.txt";
export const NOTICE_KIND_MANAGED = "managed";
export const NOTICE_KIND_CREDENTIAL = "credential";
export const NOTICE_KIND_REPLICA = "replica";
export const NOTICE_COOLDOWN_OFF = "off";
export const PARENT_HEADERS_FIELD = "parent_headers";
export const DROPPED_WORK_WARNING =
  "LangSmith could not accept a Codex trace upload and dropped it. Check your LangSmith API key and endpoint; details are in the Codex LangSmith log.";
export const DROPPED_LOGIN_WORK_WARNING_PREFIX =
  "LangSmith could not accept a Codex trace upload and dropped it. Run `";
export const DROPPED_LOGIN_WORK_WARNING_SUFFIX =
  "` to sign in again; details are in the Codex LangSmith log.";

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
export const TOOLS_WITH_END_EVENTS = new Set([...SHELL_TOOL_NAMES, "apply_patch"]);

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
export const STRICT_NOTICE_KINDS: readonly string[] = [LOGIN_NOTICE_KIND, NOTICE_KIND_CREDENTIAL];
// Mirrors Codex's own list in codex-rs/core/src/context/contextual_user_message.rs,
// except the user's own shell commands, plus the tags around pasted images.
export const CONTEXTUAL_USER_FRAGMENTS: readonly RegExp[] = [
  /^<(environment_context|skill|turn_aborted|subagent_notification|agent_message_board_notification|recommended_plugins|goal_context|codex_internal_context|external_[^\s>]+)[\s>][\s\S]*<\/\1>$/i,
  /^# AGENTS\.md instructions[\s\S]*<\/INSTRUCTIONS>$/i,
  /^<\/?image(?:\s[^>]*)?>$/i,
];
export const TOOL_OUTPUT_ENVELOPE_KEYS: readonly string[] = [
  "output",
  "metadata",
  "exit_code",
  "wall_time_seconds",
  "chunk_id",
  "original_token_count",
  "session_id",
];
export const DATA_URL_PATTERN = /^data:([^;,]+);base64,([\s\S]*)$/;
export const REVIEW_RESULT_PATTERN =
  /^<user_action>[\s\S]*?<action>([\s\S]*?)<\/action>[\s\S]*<\/user_action>$/i;
export const USER_SHELL_COMMAND_PATTERN =
  /^<user_shell_command>\s*<command>\n([\s\S]*?)\n<\/command>\s*<result>\n([\s\S]*)\n<\/result>\s*<\/user_shell_command>$/i;
export const REALTIME_DELEGATION_PATTERN =
  /^<realtime_delegation>[\s\S]*?<input>([\s\S]*?)<\/input>[\s\S]*<\/realtime_delegation>$/i;
export const QUESTION_REPLY_PATTERN =
  /^<send_user_message_question_reply>([\s\S]*)<\/send_user_message_question_reply>$/i;
export const HOOK_PROMPT_PATTERN = /^<hook_prompt\s[^>]*>([\s\S]*)<\/hook_prompt>$/i;
export const XML_ENTITY_PATTERN = /&(?:lt|gt|quot|apos|amp);/g;
export const XML_ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
};
