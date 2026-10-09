import { z } from "zod";
import {
  INCREMENTAL_DELIVERY_DIGEST_PATTERN,
  INCREMENTAL_RECOVERY_METADATA_KEYS,
} from "../constants/incremental-delivery.js";
import { REPOSITORY_METADATA_KEYS } from "../metadata-constants.js";
import type { Client } from "langsmith";

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

export const IncrementalRunTopologySchema = z.strictObject({
  parentRunId: z.string().nullable(),
  traceId: z.string().optional(),
  dottedOrder: z.string().optional(),
  startTime: z.union([z.number(), z.string()]),
  name: z.string(),
  runType: z.string(),
});

export const IncrementalDeliveryIdentitySchema = z.strictObject({
  endpoint: z.string(),
  projectName: z.string(),
  runId: z.string(),
  workspaceId: z.string().optional(),
  credentialHash: z.string().regex(INCREMENTAL_DELIVERY_DIGEST_PATTERN).optional(),
});

export const IncrementalDeliveryCheckpointSchema = IncrementalDeliveryIdentitySchema.extend({
  topology: IncrementalRunTopologySchema,
  createAttempted: z.literal(true),
  deliveredDigest: z.string().regex(INCREMENTAL_DELIVERY_DIGEST_PATTERN).optional(),
  finalized: z.literal(true).optional(),
  recovery: z
    .strictObject({
      redactionPolicy: z.string().regex(INCREMENTAL_DELIVERY_DIGEST_PATTERN).optional(),
      sessionId: z.string().optional(),
      turnKey: z.string(),
      metadata: z.partialRecord(
        z.enum([...INCREMENTAL_RECOVERY_METADATA_KEYS, ...REPOSITORY_METADATA_KEYS]),
        z.string(),
      ),
      endTime: z
        .union([z.number(), z.string()])
        .refine((value) => Number.isFinite(new Date(value).getTime()))
        .optional(),
    })
    .optional(),
});

export type IncrementalRunTopology = z.infer<typeof IncrementalRunTopologySchema>;
export type IncrementalDeliveryIdentity = z.infer<typeof IncrementalDeliveryIdentitySchema>;
export type IncrementalDeliveryCheckpoint = z.infer<typeof IncrementalDeliveryCheckpointSchema>;

export interface IncrementalDeliveryStoreHandle {
  load(): Promise<IncrementalDeliveryCheckpoint | undefined>;
  save(checkpoint: IncrementalDeliveryCheckpoint): Promise<void>;
}
