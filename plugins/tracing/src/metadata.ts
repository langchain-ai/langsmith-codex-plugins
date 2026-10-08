// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { absoluteTarget, nearestExistingDirectory } from "./utils/paths.js";
import { isRecord } from "./utils/objects.js";
import type {
  CodingAgentContext,
  ResolvedGitAttribution,
  ToolAttribution,
  ToolPathTargets,
} from "./metadata-models.js";
import type { GitInfo, ToolCallEvidence } from "./types.js";
import {
  GITHUB_CONFIG_DIRECTORY,
  GITHUB_CONFIG_ENV,
  GITHUB_HOST_ENTRY,
  GITHUB_HOSTS_FILE,
  GITHUB_HOST_NAME,
  GITHUB_USER_ENTRY,
  GIT_SCP_REMOTE,
  GIT_SUFFIX,
  GIT_LOCATION_ENV_KEYS,
  LS_AGENT_PURPOSE,
  LS_AGENT_RUNTIME,
  LS_INTEGRATION,
  LS_INTEGRATION_VERSION,
  LS_TRACE_SCHEMA_VERSION,
  REPOSITORY_METADATA_KEYS,
  TOOL_PATH_KEYS,
  TOOL_WORKING_DIRECTORY_KEYS,
} from "./constants.js";

const execFileAsync = promisify(execFile);

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

async function runGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const env = { ...process.env };
    for (const key of GIT_LOCATION_ENV_KEYS) delete env[key];
    const { stdout } = await execFileAsync("git", args, { cwd, env, timeout: 2000 });
    const out = stdout.trim();
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

async function githubLogin(): Promise<string | undefined> {
  const configDirectory =
    process.env[GITHUB_CONFIG_ENV] ?? path.join(os.homedir(), GITHUB_CONFIG_DIRECTORY);
  let contents: string;
  try {
    contents = await fs.readFile(path.join(configDirectory, GITHUB_HOSTS_FILE), "utf-8");
  } catch {
    return undefined;
  }

  let host: string | undefined;
  let firstLogin: string | undefined;
  let githubLoginName: string | undefined;
  for (const line of contents.split(/\r?\n/)) {
    const hostEntry = GITHUB_HOST_ENTRY.exec(line);
    if (hostEntry) {
      host = hostEntry[1];
      continue;
    }
    const userEntry = GITHUB_USER_ENTRY.exec(line);
    const login = userEntry?.[1] ?? userEntry?.[2] ?? userEntry?.[3];
    if (!host || !login) continue;
    firstLogin ??= login;
    if (host === GITHUB_HOST_NAME) githubLoginName = login;
  }
  return githubLoginName ?? firstLogin;
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

function sameRepository(left: string, right: string): boolean {
  const leftIdentity = repositoryIdentity(left);
  const rightIdentity = repositoryIdentity(right);
  if (leftIdentity && rightIdentity) {
    return leftIdentity.host === rightIdentity.host && leftIdentity.path === rightIdentity.path;
  }
  const leftParsed = parseRepository(left);
  const rightParsed = parseRepository(right);
  return leftParsed.repository_url === rightParsed.repository_url;
}

function repositoryIdentity(url: string): { host: string; path: string } | undefined {
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

export async function resolveGitInfo(
  cwd: string | undefined,
  sessionGit: GitInfo | undefined,
): Promise<GitInfo | undefined> {
  return mergeGitInfo((await resolveGitAttribution(cwd))?.git, sessionGit);
}

export function toolPathTargets(
  input: unknown,
  evidence: ToolCallEvidence | undefined,
  sessionCwd: string | undefined,
): ToolPathTargets {
  const args = isRecord(input) ? input : undefined;
  const executionDirectory = absoluteTarget(evidence?.executionCwd, sessionCwd);
  if (args == null || typeof args.code === "string" || typeof args.script === "string") {
    const paths =
      evidence?.changedPaths != null
        ? evidence.changedPaths.map((value) =>
            absoluteTarget(value, executionDirectory ?? sessionCwd),
          )
        : executionDirectory != null
          ? [executionDirectory]
          : [];
    return {
      explicit: true,
      paths: [...new Set(paths.filter((value): value is string => value != null))],
    };
  }

  const rawDirectories = TOOL_WORKING_DIRECTORY_KEYS.flatMap((key) =>
    args && Object.hasOwn(args, key) && args[key] != null ? [args[key]] : [],
  );
  const rawPaths = TOOL_PATH_KEYS.flatMap((key) =>
    args && Object.hasOwn(args, key) && args[key] != null ? [args[key]] : [],
  );
  const workingDirectories = rawDirectories.map((value) => absoluteTarget(value, sessionCwd));
  const baseDirectory =
    executionDirectory ?? workingDirectories.find((value) => value != null) ?? sessionCwd;
  const hasFileTargets = rawPaths.length > 0 || evidence?.changedPaths != null;
  const fileTargets = [
    ...rawPaths.map((value) => absoluteTarget(value, baseDirectory)),
    ...(evidence?.changedPaths ?? []).map((value) => absoluteTarget(value, baseDirectory)),
  ];
  const paths = hasFileTargets
    ? fileTargets
    : executionDirectory != null
      ? [executionDirectory]
      : workingDirectories;
  const explicit =
    rawDirectories.length > 0 ||
    rawPaths.length > 0 ||
    evidence?.executionCwd != null ||
    evidence?.changedPaths != null;
  return {
    explicit,
    paths: [...new Set(paths.filter((value): value is string => value != null))],
  };
}

export async function resolveToolAttribution(
  input: unknown,
  evidence: ToolCallEvidence | undefined,
  sessionCwd: string | undefined,
  sessionGit: GitInfo | undefined,
): Promise<ToolAttribution> {
  const targets = toolPathTargets(input, evidence, sessionCwd);
  if (!targets.explicit) {
    const resolved = await resolveGitAttribution(sessionCwd);
    if (resolved) resolved.git = mergeGitInfo(resolved.git, sessionGit) ?? resolved.git;
    return { explicit: false, resolved };
  }
  if (targets.paths.length === 0) return { explicit: true };
  const resolved = await Promise.all(targets.paths.map(resolveGitAttribution));
  if (resolved.some((value) => value == null)) return { explicit: true };
  const first = resolved[0]!;
  if (
    resolved.some(
      (value) =>
        value!.root !== first.root ||
        value!.git.branch !== first.git.branch ||
        value!.git.commit_hash !== first.git.commit_hash ||
        value!.git.repository_url !== first.git.repository_url,
    )
  ) {
    return { explicit: true };
  }
  return { explicit: true, resolved: first };
}

export function toolRepositoryMetadata(
  attribution: ResolvedGitAttribution | undefined,
): Record<string, unknown> {
  const repo = parseRepository(attribution?.git.repository_url);
  const metadata = {
    repository_url: repo.repository_url,
    repository_provider: repo.repository_provider,
    repository_name: repo.repository_name,
    git_branch: attribution?.git.branch,
    git_commit_sha: attribution?.git.commit_hash,
    ls_attribution_identifier: attribution?.identifier,
  };
  return Object.fromEntries(REPOSITORY_METADATA_KEYS.map((key) => [key, metadata[key]]));
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
