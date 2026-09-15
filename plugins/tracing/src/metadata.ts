// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types.js";

const execFileAsync = promisify(execFile);

// Frozen literals for the Codex integration (see validator.json).
export const LS_AGENT_PURPOSE = "coding";
export const LS_INTEGRATION = "openai-codex";
export const LS_AGENT_RUNTIME = "Codex";
export const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";

/** The role a run plays within a coding-agent trace. */
export type LSAgentType = "root" | "subagent" | "middleware" | "compaction";

// Plugin version, injected at build time via bundler `define`.
// `typeof` guards the case where the define was not applied.
declare const __LS_INTEGRATION_VERSION__: string;
export const LS_INTEGRATION_VERSION: string | undefined =
  typeof __LS_INTEGRATION_VERSION__ === "string" && __LS_INTEGRATION_VERSION__.length > 0
    ? __LS_INTEGRATION_VERSION__
    : undefined;

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

// Derive repository_provider/repository_name from an https or scp git remote URL.
export function parseRepository(url: string | undefined): {
  repository_url?: string;
  repository_provider?: string;
  repository_name?: string;
} {
  const normalized = url?.trim();
  if (!normalized) return {};

  let host: string | undefined;
  let pathname: string | undefined;

  // scp-like syntax: git@github.com:org/repo.git
  const scp = /^[^/@]+@([^:/]+):(.+)$/.exec(normalized);
  if (scp) {
    host = scp[1];
    pathname = scp[2];
  } else {
    try {
      const parsed = new URL(normalized);
      host = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      // Unparseable remote — still surface the raw URL.
      return { repository_url: normalized };
    }
  }

  const provider = (() => {
    const h = (host ?? "").toLowerCase();
    if (h.includes("github")) return "github";
    if (h.includes("gitlab")) return "gitlab";
    if (h.includes("bitbucket")) return "bitbucket";
    return h || "other";
  })();

  // Full org/repo slug (e.g. langchain-ai/langsmith-codex-plugins), not bare repo.
  const name =
    (pathname ?? "")
      .replace(/^\/+/, "")
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join("/") || undefined;

  return {
    repository_url: normalized.replace(/\.git$/, ""),
    repository_provider: provider,
    repository_name: name,
  };
}

async function runGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: 2000 });
    const out = stdout.trim();
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

// Cache per cwd so we probe `git` at most once per workspace.
const gitInfoCache = new Map<string, Promise<GitInfo | undefined>>();

// Prefer the rollout's own session_meta.git; otherwise fall back to the git CLI.
export async function resolveGitInfo(
  cwd: string | undefined,
  sessionGit: GitInfo | undefined,
): Promise<GitInfo | undefined> {
  if (
    sessionGit != null &&
    (sessionGit.repository_url != null ||
      sessionGit.commit_hash != null ||
      sessionGit.branch != null)
  ) {
    return sessionGit;
  }

  if (!cwd) return undefined;

  let pending = gitInfoCache.get(cwd);
  if (pending == null) {
    pending = (async () => {
      const [repository_url, branch, commit_hash] = await Promise.all([
        runGit(cwd, ["remote", "get-url", "origin"]),
        runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
        runGit(cwd, ["rev-parse", "HEAD"]),
      ]);
      if (repository_url == null && branch == null && commit_hash == null) {
        return undefined;
      }
      return { repository_url, branch, commit_hash };
    })();
    gitInfoCache.set(cwd, pending);
  }
  return pending;
}

export interface CodingAgentContext {
  /** Role of these runs within the coding agent trace → `ls_agent_type`. */
  agentType: LSAgentType;
  /** Stable conversation/thread id used to group turns (Codex `thread_id`/session id). */
  threadId?: string;
  /** Stable per-turn id (Codex `turn_id`). */
  turnId?: string;
  /** 1-based native turn index within the thread. */
  turnNumber?: number;
  /** Codex CLI runtime version. */
  cliVersion?: string;
  /** Working directory for the turn. */
  cwd?: string;
  /** Resolved git info for the workspace. */
  git?: GitInfo;
  /** Sandbox / runtime isolation provider. */
  sandboxType?: string;
}

