import { createCaptureStore } from "@langchain/plugins-base/storage/capture";
import { createTracingEngine, readSavedCaptureWake } from "@langchain/plugins-base/tracing";
import type {
  TracingEngineSessionCallbacks,
  TracingEngineBackgroundRecoveryOptions,
} from "@langchain/plugins-base/tracing";
import { createRunIdentity } from "@langchain/plugins-base/tracing/lifecycle";
import type {
  LifecycleCaptureInput,
  LifecycleSnapshotCaptureInput,
} from "@langchain/plugins-base/tracing/lifecycle";
import type {
  ReconstructionJob,
  ReconstructionJobInput,
  ReconstructionResult,
} from "@langchain/plugins-base/tracing/reconstruction";
import { createLangSmithUploadWriter } from "@langchain/plugins-base/tracing/upload";
import type {
  LangSmithUploadWriterOptions,
  NormalizedRunSnapshot,
  PreparedRunSubmission,
} from "@langchain/plugins-base/tracing/upload";
import type { CodingAgentMetadataOptions } from "@langchain/plugins-base/metadata";
import type { RunTree } from "langsmith";
import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { getConfig, type Config } from "./config.js";
import {
  ENGINE_STORAGE_DIRECTORY,
  ENGINE_WORKER_FLAG,
  LS_INTEGRATION,
  LS_INTEGRATION_VERSION,
  TOOL_RECONSTRUCTION_EVENT_SUFFIX,
  TOOL_SNAPSHOT_EVENT_SUFFIX,
  TOOL_START_EVENT_SUFFIX,
  TOOL_COMPLETE_EVENT_SUFFIX,
} from "./constants.js";
import { createCodexSessionCwdResolver } from "./session-discovery.js";
import type { CodexRunCaptureContext, CodexTracingEngineContext } from "./models/tracing-engine.js";
import type { TracingHookInput } from "./models/tracing-hook.js";
import type { CapturedTool, CaptureRedactor } from "./models/tool-capture.js";
import type { TurnMode } from "./tracing-policy.js";
import { defaultPrivacyPath, savedTurnMode } from "./tracing-policy.js";
import { stripUndefinedDeep } from "./utils/objects.js";
import { stableEventId, stableRunId, stableRunStartTime } from "./trace-delivery.js";
import { clearTurnCapture, recordToolHook } from "./tool-capture.js";
import { toSdkReplicas } from "@langchain/plugins-base/settings";

export function createCodexTracingSession(
  config: Config,
  sessionId: string,
  cwd: string,
  home = process.env.HOME ?? os.homedir(),
  launchWorker?: () => number | Promise<number>,
): CodexTracingEngineContext | undefined {
  const writer = writerOptions(config);
  if (!writer) return undefined;
  const storageRoot = path.join(home, ".codex", ENGINE_STORAGE_DIRECTORY);
  const writerInstance = createLangSmithUploadWriter(writer);
  const engine = createTracingEngine({ storageRoot, integration: LS_INTEGRATION, writer });
  const captureStore = createCaptureStore(storageRoot);
  const session = engine.forSession({
    sessionId,
    ...codexSessionCallbacks(sessionId, cwd, home, launchWorker),
    backgroundRecovery: codexBackgroundRecovery(home, writerInstance.accountFingerprint),
  });
  return {
    accountFingerprint: writerInstance.accountFingerprint,
    captureStore,
    destinations: writerInstance.destinations,
    session,
    sessionId,
    storageRoot,
  };
}

