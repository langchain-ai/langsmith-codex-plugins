import type { Client, RunTree, RunTreeConfig } from "langsmith";
import type { RepositoryAttributor } from "@langchain/plugins-base/git";
import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";
import type { ParentHeaders } from "./config.js";
import type { Session, Task, TokenCount } from "./rollout.js";
import type { TracingMode, TurnMode } from "./tracing-policy.js";

export type ToolRunIdGenerator = (callId: string) => string;

export interface TraceConversionOptions {
  captureRun: (
    run: RunTree,
    mode: TracingMode,
    metadata: CodingAgentMetadataOptions,
  ) => void | Promise<void>;
  nextRunId: () => string;
  toolRunId?: ToolRunIdGenerator;
  parentRunTree?: RunTree;
  client?: Client;
  metadata?: Record<string, unknown>;
  replicas?: RunTreeConfig["replicas"];
  projectName?: string;
  /**
   * Post every turn the rollout holds, not just the one this hook fired for.
   * Subagent rollouts are walked whole by design; the live Stop hook is not.
   */
  replayHistory?: boolean;
  privacyMode?: TurnMode;
  attributor?: RepositoryAttributor;
}

export interface TraceInput {
  transcript_path: string;
  turn_id: string | null;
  includeOpenTurn?: boolean;
}

export interface TurnRequest {
  rolloutFile: string;
  options: TraceConversionOptions;
}

export type MetadataContext = Pick<
  CodingAgentMetadataOptions,
  | "integration"
  | "integrationVersion"
  | "runtimeVersion"
  | "threadId"
  | "turnId"
  | "turnNumber"
  | "agentType"
>;

export interface TurnMetadata {
  metadataContext: MetadataContext;
  metadataBase: Record<string, unknown>;
  isSubagent: boolean;
  approvalPolicy: string | undefined;
  cwd: string | undefined;
}

export interface TurnRunContext extends TurnMetadata {
  childMetadataBase: Record<string, unknown>;
  unattributedChildBase: Record<string, unknown>;
  task: Task;
  sessionMeta: Session | undefined;
  request: TurnRequest;
  mode: TracingMode;
  parent: RunTree;
  parentStartTime: number;
  postedSubagentThreads: Set<string>;
}

export type TurnDraft = Omit<
  TurnRunContext,
  "childMetadataBase" | "unattributedChildBase" | "parent" | "postedSubagentThreads"
>;

export interface ModelSpan {
  start: number;
  length: number;
}

export interface RolloutWalk {
  sessionMeta: Session | undefined;
  task: Task | undefined;
  turnNumber: number;
  spawnAgentMessages: Map<string, { subagentThreads: string[] }>;
  sessionTokenTotal: TokenCount | undefined;
}

export interface TimeWindow {
  min: number;
  max: number;
}

export interface CompletedTurn {
  task: Task;
  sessionMeta: Session | undefined;
  privacyTurnId: string | undefined;
  completedTurnId: string | undefined;
}

export interface NoteDetails {
  turnId?: string;
  toolUseId?: string;
  metadata?: Record<string, unknown>;
  parentHeaders?: ParentHeaders;
}

export type SavedWalk = Omit<RolloutWalk, "spawnAgentMessages">;

export interface HeldTurn {
  turn: CompletedTurn;
  end: number;
}

export interface BuilderState {
  version: number;
  walk?: SavedWalk;
  transcriptPath?: string;
  lastLineTime?: number;
  noteSeen: boolean;
  heldTurn?: HeldTurn;
  stopClosedTurn?: boolean;
  currentTurnId?: string;
  firstNoteTurnId?: string;
  turnModes: Record<string, TurnMode>;
  lastPostedTurn?: string;
  liveRoots: string[];
  liveTools: string[];
  waitingTools: string[];
  metadata?: Record<string, unknown>;
  parentHeaders?: ParentHeaders;
}