// Base contract merged onto every run; run-type-scoped keys are added at call
// sites. Unknown values are omitted.
export function codingAgentMetadata(ctx: CodingAgentContext): Record<string, unknown> {
  const repo = parseRepository(ctx.git?.repository_url);

  return stripUndefined({
    // Identity & grouping — required on every run.
    ls_agent_purpose: LS_AGENT_PURPOSE,
    ls_agent_type: ctx.agentType,
    ls_integration: LS_INTEGRATION,
    ls_agent_runtime: LS_AGENT_RUNTIME,
    thread_id: ctx.threadId,
    ls_trace_schema_version: LS_TRACE_SCHEMA_VERSION,

    // Versions & turn.
    ls_integration_version: LS_INTEGRATION_VERSION,
    ls_agent_runtime_version: ctx.cliVersion,
    turn_id: ctx.turnId,
    turn_number: ctx.turnNumber,

    // Git & workspace.
    repository_url: repo.repository_url,
    repository_provider: repo.repository_provider,
    repository_name: repo.repository_name,
    git_branch: ctx.git?.branch,
    git_commit_sha: ctx.git?.commit_hash,
    cwd: ctx.cwd,

    // Environment.
    sandbox_type: ctx.sandboxType,
  });
}

// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only sign of a skill.
// Codex 0.153+ calls the shell tool `exec`; older versions call it `exec_command`.
const SHELL_TOOL_NAMES = new Set(["exec", "exec_command"]);

// A shell word: no whitespace, no quotes.
const SHELL_WORD = /[^\s"']+/g;
const SKILL_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Anchored, so a read verb inside a path argument is not mistaken for the command.
const READ_COMMAND =
  /^\s*(?:\S*\/)?(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;

// The segment rewrites the file rather than reading it. The digit guard spares `2>/dev/null`.
const WRITES_TO_FILE = /(?<![-=<>!0-9])>>?\s*\S|\bsed\b[^\n]*\s-i\b/;

// Quoted runs are data, not syntax: `grep '>' file` redirects nothing.
const QUOTED_RUN = /"[^"]*"|'[^']*'/g;

// The `cmd:` string of one exec_command call, in double, single or backtick quotes.
const COMMAND_LITERAL =
  /\bcmd["']?\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|`((?:[^`\\]|\\[\s\S])*)`)/g;

// The literal is source text, so `\n` between two commands arrives as a backslash and an `n`.
const BACKSLASH_ESCAPE = /\\([\s\S])/g;
const STRING_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

// One command per run of non-separator characters; a separator inside quotes does not split.
const SHELL_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;|&\n"'])+/g;

// Split rather than match: one pattern spanning `/skills/<name>/SKILL.md` backtracks for seconds.
function skillDirectoryInPath(word: string): string | undefined {
  const parts = word.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== "SKILL.md" || name == null || !SKILL_DIR_NAME.test(name)) return undefined;
  return parts.slice(0, -2).includes("skills") ? name : undefined;
}

// Codex 0.153+ sends a JS program that may call exec_command more than once; before that, `{cmd}`.
function shellCommands(args: unknown): string[] {
  if (typeof args !== "string") {
    const cmd = (args as { cmd?: unknown } | undefined)?.cmd;
    return typeof cmd === "string" ? [cmd] : [];
  }
  return [...args.matchAll(COMMAND_LITERAL)].map(([, double, single, backtick]) =>
    (double ?? single ?? backtick).replace(
      BACKSLASH_ESCAPE,
      (_, char: string) => STRING_ESCAPES[char] ?? char,
    ),
  );
}

// Gate each segment on its own: a `cat` in one command must not excuse a `git diff` in the next.
export function skillNamesFromToolCall(toolName: string | undefined, args: unknown): string[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const segments = shellCommands(args).flatMap((command) => command.match(SHELL_SEGMENT) ?? []);

  const names = new Set<string>();
  for (const segment of segments) {
    const unquoted = segment.replace(QUOTED_RUN, " ");
    if (!READ_COMMAND.test(segment) || WRITES_TO_FILE.test(unquoted)) continue;
    for (const word of segment.match(SHELL_WORD) ?? []) {
      const name = skillDirectoryInPath(word);
      if (name != null) names.add(name);
    }
  }
  return [...names];
}

// Private, non-serializable provenance: custom metadata cannot impersonate
// safe structural fields. Pass the merged result directly to privacy helpers;
// spreading/JSON-cloning metadata itself loses provenance.
const TRUSTED_METADATA = Symbol("coding-agent trusted metadata");
export function withTrustedMetadata(
  untrusted: Record<string, unknown>,
  structural: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...untrusted, ...structural };
  Object.defineProperty(merged, TRUSTED_METADATA, { value: { ...structural } });
  return merged;
}
export function trustedCodingAgentMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return (metadata as { [TRUSTED_METADATA]?: Record<string, unknown> } | undefined)?.[
    TRUSTED_METADATA
  ];
}
