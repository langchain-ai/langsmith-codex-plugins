export type TracingMode = "full" | "metadata";
export type TurnMode = TracingMode | "off";

export interface ThreadPolicy {
  preference?: TracingMode;
  turns: Record<string, TurnMode>;
  inherited?: TurnMode;
  lastActivityAt?: number;
  historyPruned?: boolean;
}
export interface TracingPolicy {
  version: 1;
  threads: Record<string, ThreadPolicy>;
}

export interface PruneSessionEvidenceOptions {
  inactiveBefore: number;
  currentSessionId: string;
  protectedSessionIds: string[];
  inactiveSessionIds: string[];
  excludedSessionIds?: string[];
  targetSessionIds?: string[];
}

export interface PrunedSessionEvidence {
  activeSessionIds: string[];
  prunedSessionIds: string[];
}

export type TracingPolicyUpdate = (policy: TracingPolicy) => void | Promise<void>;
