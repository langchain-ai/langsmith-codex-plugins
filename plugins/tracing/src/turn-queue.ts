import type { PluginSession } from "@langchain/plugins-base/plugin";
import { MODE_OFF } from "./constants.js";
import { saveJobContext } from "./job-context.js";
import type { Config } from "./models/config.js";
import type { CodexTurnRequest } from "./models/tracing-engine.js";
import type { TracingMode } from "./models/tracing-policy.js";
import { loadUploadedTurnIds, markTurnUploaded } from "./sidecar.js";
import { listCompletedTurnIds } from "./trace.js";
import {
  contextSourceRef,
  reconstructionEventId,
  transcriptSourceRef,
} from "./tracing-engine-locator.js";
import { defaultPrivacyPath, savedTurnMode } from "./tracing-policy.js";
import { homeDirectory } from "./utils/home.js";

export async function queueCodexTurns(
  session: PluginSession,
  config: Config,
  request: CodexTurnRequest,
): Promise<void> {
  const handled = await loadUploadedTurnIds(request.transcriptPath);
  const firstStop = handled.size === 0;
  const completed = await listCompletedTurnIds({
    transcript_path: request.transcriptPath,
    turn_id: request.turnId,
  });
  for (const turnId of completed) {
    if (handled.has(turnId)) continue;
    const mode = savedTurnMode(defaultPrivacyPath(), session.sessionId, turnId);
    if (mode === MODE_OFF || (firstStop && turnId !== request.turnId)) {
      await markTurnUploaded(request.transcriptPath, turnId);
      continue;
    }
    await queueCodexTurn(session, config, { ...request, turnId }, mode);
  }
}

async function queueCodexTurn(
  session: PluginSession,
  config: Config,
  request: CodexTurnRequest,
  mode: TracingMode,
): Promise<void> {
  const { transcriptPath, turnId } = request;
  const sourceRef = transcriptSourceRef(transcriptPath);
  const contextRef = contextSourceRef(session.sessionId, turnId, sourceRef, mode);
  await saveJobContext(homeDirectory(), session.sessionId, contextRef, {
    cwd: request.cwd,
    project: config.project,
    metadata: config.metadata,
    parent_headers: config.parent_headers,
  });
  const input = {
    turnId,
    eventId: reconstructionEventId(session.sessionId, turnId, sourceRef, mode),
    sourceRefs: [sourceRef, contextRef],
    privacyMode: mode,
    turnEvidence: { childRunIds: [], closureState: "authoritative" as const },
  };
  try {
    const result = await session.session.queueReconstruction(input);
    if (result.status !== "published" && result.status !== "duplicate") {
      throw new Error(`Shared Codex reconstruction queue failed: ${result.status}`);
    }
  } catch (error) {
    if (!(await session.session.readSavedReconstructionWake(error, input))) throw error;
    console.error(`Shared Codex reconstruction was saved but its worker wake failed: ${error}`);
  }
  await markTurnUploaded(transcriptPath, turnId);
}