function codexBackgroundRecovery(
  home: string,
  accountFingerprint: string,
): TracingEngineBackgroundRecoveryOptions {
  const resolveCwd = createCodexSessionCwdResolver(home);
  return {
    optionsForSession: async (sessionId) => {
      const cwd = await resolveCwd(sessionId);
      if (!cwd) throw new Error("Original Codex session working directory is unavailable");
      const config = await getConfig({ home, cwd, env: process.env });
      if (!config.enabled) throw new Error("Original Codex session tracing is disabled");
      const writer = writerOptions(config);
      if (!writer) throw new Error("Original Codex session upload credentials are unavailable");
      if (createLangSmithUploadWriter(writer).accountFingerprint !== accountFingerprint) {
        throw new Error("Original Codex session account or project does not match");
      }
      return codexSessionCallbacks(sessionId, cwd, home);
    },
    onReport: (result) => {
      if (result.status === "failed") console.error(result.message);
      if (result.status !== "completed" && result.status !== "partial") return;
      for (const failure of result.report.failed) {
        console.error(`Codex session recovery failed for ${failure.sessionId}: ${failure.message}`);
      }
    },
  };
}

function codexSessionCallbacks(
  sessionId: string,
  cwd: string,
  home: string,
  launchWorker?: () => number | Promise<number>,
): TracingEngineSessionCallbacks {
  return {
    reconstruct: reconstructCodexTool,
    scheduleWake: launchWorker ?? (() => launchEngineWorker(sessionId, cwd)),
    resolveScope: async (expected) => {
      const current = await getConfig({ home, cwd, env: process.env });
      const currentWriter = writerOptions(current);
      return {
        ...expected,
        accountFingerprint: currentWriter
          ? createLangSmithUploadWriter(currentWriter).accountFingerprint
          : "unavailable",
      };
    },
  };
}

export async function captureCodexRun(
  context: CodexTracingEngineContext,
  run: RunTree,
  capture: CodexRunCaptureContext,
): Promise<void> {
  const snapshot = normalizedSnapshot(run.toJSON() as unknown as Record<string, unknown>);
  const submission: LifecycleSnapshotCaptureInput["submission"] = {
    operation: "post",
    integration: LS_INTEGRATION,
    privacyMode: capture.mode === "full" ? "full" : "metadata",
    metadata: stripUndefinedDeep(capture.metadata),
    privacyContext: { status: runStatus(run) },
    run: snapshot,
  };
  const eventId = stableEventId(run.id, "post");
  const input: LifecycleSnapshotCaptureInput = {
    turnId: capture.turnId,
    eventId,
    submission,
    turnEvidence: {
      rootRunId: capture.rootRunId,
      childRunIds: capture.childRunIds,
      closureState: capture.closureState,
    },
    ...(safeEpoch(run.start_time) === undefined
      ? {}
      : { sourceAgeStartedAtMs: safeEpoch(run.start_time) }),
    ...(parentDependency(run) === undefined ? {} : { dependencies: [parentDependency(run)!] }),
  };
  try {
    const result = await context.session.captureSnapshot(input);
    if (result.status !== "published" && result.status !== "duplicate") {
      throw new Error(`Shared trace capture failed: ${result.status}`);
    }
  } catch (error) {
    if (!(await isSavedCaptureWake(error, context, input, true))) throw error;
    console.error(`Shared trace capture was saved but its worker wake failed: ${error}`);
  }
}

export async function handleCodexToolHook(
  input: TracingHookInput,
  config: Config,
  redact?: CaptureRedactor,
  home = process.env.HOME ?? os.homedir(),
  launchWorker?: () => number | Promise<number>,
): Promise<void> {
  if (!config.enabled || !input.tool_use_id || !input.tool_name) return;
  const mode = savedTurnMode(defaultPrivacyPath(), input.session_id, input.turn_id);
  if (mode === "off") return;
  const context = createCodexTracingSession(
    config,
    input.session_id,
    input.cwd,
    home,
    launchWorker,
  );
  if (!context) return;
  const tool = await recordToolHook(input, mode, redact);
  if (!tool) return;
  const effectiveMode = tool.mode;
  const rootRunId = stableRunId(input.session_id, input.transcript_path, input.turn_id, "root");
  const toolRunId = stableRunId(
    input.session_id,
    input.transcript_path,
    input.turn_id,
    `tool:${input.tool_use_id}`,
  );
  const startEventId = `${toolRunId}${TOOL_START_EVENT_SUFFIX}`;
  const startScope = {
    integration: LS_INTEGRATION,
    sessionId: input.session_id,
    turnId: input.turn_id,
    eventId: startEventId,
  };
  const storedStart = await context.captureStore.read(startScope);
  if (storedStart && storedStart.destinationFingerprint !== context.accountFingerprint) return;
  if (!storedStart) {
    await captureToolStart(
      context,
      input,
      config,
      effectiveMode,
      tool,
      rootRunId,
      toolRunId,
      startEventId,
    );
  }
  if (input.hook_event_name !== "PostToolUse") return;
  await queueCodexToolCompletion(context, input, config, effectiveMode, tool, rootRunId, toolRunId);
}

