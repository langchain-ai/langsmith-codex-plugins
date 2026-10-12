export type ToolCallEvidence = {
  error: string | undefined;
  timings: number[];
  outputs: Record<string, unknown>;
  executionCwd?: string;
  changedPaths?: string[];
};
