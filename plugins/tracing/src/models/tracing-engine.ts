import type { CaptureStore } from "@langchain/plugins-base/storage/capture";
import type { TracingEngineSession } from "@langchain/plugins-base/tracing";
import type { LifecycleCaptureInput } from "@langchain/plugins-base/tracing/lifecycle";
import type { UploadDestination } from "@langchain/plugins-base/tracing/upload";
import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";
import type { RunTree } from "langsmith";
import type { TurnMode } from "./tracing-policy.js";

export interface CodexTracingEngineContext {
  accountFingerprint: string;
  captureStore: CaptureStore;
  destinations: readonly UploadDestination[];
  session: TracingEngineSession;
  sessionId: string;
  storageRoot: string;
}

export interface CodexRunCaptureContext {
  childRunIds: string[];
  closureState: "open" | "authoritative";
  metadata: CodingAgentMetadataOptions;
  mode: TurnMode;
  rolloutFile: string;
  rootRunId: string;
  turnId: string;
}

export type CodexRunCapture = (run: RunTree, context: CodexRunCaptureContext) => Promise<void>;

export type CodexLifecycleCapture = (input: LifecycleCaptureInput) => Promise<boolean>;
