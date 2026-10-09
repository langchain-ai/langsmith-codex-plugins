import type { SyntheticGitAttribution } from "../models/incremental-trace.js";

export const TRACE_WRITE_METHODS = ["POST", "PATCH"] as const;

export const INCREMENTAL_TRACE_TEST = {
  apiKey: "local-test-key",
  sessionId: "lifecycle-session",
  turnId: "lifecycle-turn",
  toolId: "lifecycle-tool",
  projectName: "incremental-lifecycle-test",
  rootCwd: "/synthetic/workspace",
  toolCwd: "/synthetic/repo-b",
  requestSecret: "PRIVATE_USER_INPUT_781",
  toolInputSecret: "PRIVATE_TOOL_INPUT_624",
  toolOutputSecret: "PRIVATE_TOOL_OUTPUT_319",
  unrelatedMetadata: "preserve-this-value",
  repoAUrl: "https://gitlab.com/example/repo-a",
  repoBUrl: "https://github.com/example/repo-b",
  branchA: "retry-branch-a",
  branchB: "tool-branch-b",
} as const;

export const SYNTHETIC_REPOSITORY_A: SyntheticGitAttribution = {
  root: "/synthetic/repo-a",
  git: {
    repository_url: `${INCREMENTAL_TRACE_TEST.repoAUrl}.git`,
    branch: INCREMENTAL_TRACE_TEST.branchA,
    commit_hash: "a".repeat(40),
  },
};

export const SYNTHETIC_REPOSITORY_B: SyntheticGitAttribution = {
  root: INCREMENTAL_TRACE_TEST.toolCwd,
  git: {
    repository_url: `${INCREMENTAL_TRACE_TEST.repoBUrl}.git`,
    branch: INCREMENTAL_TRACE_TEST.branchB,
    commit_hash: "b".repeat(40),
  },
  identifier: "synthetic-repo-b-author",
};
