export const TRACING_POLICY_LOCK_SUFFIX = ".lock";
export const TRACING_POLICY_LOCK_TIMEOUT_MS = 2_000;
export const TRACING_POLICY_LOCK_TIMEOUT_ERROR = "Timed out waiting for tracing preference lock";
export const TRACING_POLICY_LOCK_TIMEOUT_MESSAGE =
  "Retry; if it persists, remove the lock only after confirming no preference writer is running.";
