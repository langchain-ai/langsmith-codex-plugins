export type TracingMode = "full" | "metadata";
export type TurnMode = TracingMode | "off";

export interface ThreadPolicy {
  preference?: TracingMode;
  turns: Record<string, TurnMode>;
  inherited?: TurnMode;
}

export interface TracingPolicy {
  version: 1;
  threads: Record<string, ThreadPolicy>;
}

export type TracingPolicyUpdater = (policy: TracingPolicy) => void;

export interface TracingPolicyUpdateResult {
  warning?: string;
}
