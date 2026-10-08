import type { Client, RunTree, RunTreeConfig } from "langsmith";
import type { TurnMode } from "../tracing-policy.js";

export type TurnDeliveryState = "uploaded" | "backlog" | "off";

export interface TurnRunTopology {
  parentRunId: string | null;
  traceId: string;
  dottedOrder: string;
  executionOrder: number;
  childExecutionOrder: number;
}

export interface RolloutLockOwner {
  pid: number;
  token: string;
}

export interface RolloutTurnMode {
  mode: TurnMode;
  hasEvidence: boolean;
}

export interface TraceConversionOptions {
  parentRunTree?: RunTree;
  client?: Client;
  metadata?: Record<string, unknown>;
  replicas?: RunTreeConfig["replicas"];
  projectName?: string;
  sessionsRoot?: string;
  privacyPath?: string;
  debugNow?: { now: number; startTime: number };
  /**
   * Post every turn the rollout holds, not just the one this hook fired for.
   * Subagent rollouts are walked whole by design; the live Stop hook is not.
   */
  replayHistory?: boolean;
  visitedThreads?: Set<string>;
}

export interface TraceConversionInput {
  transcript_path: string;
  turn_id: string | null;
}

export interface PostTurnOptions {
  rolloutFile: string;
  options?: TraceConversionOptions;
  mode: TurnMode;
  turnKey: string;
  fallbackTime: number;
}
