import type { Client, RunTree, RunTreeConfig } from "langsmith";
import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";
import type { Session, Task } from "./rollout.js";
import type { TracingMode } from "./tracing-policy.js";

export interface TraceConversionOptions {
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
}

export interface TraceInput {
  transcript_path: string;
  turn_id: string | null;
}

export interface TurnRequest {
  rolloutFile: string;
  options?: TraceConversionOptions;
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
}

export interface TurnRunContext extends TurnMetadata {
  childMetadataBase: Record<string, unknown>;
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
  "childMetadataBase" | "parent" | "postedSubagentThreads"
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
}

export interface TurnPosition {
  index: number;
  length: number;
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
