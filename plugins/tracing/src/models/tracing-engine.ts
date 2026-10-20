import type { PluginSessionOptions } from "@langchain/plugins-base/plugin";
import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";
import type { ReconstructionOutput } from "@langchain/plugins-base/tracing/reconstruction";
import type { RunTree } from "langsmith";
import type { ParentHeaders } from "./config.js";
import type { CodexHookInput } from "./hook-input.js";
import type { TracingMode } from "./tracing-policy.js";

export type CodexRunStatus = "running" | "completed" | "error";

export interface CodexReconstructedRun {
  metadata: CodingAgentMetadataOptions;
  mode: TracingMode;
  run: RunTree;
}

export interface CodexReconstruction {
  status: "ready";
  outputs: readonly ReconstructionOutput[];
}

export interface CodexJobContext {
  cwd: string;
  project: string | undefined;
  metadata: Record<string, unknown> | undefined;
  parent_headers: ParentHeaders | undefined;
}

export interface CodexJobState {
  updated: string;
  queued_jobs: Record<string, CodexJobContext>;
}

export interface LiveToolRuns {
  root: CodexReconstructedRun;
  tool: CodexReconstructedRun;
}

export type LiveToolRequest = Required<
  Pick<CodexHookInput, "session_id" | "turn_id" | "transcript_path" | "tool_use_id">
>;

export interface CodexTurnRequest {
  transcriptPath: string;
  turnId: string;
  cwd: string;
}

export type CodexRecoveryResult = Parameters<
  NonNullable<PluginSessionOptions["onRecoveryReport"]>
>[0];
