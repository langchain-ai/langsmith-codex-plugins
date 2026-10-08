import type { RepositoryIdentity, RepositoryMetadata } from "./metadata-models.js";
import { GIT_SCP_REMOTE, GIT_SUFFIX } from "./metadata-constants.js";

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
