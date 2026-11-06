import type { TRACING_COMMANDS } from "../constants.js";

export type TracingMode = "full" | "metadata";
export type TurnMode = TracingMode | "off";
export type TracingCommand = (typeof TRACING_COMMANDS)[number];

export interface ThreadPolicy {
  preference?: TracingMode;
  turns: Record<string, TurnMode>;
  inherited?: TurnMode;
}

export interface TracingPolicy {
  version: 1;
  threads: Record<string, ThreadPolicy>;
}

export interface PreferenceRequest {
  sessionId: string;
  turnId: string;
  enabled: boolean;
  command?: TracingCommand;
  defaultMuted?: boolean;
  mutedLocked?: boolean;
}

export type TurnModeRequest = Pick<PreferenceRequest, "enabled" | "defaultMuted" | "mutedLocked">;
