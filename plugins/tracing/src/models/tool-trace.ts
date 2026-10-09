import type { RunTree } from "langsmith";
import type { ReconciliationMetadata } from "./tool-capture.js";
import type { CapturedTool } from "./tool-capture.js";
import type { TurnMode } from "./tracing-policy.js";
import type { AggregateMessage, StandardMessage } from "../types.js";

export interface CapturedToolRunInput {
  reconciliation?: ReconciliationMetadata;
  tools: CapturedTool[];
  postedToolIds: Set<string>;
  messages: AggregateMessage<StandardMessage>[];
  parent: RunTree;
  base: Record<string, unknown>;
  mode: TurnMode;
  sessionId?: string;
  rolloutFile: string;
  turnKey: string;
}
