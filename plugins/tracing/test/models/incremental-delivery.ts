export type TestRunRecord = Record<string, unknown> & {
  id: string;
  name: string;
  run_type: string;
  session_id: string;
};

export interface CapturedRequest {
  method: string;
  pathname: string;
  body?: Record<string, unknown>;
}

export interface LocalIncrementalServer {
  apiUrl: string;
  requests: CapturedRequest[];
  runs: Map<string, TestRunRecord>;
  projectId: string;
  failNextPost: boolean;
  failNextPatch: boolean;
  loseNextPatchAck: boolean;
  staleNextSuccessfulPatchReads: number;
  hideRunReads(runId: string, count: number): void;
  seedRun(run: Record<string, unknown>, projectName: string): TestRunRecord;
  close(): Promise<void>;
}
