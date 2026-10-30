import { RunTree, type Client } from "langsmith";
import {
  loginCommand,
  loginReplicaRefusal,
  resolveUploadCredential,
  sdkSetting,
  type UploadCredential,
} from "@langchain/plugins-base/auth";
import { createRepositoryAttributor, type RepositoryAttributor } from "@langchain/plugins-base/git";
import { launchDetachedWorker, openPluginSession } from "@langchain/plugins-base/plugin";
import type { PluginSession } from "@langchain/plugins-base/plugin";
import { toSdkReplicas } from "@langchain/plugins-base/settings";
import type { StoredCapture } from "@langchain/plugins-base/storage/capture";
import type { LifecycleCaptureInput } from "@langchain/plugins-base/tracing/lifecycle";
import type {
  ReconstructionJob,
  ReconstructionOutput,
} from "@langchain/plugins-base/tracing/reconstruction";
import type { LangSmithUploadWriterOptions } from "@langchain/plugins-base/tracing/upload";
import * as path from "node:path";
import type { Config } from "./models/config.js";
import { getConfig } from "./config.js";
import {
  CAPTURE_SAVED_STATUSES,
  CODEX_CONFIG_DIRECTORY,
  DEFAULT_LANGSMITH_API_URL,
  DEFAULT_LANGSMITH_PROJECT_NAME,
  DROPPED_LOGIN_WORK_WARNING_PREFIX,
  DROPPED_LOGIN_WORK_WARNING_SUFFIX,
  DROPPED_WORK_WARNING,
  ENGINE_STORAGE_DIRECTORY,
  ENGINE_WORKER_FLAG,
  GITHUB_LOGIN_MARKER_FILE_NAME,
  LIVE_RUN_EVENT_PREFIX,
  OPEN_CLOSURE,
  PARENT_PROJECT_PROBE,
  SUBAGENT_AGENT_TYPE,
  LIVE_RUN_NOT_SAVED_MESSAGE,
  LS_INTEGRATION,
  TRACE_RUN_EVENT_PREFIX,
  TRACE_RUN_PATCH_EVENT_PREFIX,
} from "./constants.js";
import { readJobContext, removeJobContext } from "./job-context.js";
import type { TraceConversionOptions } from "./models/trace-conversion.js";
import type {
  CodexReconstructedRun,
  CodexReconstruction,
  CodexRecoveryResult,
  LiveToolRequest,
  LiveToolRuns,
  ParentDestination,
} from "./models/tracing-engine.js";
import type { TracingMode } from "./models/tracing-policy.js";
import { pruneHookFirings } from "./sidecar.js";
import { convertToRunTree } from "./trace.js";
import { transcriptPathFromRef } from "./tracing-engine-locator.js";
import {
  closingRootSubmission,
  createRunClient,
  openRootSubmission,
  postSubmission,
  runIdGenerator,
  toolRunIdGenerator,
} from "./tracing-engine-payload.js";
import { recordWarning } from "./warnings.js";
import { homeDirectory } from "./utils/home.js";

export function engineStorageRoot(home: string): string {
  return path.join(home, CODEX_CONFIG_DIRECTORY, ENGINE_STORAGE_DIRECTORY);
}

export function createCodexTracingSession(
  config: Config,
  sessionId: string,
  cwd: string,
  home = homeDirectory(),
): PluginSession | undefined {
  const storageRoot = engineStorageRoot(home);
  const writer = writerOptions(config, storageRoot);
  if (!writer) return undefined;
  const plugin: PluginSession = openPluginSession({
    storageRoot,
    integration: LS_INTEGRATION,
    sessionId,
    writer,
    currentWriter: async () =>
      writerOptions(await getConfig({ home, cwd, env: process.env }), storageRoot),
    reconstruct: (job) => reconstructTranscript(job, config, home, plugin),
    scheduleWake: (wakeSessionId) =>
      launchDetachedWorker([ENGINE_WORKER_FLAG, wakeSessionId, cwd], { storageRoot }),
    onRecoveryReport: reportRecovery,
  });
  return plugin;
}

let attributor: RepositoryAttributor | undefined;

export async function buildLiveToolRuns(
  config: Config,
  request: LiveToolRequest,
  mode: TracingMode,
  home = homeDirectory(),
): Promise<LiveToolRuns | undefined> {
  const runs: CodexReconstructedRun[] = [];
  const toolRunId = toolRunIdGenerator(request.session_id, request.turn_id)(request.tool_use_id);
  await convertToRunTree(
    { transcript_path: request.transcript_path, turn_id: request.turn_id, includeOpenTurn: true },
    conversionOptions(config, request.session_id, request.turn_id, mode, runs, home),
  );
  const [root] = runs;
  const tool = runs.find(({ run }) => run.id === toolRunId);
  if (root === undefined || tool === undefined || root.metadata.agentType === SUBAGENT_AGENT_TYPE) {
    return undefined;
  }
  return { root, tool };
}

