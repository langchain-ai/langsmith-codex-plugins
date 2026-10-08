import type { ResolvedGitAttribution } from "../../src/metadata-models.js";

export interface CapturedTraceRequest {
  method: string;
  pathname: string;
  body?: Record<string, unknown>;
}

export type TraceServerRun = Record<string, unknown> & {
  id: string;
  name: string;
  run_type: string;
  session_id: string;
};

export interface LocalTraceServer {
  apiUrl: string;
  requests: CapturedTraceRequest[];
  runs: Map<string, TraceServerRun>;
  runAttempts: Map<string, TraceServerRun[]>;
  projectReads: string[];
  conflicts: string[];
  failPatchRunIds: Set<string>;
  setFailWrites(value: boolean): void;
  setDelayMs(value: number): void;
  close(): Promise<void>;
}

export interface LocalTraceServerOptions {
  defaultProjectName?: string;
  postStatus?: number;
  projectIdForName?: (projectName: string) => string;
}

export interface SyntheticTranscriptEvent {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
}

export type SyntheticGitAttribution = ResolvedGitAttribution;
