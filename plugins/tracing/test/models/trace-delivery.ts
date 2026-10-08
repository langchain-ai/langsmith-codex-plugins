export interface RolloutEventsOptions {
  started?: boolean;
  turnId?: string;
  threadId?: string;
  parentThreadId?: string;
  childThreadId?: string;
}

export interface TraceRunExtra {
  metadata?: Record<string, unknown>;
}