export async function saveLiveToolRuns(
  plugin: PluginSession,
  turnId: string,
  { root, tool }: LiveToolRuns,
): Promise<void> {
  const rootEventId = `${LIVE_RUN_EVENT_PREFIX}${root.run.id}`;
  if (!(await savedLiveRun(plugin, turnId, root.run.id))) {
    await saveLiveRun(plugin, {
      turnId,
      eventId: rootEventId,
      submission: openRootSubmission(root.run, root.mode, root.metadata),
      turnEvidence: { rootRunId: root.run.id, childRunIds: [], closureState: OPEN_CLOSURE },
    });
  }
  await saveLiveRun(plugin, {
    turnId,
    eventId: `${LIVE_RUN_EVENT_PREFIX}${tool.run.id}`,
    submission: postSubmission(tool.run, tool.mode, tool.metadata),
    turnEvidence: { childRunIds: [tool.run.id], closureState: OPEN_CLOSURE },
    dependencies: [
      { integration: LS_INTEGRATION, sessionId: plugin.sessionId, turnId, eventId: rootEventId },
    ],
  });
}

async function saveLiveRun(plugin: PluginSession, input: LifecycleCaptureInput): Promise<void> {
  const result = await plugin.session.capture(input);
  if (!CAPTURE_SAVED_STATUSES.includes(result.status)) {
    console.error(`${LIVE_RUN_NOT_SAVED_MESSAGE} ${result.status}`);
  }
}

export async function hasUnclosedLiveRoot(plugin: PluginSession, turnId: string): Promise<boolean> {
  const rootRunId = runIdGenerator(plugin.sessionId, turnId)();
  return (
    (await savedLiveRun(plugin, turnId, rootRunId)) !== undefined &&
    (await savedLiveRun(plugin, turnId, rootRunId, TRACE_RUN_PATCH_EVENT_PREFIX)) === undefined
  );
}

function savedLiveRun(
  plugin: PluginSession,
  turnId: string,
  runId: string,
  prefix = LIVE_RUN_EVENT_PREFIX,
): Promise<StoredCapture | undefined> {
  const { sessionId } = plugin;
  return plugin.store.read({
    integration: LS_INTEGRATION,
    sessionId,
    turnId,
    eventId: `${prefix}${runId}`,
  });
}

function conversionOptions(
  config: Config,
  sessionId: string,
  turnId: string,
  privacyMode: TracingMode,
  runs: CodexReconstructedRun[],
  home: string,
): TraceConversionOptions {
  const client = createRunClient(config, uploadCredential(config));
  attributor ??= createRepositoryAttributor({
    githubLoginMarkerPath: path.join(home, CODEX_CONFIG_DIRECTORY, GITHUB_LOGIN_MARKER_FILE_NAME),
  });
  return {
    client,
    projectName: config.project,
    metadata: config.metadata,
    replicas: toSdkReplicas(config.replicas),
    parentRunTree: parentRunTreeFor(config, client),
    captureRun: async (run, mode, metadata) => {
      runs.push({ metadata, run, mode });
    },
    nextRunId: runIdGenerator(sessionId, turnId),
    toolRunId: toolRunIdGenerator(sessionId, turnId),
    privacyMode,
    attributor,
    captureHookOutputs: config.capture_hook_outputs,
  };
}

function reportRecovery(result: CodexRecoveryResult): void {
  if (result.status === "completed") return;
  console.error(`Shared Codex trace recovery did not finish: ${JSON.stringify(result)}`);
}

export async function runCodexEngineWorker(sessionId: string, cwd: string): Promise<void> {
  const home = homeDirectory();
  const config = await getConfig({ home, cwd, env: process.env });
  if (config.capture_hook_outputs) await pruneHookFirings();
  const session = createCodexTracingSession(config, sessionId, cwd, home);
  if (!session) throw new Error("Shared Codex trace worker configuration is unavailable");
  const result = await session.session.drain();
  if (result === "retry-exhausted" || result === "dropped" || result === "scope-mismatch") {
    const credential = uploadCredential(config);
    const warning =
      credential.kind === "login"
        ? `${DROPPED_LOGIN_WORK_WARNING_PREFIX}${loginCommand(credential.login.profile)}${DROPPED_LOGIN_WORK_WARNING_SUFFIX}`
        : DROPPED_WORK_WARNING;
    if (result !== "scope-mismatch") await recordWarning(home, warning);
    throw new Error(`Shared Codex trace worker stopped with ${result}`);
  }
  if (result === "deferred" || result === "busy") {
    console.error(`Shared Codex trace worker left saved work for a later run: ${result}`);
  }
}

