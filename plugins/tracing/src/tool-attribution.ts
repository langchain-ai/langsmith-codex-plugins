import { absoluteTarget } from "./utils/paths.js";
import { isRecord } from "./utils/objects.js";
import type { ToolAttribution, ToolPathTargets } from "./metadata-models.js";
import type { GitInfo, ToolCallEvidence } from "./types.js";
import { TOOL_PATH_KEYS, TOOL_WORKING_DIRECTORY_KEYS } from "./metadata-constants.js";
import { mergeGitInfo, resolveGitAttribution } from "./git.js";

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
