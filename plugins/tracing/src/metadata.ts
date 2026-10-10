import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types.js";
const execFileAsync = promisify(execFile);

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