async function reconstructTranscript(
  job: ReconstructionJob,
  workerConfig: Config,
  home: string,
  plugin: PluginSession,
): Promise<CodexReconstruction> {
  const [transcriptRef, contextRef, ...extra] = job.sourceRefs;
  if (transcriptRef === undefined || contextRef === undefined || extra.length > 0) {
    throw new Error("Codex reconstruction needs a transcript and a context locator");
  }
  const transcriptPath = transcriptPathFromRef(transcriptRef);
  const context = readJobContext(home, job.sessionId, contextRef);
  if (!context) {
    console.error("Codex reconstruction context is missing; using the current settings");
  }
  const config: Config = context
    ? {
        ...(await getConfig({ home, cwd: context.cwd, env: process.env })),
        project: context.project,
        metadata: context.metadata,
        parent_headers: context.parent_headers,
      }
    : workerConfig;
  const runs: CodexReconstructedRun[] = [];
  await convertToRunTree(
    { transcript_path: transcriptPath, turn_id: job.turnId, session_id: job.sessionId },
    conversionOptions(config, job.sessionId, job.turnId, job.privacyMode, runs, home),
  );
  const [root, ...children] = runs;
  if (root === undefined) throw new Error("Codex transcript has no completed target turn");
  const turnEvidence = {
    rootRunId: root.run.id,
    childRunIds: children.map(({ run: child }) => child.id),
    closureState: "authoritative" as const,
  };
  const outputs: ReconstructionOutput[] = [];
  for (const { metadata, mode, run } of runs) {
    const submission = postSubmission(run, mode, metadata);
    const saved = await savedLiveRun(plugin, job.turnId, run.id);
    if (saved === undefined) {
      outputs.push({
        eventId: `${TRACE_RUN_EVENT_PREFIX}${run.id}`,
        sourceRef: transcriptRef,
        turnEvidence,
        submission,
      });
    } else if (run === root.run) {
      const { integration, sessionId, turnId, eventId } = saved;
      outputs.push({
        eventId: `${TRACE_RUN_PATCH_EVENT_PREFIX}${run.id}`,
        sourceRef: transcriptRef,
        turnEvidence: { ...turnEvidence, childRunIds: [] },
        submission: closingRootSubmission(submission),
        dependencies: [{ integration, sessionId, turnId, eventId }],
      });
    }
  }
  await removeJobContext(home, job.sessionId, contextRef);
  return { status: "ready", outputs };
}

function parentDestination(config: Config): ParentDestination {
  if (!config.parent_headers) return {};
  const parent = RunTree.fromHeaders(config.parent_headers, {
    project_name: PARENT_PROJECT_PROBE,
  });
  const agentId = parent?.address?.id;
  if (agentId !== undefined) return { agentId };
  const projectName = parent?.project_name;
  return projectName === undefined || projectName === PARENT_PROJECT_PROBE ? {} : { projectName };
}

function parentRunTreeFor(config: Config, client?: Client): RunTree | undefined {
  return config.parent_headers
    ? RunTree.fromHeaders(config.parent_headers, { client, project_name: config.project })
    : undefined;
}

export function uploadCredential(config: Config): UploadCredential {
  return resolveUploadCredential({
    apiKey: config.api_key,
    apiUrl: config.api_url,
    profile: config.profile,
    workspaceId: config.workspace_id,
    agentId: config.agent_id,
  });
}

function writerOptions(
  config: Config,
  storageRoot: string,
): LangSmithUploadWriterOptions | undefined {
  if (config.managedConfigProblem !== undefined) return undefined;
  if (config.api_key !== undefined && sdkSetting(config.api_key) === undefined) return undefined;
  const credential = uploadCredential(config);
  const keyedReplica = config.replicas?.some((replica) => sdkSetting(replica.api_key));
  if (credential.kind === "none" && !keyedReplica) return undefined;
  const refusal =
    credential.kind === "login"
      ? loginReplicaRefusal(toSdkReplicas(config.replicas), credential.apiUrl)
      : undefined;
  if (refusal !== undefined) return undefined;
  const { kind, ...auth } =
    credential.kind === "none"
      ? { kind: credential.kind, apiKey: "", apiUrl: config.api_url ?? DEFAULT_LANGSMITH_API_URL }
      : credential.kind === "api-key"
        ? { ...credential, apiKey: config.api_key ?? credential.apiKey }
        : credential;
  const parent =
    config.locked.includes("project") || config.locked.includes("agent_id")
      ? {}
      : parentDestination(config);
  const agentId =
    parent.agentId ?? (parent.projectName === undefined ? config.agent_id : undefined);
  return {
    destinations: [
      {
        ...auth,
        ...(agentId === undefined ? {} : { agentId }),
        projectName: parent.projectName ?? config.project ?? DEFAULT_LANGSMITH_PROJECT_NAME,
      },
    ],
    ...(config.replicas?.length ? { replicas: toSdkReplicas(config.replicas) } : {}),
    redact: config.redact,
    projectLocked: config.locked.includes("project"),
    storageRoot,
    ...(config.redact_extra_rules === undefined
      ? {}
      : { redactExtraRules: config.redact_extra_rules }),
  };
}
