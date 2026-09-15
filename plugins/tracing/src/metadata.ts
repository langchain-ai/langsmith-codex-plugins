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

// Codex has no skill tool and no skill-invocation event, so a skill read is just a shell command
// on `.../skills/<name>/SKILL.md`. The shell tool is `exec` on cli 0.153+, `exec_command` before.
const SHELL_TOOL_NAMES = new Set(["exec", "exec_command"]);

// Path-shaped words in a segment: a shell word holds no whitespace or quotes.
const PATH_TOKEN = /[^\s"']+/g;
const SKILL_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Anchored at the start of a segment so a path argument containing a verb is not read as one.
const READ_COMMAND =
  /^\s*(?:\S*\/)?(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;

// Redirect or in-place edit: the segment rewrites the skill rather than loading it. The lookbehind
// keeps `=>`, `->`, `2>&1` and `2>/dev/null` from reading as redirects.
const WRITES_TO_FILE = /(?<![-=<>!0-9])>>?\s*(?!&)\S|\bsed\b[^\n]*\s-i\b/;

// The `cmd` of one exec_command call, capturing the string literal's body with escapes intact.
const COMMAND_LITERAL =
  /\bcmd["']?\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|`((?:[^`\\]|\\[\s\S])*)`)/g;

const STRING_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

// One shell command per run of non-separator characters; a separator inside quotes does not split.
const SHELL_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;|&\n"'])+/g;

// The skill directory of `<...>/skills/<...>/<name>/SKILL.md`, for POSIX and Windows separators.
// Split rather than match the whole path: a single pattern spanning the middle segments backtracks
// for seconds on a long run of `/skills/`.
function skillDirectoryInPath(token: string): string | undefined {
  const parts = token.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== "SKILL.md" || name == null || !SKILL_DIR_NAME.test(name)) return undefined;
  return parts.slice(0, -2).includes("skills") ? name : undefined;
}

// Codex 0.153+ passes a JS program that may call exec_command several times. Pull out each `cmd`
// so the shell text is gated on its own rather than together with the surrounding JS.
function shellCommands(args: unknown): string[] {
  if (typeof args === "string") {
    return [...args.matchAll(COMMAND_LITERAL)].map((match) =>
      (match[1] ?? match[2] ?? match[3]).replace(
        /\\([\s\S])/g,
        (_, escaped: string) => STRING_ESCAPES[escaped] ?? escaped,
      ),
    );
  }
  const cmd = (args as { cmd?: unknown } | undefined)?.cmd;
  return typeof cmd === "string" ? [cmd] : [];
}

// Skills read by one tool call, deduplicated, in the order they appear. Each shell segment is
// gated on its own: a read verb or redirect in one segment says nothing about the next.
export function skillNamesFromToolCall(toolName: string | undefined, args: unknown): string[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const names = new Set<string>();
  for (const command of shellCommands(args)) {
    for (const segment of command.match(SHELL_SEGMENT) ?? []) {
      if (!READ_COMMAND.test(segment) || WRITES_TO_FILE.test(segment)) continue;
      for (const [token] of segment.matchAll(PATH_TOKEN)) {
        const name = skillDirectoryInPath(token);
        if (name != null) names.add(name);
      }
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
