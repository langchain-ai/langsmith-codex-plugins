// Shared coding-agent-v1 trace-metadata contract for the Codex plugin.
// Spec: Coding-Agent Trace Metadata Standard (coding-agent-v1) / LSEN-277.

import type { CodingAgentContext, ResolvedGitAttribution } from "./metadata-models.js";
import {
  LS_AGENT_PURPOSE,
  LS_AGENT_RUNTIME,
  LS_INTEGRATION,
  LS_INTEGRATION_VERSION,
  LS_TRACE_SCHEMA_VERSION,
} from "./constants.js";
import { REPOSITORY_METADATA_KEYS } from "./metadata-constants.js";
import { parseRepository, sameRepository } from "./repository.js";
import { stripUndefined } from "./utils/objects.js";

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
