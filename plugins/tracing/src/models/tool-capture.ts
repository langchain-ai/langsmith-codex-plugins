import type { LineSchema } from "../types.js";
import type { TurnMode } from "./tracing-policy.js";

export interface TracingHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: "Stop" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse";
  cwd: string;
  prompt: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
}

export interface CapturedTool {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  input?: unknown;
  output?: unknown;
  mode: TurnMode;
}

export interface TurnCapture {
  events: LineSchema[];
  tools: CapturedTool[];
  stopped: boolean;
}

export type CaptureRedactor = <T>(data: T) => T;

export interface ReconciliationMetadata {
  root: Record<string, unknown>;
  tools: Record<string, Record<string, unknown>>;
}

export interface PromptSubmitInput {
  session_id: string;
  turn_id: string;
  cwd: string;
  prompt: string;
  transcript_path?: string;
}
