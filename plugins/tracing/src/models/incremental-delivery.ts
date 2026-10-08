import type { Client, Run } from "langsmith";

export type IncrementalRunUpdate = Parameters<Client["updateRun"]>[1];

export type IncrementalRunCreate = Parameters<Client["createRun"]>[0];
export type IncrementalCreateOptions = Parameters<Client["createRun"]>[1];

export interface RuntimeClientConfig {
  apiUrl?: string;
  apiKey?: string;
  workspaceId?: string;
  headers?: Record<string, string>;
  fetchOptions?: RequestInit;
  fetchImplementation?: typeof fetch;
}

export interface IncrementalRunTopology {
  parentRunId: string | null;
  traceId?: string;
  dottedOrder?: string;
  startTime: number | string;
  name: string;
  runType: string;
}

export interface IncrementalDeliveryIdentity {
  endpoint: string;
  projectName: string;
  runId: string;
  workspaceId?: string;
  credentialHash?: string;
}

export interface IncrementalDeliveryCheckpoint extends IncrementalDeliveryIdentity {
  topology: IncrementalRunTopology;
  createAttempted: true;
  deliveredDigest?: string;
  finalized?: true;
  recovery?: IncrementalRecovery;
}

export interface IncrementalDeliveryStoreHandle {
  load(): Promise<IncrementalDeliveryCheckpoint | undefined>;
  save(checkpoint: IncrementalDeliveryCheckpoint): Promise<void>;
}

export interface VerifiedIncrementalRun {
  existing: Run;
  projectId: string;
}

export interface IncrementalRecovery {
  redactionPolicy?: string;
  turnKey: string;
  metadata: Record<string, unknown>;
  endTime?: number | string;
}
