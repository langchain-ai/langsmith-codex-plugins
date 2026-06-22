// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types.js";

const execFileAsync = promisify(execFile);

// Frozen literals for the Codex integration (see validator.json).
export const LS_AGENT_KIND = "coding_agent";
export const LS_INTEGRATION = "openai-codex";
export const LS_AGENT_RUNTIME = "Codex";
export const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";

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
    ls_agent_kind: LS_AGENT_KIND,
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
