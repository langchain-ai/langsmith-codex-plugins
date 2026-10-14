import { RunTree, type Client } from "langsmith";
import { launchDetachedWorker, openPluginSession } from "@langchain/plugins-base/plugin";
import type { PluginSession } from "@langchain/plugins-base/plugin";
import { toSdkReplicas } from "@langchain/plugins-base/settings";
import type { ReconstructionJob } from "@langchain/plugins-base/tracing/reconstruction";
import type { LangSmithUploadWriterOptions } from "@langchain/plugins-base/tracing/upload";
import * as path from "node:path";
import type { Config } from "./models/config.js";
import { getConfig } from "./config.js";
import {
  CODEX_CONFIG_DIRECTORY,
  DEFAULT_LANGSMITH_API_URL,
  DEFAULT_LANGSMITH_PROJECT_NAME,
  DROPPED_WORK_WARNING,
  ENGINE_STORAGE_DIRECTORY,
  ENGINE_WORKER_FLAG,
  LS_INTEGRATION,
  TRACE_RUN_EVENT_PREFIX,
} from "./constants.js";
import { readJobContext, removeJobContext } from "./job-context.js";
import type {
  CodexReconstructedRun,
  CodexReconstruction,
  CodexRecoveryResult,
} from "./models/tracing-engine.js";
import { convertToRunTree } from "./trace.js";
import { transcriptPathFromRef } from "./tracing-engine-locator.js";
import { createRunClient, postSubmission, runIdGenerator } from "./tracing-engine-payload.js";
import { recordWarning } from "./warnings.js";
import { homeDirectory } from "./utils/home.js";

export function createCodexTracingSession(
  config: Config,
  sessionId: string,
  cwd: string,
  home = homeDirectory(),
): PluginSession | undefined {
  const writer = writerOptions(config);
  if (!writer) return undefined;
  const storageRoot = path.join(home, CODEX_CONFIG_DIRECTORY, ENGINE_STORAGE_DIRECTORY);
  return openPluginSession({
    storageRoot,
    integration: LS_INTEGRATION,
    sessionId,
    writer,
    currentWriter: async () => writerOptions(await getConfig({ home, cwd, env: process.env })),
    reconstruct: (job) => reconstructTranscript(job, config, home),
    scheduleWake: (wakeSessionId) =>
      launchDetachedWorker([ENGINE_WORKER_FLAG, wakeSessionId, cwd], { storageRoot }),
    onRecoveryReport: reportRecovery,
  });
}

function reportRecovery(result: CodexRecoveryResult): void {
  if (result.status === "completed") return;
  console.error(`Shared Codex trace recovery did not finish: ${JSON.stringify(result)}`);
}

export async function runCodexEngineWorker(sessionId: string, cwd: string): Promise<void> {
  const home = homeDirectory();
  const config = await getConfig({ home, cwd, env: process.env });
  const session = createCodexTracingSession(config, sessionId, cwd, home);
  if (!session) throw new Error("Shared Codex trace worker configuration is unavailable");
  const result = await session.session.drain();
  if (result === "retry-exhausted" || result === "dropped" || result === "scope-mismatch") {
    if (result !== "scope-mismatch") await recordWarning(home, DROPPED_WORK_WARNING);
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
  const client = createRunClient(config);
  const parentRunTree = parentRunTreeFor(config, client);
  await convertToRunTree(
    { transcript_path: transcriptPath, turn_id: job.turnId },
    {
      client,
      projectName: config.project,
      metadata: config.metadata,
      replicas: toSdkReplicas(config.replicas),
      parentRunTree,
      captureRun: async (run, mode, metadata) => {
        runs.push({ metadata, run, mode });
      },
      nextRunId: runIdGenerator(job.sessionId, job.turnId),
      privacyMode: job.privacyMode,
    },
  );
  const [root, ...children] = runs;
  if (root === undefined) throw new Error("Codex transcript has no completed target turn");
  const outputs = runs.map(({ metadata, mode, run }) => ({
    eventId: `${TRACE_RUN_EVENT_PREFIX}${run.id}`,
    sourceRef: transcriptRef,
    turnEvidence: {
      rootRunId: root.run.id,
      childRunIds: children.map(({ run: child }) => child.id),
      closureState: "authoritative" as const,
    },
    submission: postSubmission(run, mode, metadata),
  }));
  await removeJobContext(home, job.sessionId, contextRef);
  return { status: "ready", outputs };
}

function parentRunTreeFor(config: Config, client?: Client): RunTree | undefined {
  return config.parent_headers
    ? RunTree.fromHeaders(config.parent_headers, { client, project_name: config.project })
    : undefined;
}

function writerOptions(config: Config): LangSmithUploadWriterOptions | undefined {
  if (!config.api_key?.trim() && !config.replicas?.length) return undefined;
  return {
    destinations: [
      {
        apiKey: config.api_key ?? "",
        apiUrl: config.api_url ?? DEFAULT_LANGSMITH_API_URL,
        projectName:
          parentRunTreeFor(config)?.project_name ??
          config.project ??
          DEFAULT_LANGSMITH_PROJECT_NAME,
      },
    ],
    ...(config.replicas?.length ? { replicas: toSdkReplicas(config.replicas) } : {}),
    redact: config.redact,
    ...(config.redact_extra_rules === undefined
      ? {}
      : { redactExtraRules: config.redact_extra_rules }),
  };
}
