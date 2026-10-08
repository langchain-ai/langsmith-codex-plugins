import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { nearestExistingDirectory } from "./utils/paths.js";
import { stripUndefined } from "./utils/objects.js";
import type { ResolvedGitAttribution } from "./metadata-models.js";
import type { GitInfo } from "./types.js";
import {
  GITHUB_CONFIG_DIRECTORY,
  GITHUB_CONFIG_ENV,
  GITHUB_HOST_ENTRY,
  GITHUB_HOSTS_FILE,
  GITHUB_HOST_NAME,
  GITHUB_USER_ENTRY,
  GIT_COMMAND_TIMEOUT_MS,
  GIT_LOCATION_ENV_KEYS,
} from "./metadata-constants.js";
import { sameRepository } from "./repository.js";

const execFileAsync = promisify(execFile);

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
