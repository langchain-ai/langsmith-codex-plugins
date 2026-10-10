import type { TurnMode } from "./tracing-policy.js";

export interface CapturedTool {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  input?: unknown;
  output?: unknown;
  mode: TurnMode;
}

export type CaptureRedactor = <T>(data: T) => T;
