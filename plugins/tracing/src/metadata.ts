// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CodingAgentContext,
  RepositoryIdentity,
  RepositoryMetadata,
  ResolvedGitAttribution,
} from "./metadata-models.js";
import type { GitInfo } from "./types.js";
import {
  LS_AGENT_PURPOSE,
  LS_AGENT_RUNTIME,
  LS_INTEGRATION,
  LS_INTEGRATION_VERSION,
  LS_TRACE_SCHEMA_VERSION,
} from "./constants.js";
import {
  GITHUB_API_TIMEOUT_MS,
  GIT_COMMAND_TIMEOUT_MS,
  GIT_LOCATION_ENV_KEYS,
  GIT_SCP_REMOTE,
  GIT_SUFFIX,
} from "./metadata-constants.js";
import { nearestExistingDirectory } from "./utils/paths.js";
import { stripUndefined } from "./utils/objects.js";

const execFileAsync = promisify(execFile);

// Derive repository_provider/repository_name from an https or scp git remote URL.
export function parseRepository(url: string | undefined): RepositoryMetadata {
  const normalized = url?.trim();
  if (!normalized) return {};

  let host: string | undefined;
  let pathname: string | undefined;

  // scp-like syntax: git@github.com:org/repo.git
  const scp = GIT_SCP_REMOTE.exec(normalized);
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
      .replace(GIT_SUFFIX, "")
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join("/") || undefined;

  return {
    repository_url: normalized.replace(GIT_SUFFIX, ""),
    repository_provider: provider,
    repository_name: name,
  };
}

export function sameRepository(left: string, right: string): boolean {
  const leftIdentity = repositoryIdentity(left);
  const rightIdentity = repositoryIdentity(right);
  if (leftIdentity && rightIdentity) {
    return leftIdentity.host === rightIdentity.host && leftIdentity.path === rightIdentity.path;
  }
  const leftParsed = parseRepository(left);
  const rightParsed = parseRepository(right);
  return leftParsed.repository_url === rightParsed.repository_url;
}

function repositoryIdentity(url: string): RepositoryIdentity | undefined {
  const scp = GIT_SCP_REMOTE.exec(url.trim());
  if (scp?.[1] && scp[2]) {
    const repositoryPath = scp[2].split("/").filter(Boolean).join("/").replace(GIT_SUFFIX, "");
    return repositoryPath ? { host: scp[1].toLowerCase(), path: repositoryPath } : undefined;
  }
  try {
    const parsed = new URL(url);
    const repositoryPath = parsed.pathname
      .split("/")
      .filter(Boolean)
      .join("/")
      .replace(GIT_SUFFIX, "");
    return parsed.host && repositoryPath
      ? { host: parsed.host.toLowerCase(), path: repositoryPath }
      : undefined;
  } catch {
    return undefined;
  }
}

async function runGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const env = { ...process.env };
    for (const key of GIT_LOCATION_ENV_KEYS) delete env[key];
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      env,
      timeout: GIT_COMMAND_TIMEOUT_MS,
    });
    const out = stdout.trim();
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

async function githubLogin(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("gh", ["api", "user", "--jq", ".login"], {
      timeout: GITHUB_API_TIMEOUT_MS,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function resolveGitAttribution(
  cwd: string | undefined,
): Promise<ResolvedGitAttribution | undefined> {
  if (!cwd) return undefined;
  const directory = await nearestExistingDirectory(cwd);
  if (!directory) return undefined;
  const root = await runGit(directory, ["rev-parse", "--show-toplevel"]);
  if (!root) return undefined;
  const [repository_url, currentBranch, commit_hash, configuredName] = await Promise.all([
    runGit(root, ["remote", "get-url", "origin"]),
    runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    runGit(root, ["rev-parse", "HEAD"]),
    runGit(root, ["config", "user.name"]),
  ]);
  const git = stripUndefined({
    repository_url,
    branch: currentBranch === "HEAD" ? undefined : currentBranch,
    commit_hash,
  }) as GitInfo;
  return {
    root,
    git,
    identifier: configuredName ?? (await githubLogin()),
  };
}

export function mergeGitInfo(
  liveGit: GitInfo | undefined,
  sessionGit: GitInfo | undefined,
): GitInfo | undefined {
  if (
    liveGit?.repository_url &&
    sessionGit?.repository_url &&
    !sameRepository(liveGit.repository_url, sessionGit.repository_url)
  ) {
    return sessionGit;
  }
  const merged = stripUndefined({ ...liveGit, ...sessionGit }) as GitInfo;
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function toolRepositoryMetadata(
  attribution: ResolvedGitAttribution | undefined,
): Record<string, unknown> {
  const repo = parseRepository(attribution?.git.repository_url);
  return {
    repository_url: repo.repository_url,
    repository_provider: repo.repository_provider,
    repository_name: repo.repository_name,
    git_branch: attribution?.git.branch,
    git_commit_sha: attribution?.git.commit_hash,
    ls_attribution_identifier: attribution?.identifier,
  };
}

// Base contract merged onto every run; run-type-scoped keys are added at call
// sites. Unknown values are omitted.
export function codingAgentMetadata(
  ctx: CodingAgentContext,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const existingRepositoryUrl =
    typeof existing.repository_url === "string" && existing.repository_url.length > 0
      ? existing.repository_url
      : undefined;
  const repo = parseRepository(existingRepositoryUrl ?? ctx.git?.repository_url);
  const inferredGitMatchesExisting =
    existingRepositoryUrl == null ||
    (ctx.git?.repository_url != null &&
      sameRepository(existingRepositoryUrl, ctx.git.repository_url));
  const existingValue = (key: string) =>
    typeof existing[key] === "string" && existing[key].length > 0 ? existing[key] : undefined;

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
    repository_url: existingRepositoryUrl ?? repo.repository_url,
    repository_provider: existingValue("repository_provider") ?? repo.repository_provider,
    repository_name: existingValue("repository_name") ?? repo.repository_name,
    git_branch:
      existingValue("git_branch") ?? (inferredGitMatchesExisting ? ctx.git?.branch : undefined),
    git_commit_sha:
      existingValue("git_commit_sha") ??
      (inferredGitMatchesExisting ? ctx.git?.commit_hash : undefined),
    ls_attribution_identifier:
      existingValue("ls_attribution_identifier") ?? ctx.attributionIdentifier,
    cwd: ctx.cwd,

    // Environment.
    sandbox_type: ctx.sandboxType,
  });
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
