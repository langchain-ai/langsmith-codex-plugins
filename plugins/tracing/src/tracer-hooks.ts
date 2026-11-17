import { launchDetachedWorker } from "@langchain/plugins-base/plugin";
import { createCaptureStore } from "@langchain/plugins-base/storage/capture";
import { sendHookNote, startTracerWorker, tracerPaths } from "@langchain/plugins-base/tracer";
import type { LegacySession } from "@langchain/plugins-base/tracer";
import { statSync } from "node:fs";
import * as path from "node:path";
import { getConfig } from "./config.js";
import {
  CODEX_CONFIG_DIRECTORY,
  CODEX_SESSIONS_DIRECTORY,
  ENGINE_STORAGE_DIRECTORY,
  ENGINE_WORKER_FLAG,
  LS_INTEGRATION,
  PLUGIN_VERSION,
} from "./constants.js";
import { readJobState } from "./job-context.js";
import type { CodexHookInput } from "./models/hook-input.js";
import type { NoteDetails } from "./models/trace-conversion.js";
import { createCodexTranscriptBuilder } from "./tracer-builder.js";
import { engineStorageRoot, runCodexEngineWorker, writerOptions } from "./tracing-engine.js";
import { lockedTurnMode } from "./tracing-policy.js";
import { homeDirectory } from "./utils/home.js";
import { findRolloutFileByThreadId, readSession } from "./utils/rollout.js";

export async function sendTracerNote(input: CodexHookInput): Promise<void> {
  const home = homeDirectory();
  const config = await getConfig({ home, cwd: input.cwd, env: process.env });
  const writer = writerOptions(config, engineStorageRoot(home));
  if (!config.enabled || !writer || !input.session_id || !input.turn_id) return;
  const paths = tracerPaths(path.join(home, CODEX_CONFIG_DIRECTORY));
  let launch: Promise<unknown> | undefined;
  sendHookNote(
    {
      integration: LS_INTEGRATION,
      event: input.hook_event_name,
      sessionId: input.session_id,
      ...(input.transcript_path ? { transcriptPath: input.transcript_path } : {}),
      tracingMode: lockedTurnMode(config, input.session_id, input.turn_id),
      details: {
        turnId: input.turn_id,
        toolUseId: input.tool_use_id,
        metadata: config.metadata,
        parentHeaders: config.parent_headers,
      } satisfies NoteDetails,
      writer,
    },
    {
      paths,
      version: PLUGIN_VERSION,
      startWorker: () => {
        launch = launchDetachedWorker([ENGINE_WORKER_FLAG], {
          storageRoot: paths.folder,
        });
      },
    },
  );
  await launch;
}

function rolloutCwd(transcriptPath: string): string | undefined {
  for (const line of readSession(transcriptPath))
    return line.type === "session_meta" ? line.payload.cwd : undefined;
  return undefined;
}

export async function readLegacySessions(home: string): Promise<LegacySession[]> {
  const jobs = readJobState(home);
  const oldStorage = path.join(home, CODEX_CONFIG_DIRECTORY, ENGINE_STORAGE_DIRECTORY);
  const queued = await createCaptureStore(oldStorage)
    .enumerateSessions(LS_INTEGRATION)
    .catch(() => []);
  const sessionsFolder = path.join(home, CODEX_CONFIG_DIRECTORY, CODEX_SESSIONS_DIRECTORY);
  const sessions: LegacySession[] = [];
  for (const sessionId of new Set([...Object.keys(jobs), ...queued.map((s) => s.sessionId)])) {
    const transcriptPath = findRolloutFileByThreadId(
      path.join(sessionsFolder, sessionId),
      sessionId,
    );
    if (transcriptPath === undefined) continue;
    const job = Object.hasOwn(jobs, sessionId) ? jobs[sessionId] : undefined;
    const context = Object.values(job?.queued_jobs ?? {}).at(-1);
    const cwd = context?.cwd ?? rolloutCwd(transcriptPath) ?? home;
    const config = await getConfig({ home, cwd, env: process.env });
    const writer = writerOptions({ ...config, ...context }, engineStorageRoot(home));
    if (writer === undefined) continue;
    const updatedAt = job ? Date.parse(job.updated) : statSync(transcriptPath).mtimeMs;
    const recover = () => runCodexEngineWorker(sessionId, cwd, oldStorage);
    sessions.push({ sessionId, transcriptPath, updatedAt, writer, recover });
  }
  return sessions;
}

export async function runTracerWorker(): Promise<void> {
  const home = homeDirectory();
  const legacySessions = await readLegacySessions(home);
  await startTracerWorker({
    agentStateFolder: path.join(home, CODEX_CONFIG_DIRECTORY),
    integration: LS_INTEGRATION,
    version: PLUGIN_VERSION,
    createBuilder: createCodexTranscriptBuilder,
    readLegacySessions: () => legacySessions,
  });
}