export async function queueCodexToolCompletion(
  context: CodexTracingEngineContext,
  input: TracingHookInput,
  config: Config,
  mode: TurnMode,
  tool: CapturedTool,
  rootRunId: string,
  toolRunId: string,
): Promise<void> {
  const eventId = `${toolRunId}${TOOL_COMPLETE_EVENT_SUFFIX}`;
  const sourceRef = `${toolRunId}${TOOL_SNAPSHOT_EVENT_SUFFIX}`;
  const scope = {
    integration: LS_INTEGRATION,
    sessionId: input.session_id,
    turnId: input.turn_id,
    eventId,
  };
  const existing = await createCaptureStore(
    path.join(context.storageRoot, "reconstruction-v1"),
  ).read(scope);
  if (existing) {
    if (existing.destinationFingerprint !== context.accountFingerprint) return;
    try {
      await context.session.wake();
    } catch (error) {
      console.error(`Saved Codex tool ${tool.id} could not wake its worker: ${error}`);
    }
    return;
  }
  const rootTime = stableRunStartTime(input.turn_id, tool.startedAt);
  const parent = createRunIdentity({ id: rootRunId, start_time: rootTime });
  const identity = createRunIdentity({ id: toolRunId, start_time: tool.startedAt, parent });
  const metadata = toolMetadata(config, input, tool.name, mode);
  const submission: PreparedRunSubmission = {
    operation: "patch",
    integration: LS_INTEGRATION,
    privacyMode: mode === "full" ? "full" : "metadata",
    ...(mode === "full" ? { redactedFields: ["outputs"] as const } : {}),
    metadata,
    privacyContext: { status: "completed" },
    run: { ...identity, name: tool.name, run_type: "tool" },
    patch: {
      fields: ["outputs", "end_time"],
      values: {
        outputs: { output: tool.output ?? null },
        end_time: tool.endedAt ?? Date.now(),
      },
    },
  };
  const reconstruction: ReconstructionJobInput = {
    turnId: input.turn_id,
    eventId,
    sourceRefs: [sourceRef],
    privacyMode: mode === "full" ? "full" : "metadata",
    turnEvidence: { rootRunId, childRunIds: [toolRunId], closureState: "open" },
    sourceSnapshots: [{ sourceRef, sourceAgeStartedAtMs: tool.startedAt, submission }],
  };
  try {
    const result = await context.session.queueReconstruction(reconstruction);
    if (result.status !== "published" && result.status !== "duplicate") {
      throw new Error(`Could not save completed Codex tool ${tool.id}: ${result.status}`);
    }
  } catch (error) {
    if (!(await context.session.readSavedReconstructionWake(error, reconstruction))) throw error;
    console.error(`Completed Codex tool ${tool.id} was saved but its worker wake failed: ${error}`);
  }
}

export async function runCodexEngineWorker(sessionId: string, cwd: string): Promise<void> {
  const config = await getConfig({
    home: process.env.HOME ?? os.homedir(),
    cwd,
    env: process.env,
  });
  const context = createCodexTracingSession(config, sessionId, cwd);
  if (!context) throw new Error("Shared Codex trace worker configuration is unavailable");
  const result = await context.session.drain();
  if (result === "retry-exhausted" || result === "scope-mismatch") {
    throw new Error(`Shared Codex trace worker stopped with ${result}`);
  }
}

