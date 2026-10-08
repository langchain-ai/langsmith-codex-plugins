import type { GitInfo } from "./types.js";

/** The role a run plays within a coding-agent trace. */
export type LSAgentType = "root" | "subagent" | "middleware" | "compaction";

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
  attributionIdentifier?: string;
  /** Sandbox / runtime isolation provider. */
  sandboxType?: string;
}

export type ResolvedGitAttribution = {
  root: string;
  git: GitInfo;
  identifier?: string;
};

export type ToolPathTargets = {
  explicit: boolean;
  paths: string[];
};

export type ToolAttribution = {
  explicit: boolean;
  resolved?: ResolvedGitAttribution;
};
