import { z } from "zod";
import {
  TRACE_UPLOAD_RUN_ID_MAX_LENGTH,
  TRACE_UPLOAD_DOTTED_ORDER_MAX_LENGTH,
} from "../constants.js";
import type { Client, RunTree, RunTreeConfig } from "langsmith";
import type { TurnMode } from "./tracing-policy.js";
import type { TRACE_UPLOAD_STATES } from "../constants.js";

export type TurnDeliveryState = (typeof TRACE_UPLOAD_STATES)[number];

export const TurnRunTopologySchema = z.looseObject({
  parentRunId: z.string().max(TRACE_UPLOAD_RUN_ID_MAX_LENGTH).nullable(),
  traceId: z.string().max(TRACE_UPLOAD_RUN_ID_MAX_LENGTH),
  dottedOrder: z.string().max(TRACE_UPLOAD_DOTTED_ORDER_MAX_LENGTH),
  executionOrder: z.number().positive().refine(Number.isInteger),
  childExecutionOrder: z.number().positive().refine(Number.isInteger),
});

export type TurnRunTopology = z.infer<typeof TurnRunTopologySchema>;

export interface RolloutTurnMode {
  mode: TurnMode;
  hasEvidence: boolean;
}

export interface TraceConversionOptions {
  incremental?: boolean;
  partial?: boolean;
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