export async function clearCodexToolCapture(transcript: string, turnId: string): Promise<void> {
  await clearTurnCapture(transcript, turnId);
}

function writerOptions(config: Config): LangSmithUploadWriterOptions | undefined {
  if (!config.api_key?.trim() && !config.replicas?.length) return undefined;
  const replicas = toSdkReplicas(config.replicas);
  return {
    destinations: [
      {
        apiKey: config.api_key ?? "",
        apiUrl: config.api_url ?? "https://api.smith.langchain.com",
        projectName: config.project ?? "codex",
      },
    ],
    ...(replicas?.length ? { replicas } : {}),
    redact: config.redact,
    ...(config.redact_extra_rules === undefined
      ? {}
      : { redactExtraRules: config.redact_extra_rules }),
  };
}

async function reconstructCodexTool(job: ReconstructionJob): Promise<ReconstructionResult> {
  if (job.sourceRefs.length !== 1 || job.sourceSnapshots?.length !== 1) {
    throw new Error("Codex tool reconstruction needs one source snapshot");
  }
  const [sourceRef] = job.sourceRefs;
  const snapshot = job.sourceSnapshots[0]!;
  const submission = snapshot.submission;
  if (
    snapshot.sourceRef !== sourceRef ||
    submission.operation !== "patch" ||
    submission.integration !== LS_INTEGRATION ||
    submission.privacyMode !== job.privacyMode ||
    sourceRef !== `${submission.run.id}${TOOL_SNAPSHOT_EVENT_SUFFIX}` ||
    job.eventId !== `${submission.run.id}${TOOL_COMPLETE_EVENT_SUFFIX}` ||
    job.turnEvidence.rootRunId === undefined ||
    !job.turnEvidence.childRunIds.includes(submission.run.id)
  ) {
    throw new Error("Codex tool snapshot does not match its reconstruction job");
  }
  const dependencies = [
    {
      integration: LS_INTEGRATION,
      sessionId: job.sessionId,
      turnId: job.turnId,
      eventId: `${submission.run.id}${TOOL_START_EVENT_SUFFIX}`,
    },
  ];
  return {
    status: "ready",
    outputs: [{ eventId: job.eventId, sourceRef, submission, dependencies }],
  };
}

async function captureToolStart(
  context: CodexTracingEngineContext,
  input: TracingHookInput,
  config: Config,
  mode: TurnMode,
  tool: CapturedTool,
  rootRunId: string,
  toolRunId: string,
  eventId: string,
): Promise<void> {
  const rootTime = stableRunStartTime(input.turn_id, tool.startedAt);
  const parent = createRunIdentity({ id: rootRunId, start_time: rootTime });
  const identity = createRunIdentity({ id: toolRunId, start_time: tool.startedAt, parent });
  const submission: PreparedRunSubmission = {
    operation: "post",
    integration: LS_INTEGRATION,
    privacyMode: mode === "full" ? "full" : "metadata",
    ...(mode === "full" ? { redactedFields: ["inputs"] as const } : {}),
    metadata: toolMetadata(config, input, tool.name, mode),
    privacyContext: { status: "running" },
    run: {
      ...identity,
      name: tool.name,
      run_type: "tool",
      inputs: { input: tool.input ?? null },
    },
  };
  const capture: LifecycleCaptureInput = {
    turnId: input.turn_id,
    eventId,
    submission,
    turnEvidence: { rootRunId, childRunIds: [toolRunId], closureState: "open" },
    sourceAgeStartedAtMs: tool.startedAt,
  };
  try {
    const result = await context.session.capture(capture);
    if (result.status !== "published" && result.status !== "duplicate") {
      throw new Error(`Could not save Codex tool start ${tool.id}: ${result.status}`);
    }
  } catch (error) {
    if (!(await isSavedCaptureWake(error, context, capture))) throw error;
    console.error(`Codex tool start ${tool.id} was saved but its worker wake failed: ${error}`);
  }
}

