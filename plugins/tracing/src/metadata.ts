// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types.js";
import { isRecord } from "./utils/isRecord.js";

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

/**
 * Skill name for the `ls_skill_name` metadata key (coding-agent-v1 contract).
 * Codex has no skill span/tool/catalog event; a skill invocation shows up only as
 * an exec_command that reads `.../skills/<name>/SKILL.md` (rationale in PR #25).
 * Reads only — writes/edits/deletes excluded; repeated reads deduped by caller.
 */
// Accept both POSIX and Windows path separators.
const SKILL_MD_PATH =
  /(?:^|[/\\])skills[/\\](?:[^\s"']*[/\\])?([A-Za-z0-9][A-Za-z0-9._-]*)[/\\]SKILL\.md(?![\w.-])/;

// Read utilities Codex uses to load a skill; anything that writes, edits in
// place, redirects, or deletes must never count as a skill invocation.
// Verbs match only when followed by whitespace (actually invoked), so a skill
// name segment like `cp-tool` in the path isn't read as the command.
const READ_COMMAND =
  /\b(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;
const MUTATING_COMMAND =
  /(?:>>?|\btee\s|\bsed\b[^\n]*\s-i\b|\b(?:rm|rmdir|unlink|mv|cp|dd|truncate|install|ln|chmod|chown|touch|mkdir)\s)/;

/** Shell-command text from an exec_command tool call's arguments. */
function commandText(args: unknown): string | undefined {
  if (typeof args === "string") return args;
  if (isRecord(args) && typeof args.cmd === "string") return args.cmd;
  return undefined;
}

export function skillNameFromToolCall(
  toolName: string | undefined,
  args: unknown,
): string | undefined {
  if (toolName !== "exec_command") return undefined;
  const cmd = commandText(args);
  if (cmd == null) return undefined;
  if (!READ_COMMAND.test(cmd) || MUTATING_COMMAND.test(cmd)) return undefined;
  return SKILL_MD_PATH.exec(cmd)?.[1];
}