function toolMetadata(
  config: Config,
  input: TracingHookInput,
  toolName: string,
  mode: TurnMode,
): CodingAgentMetadataOptions {
  return {
    integration: LS_INTEGRATION,
    integrationVersion: LS_INTEGRATION_VERSION,
    threadId: input.session_id,
    turnId: input.turn_id,
    agentType: "root",
    runType: "tool",
    toolName,
    runName: toolName,
    ...(mode === "full" && config.metadata ? { base: config.metadata } : {}),
  };
}

function parentDependency(run: RunTree) {
  const parent = run.parent_run;
  if (!parent) return undefined;
  const metadata = parent.extra?.metadata as Record<string, unknown> | undefined;
  const sessionId = metadata?.thread_id;
  const turnId = metadata?.turn_id;
  if (typeof sessionId !== "string" || typeof turnId !== "string") return undefined;
  return {
    integration: LS_INTEGRATION,
    sessionId,
    turnId,
    eventId: stableEventId(parent.id, "post"),
  };
}

function normalizedSnapshot(payload: Record<string, unknown>): NormalizedRunSnapshot {
  if (
    typeof payload.id !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.run_type !== "string"
  ) {
    throw new Error("Codex run identity is unavailable");
  }
  return {
    id: payload.id,
    name: payload.name,
    run_type: payload.run_type,
    inputs: isRecord(payload.inputs) ? payload.inputs : {},
    ...(isTimestamp(payload.start_time) ? { start_time: payload.start_time } : {}),
    ...(isTimestamp(payload.end_time) ? { end_time: payload.end_time } : {}),
    ...(isRecord(payload.outputs) ? { outputs: payload.outputs } : {}),
    ...(typeof payload.parent_run_id === "string" ? { parent_run_id: payload.parent_run_id } : {}),
    ...(typeof payload.trace_id === "string" ? { trace_id: payload.trace_id } : {}),
    ...(typeof payload.dotted_order === "string" ? { dotted_order: payload.dotted_order } : {}),
    ...(Array.isArray(payload.tags) ? { tags: payload.tags as string[] } : {}),
    ...(typeof payload.error === "string" ? { error: payload.error } : {}),
    ...(isRecord(payload.serialized) ? { serialized: payload.serialized } : {}),
    ...(Array.isArray(payload.events) ? { events: payload.events as RunTree["events"] } : {}),
    ...(typeof payload.reference_example_id === "string"
      ? { reference_example_id: payload.reference_example_id }
      : {}),
  };
}

function runStatus(run: RunTree): "running" | "completed" | "error" {
  if (run.error != null) return "error";
  return run.end_time == null ? "running" : "completed";
}

function safeEpoch(value: number | string | undefined): number | undefined {
  const timestamp =
    typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : undefined;
}

async function isSavedCaptureWake(
  error: unknown,
  context: CodexTracingEngineContext,
  input: LifecycleCaptureInput,
  allowSnapshotRevision = false,
): Promise<boolean> {
  return (
    (await readSavedCaptureWake(error, {
      store: context.captureStore,
      integration: LS_INTEGRATION,
      sessionId: context.sessionId,
      turnId: input.turnId,
      destinationFingerprint: context.accountFingerprint,
      runId: input.submission.run.id,
      ...(allowSnapshotRevision ? {} : { eventId: input.eventId }),
    })) !== undefined
  );
}

function launchEngineWorker(sessionId: string, cwd: string): number {
  const entry = process.argv[1];
  const isNodeScript = typeof entry === "string" && /\.(?:mjs|cjs|js)$/i.test(entry);
  const args = [...(isNodeScript ? [entry] : []), ENGINE_WORKER_FLAG, sessionId, cwd];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  if (!child.pid) throw new Error("Shared Codex trace worker failed to start");
  return child.pid;
}

function isTimestamp(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
