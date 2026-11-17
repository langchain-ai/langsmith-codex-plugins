import { createRepositoryAttributor } from "@langchain/plugins-base/git";
import type {
  CreateTranscriptBuilder,
  RunPatch,
  RunPost,
  TranscriptLine,
} from "@langchain/plugins-base/tracer";
import { RunTree } from "langsmith";
import { join } from "node:path";
import {
  CODEX_CONFIG_DIRECTORY,
  GITHUB_LOGIN_MARKER_FILE_NAME,
  MODE_METADATA,
  POST_TOOL_USE_EVENT,
  SPAWN_AGENT_CALL,
  STOP_EVENT,
  SUBAGENT_AGENT_TYPE,
  TOOLS_WITH_END_EVENTS,
  TRACER_BUILDER_STATE_VERSION,
} from "./constants.js";
import type { LineSchema } from "./models/rollout.js";
import type {
  BuilderState,
  CompletedTurn,
  NoteDetails,
  RolloutWalk,
  SavedWalk,
} from "./models/trace-conversion.js";
import type { CodexReconstructedRun } from "./models/tracing-engine.js";
import {
  combinedTurnMode,
  createRolloutWalk,
  finishTurn,
  postTurn,
  readRolloutLine,
} from "./trace.js";
import { runIdGenerator, toolRunIdGenerator } from "./tracing-engine-payload.js";
import {
  defaultPrivacyPath,
  inheritedTurnMode,
  inheritThreadMode,
  savedTurnMode,
} from "./tracing-policy.js";
import { homeDirectory } from "./utils/home.js";
import { isRecord } from "./utils/isRecord.js";
import { isoTime } from "./utils/rollout.js";

function freshState(): BuilderState {
  return {
    version: TRACER_BUILDER_STATE_VERSION,
    noteSeen: false,
    turnModes: {},
    liveRoots: [],
    liveTools: [],
    waitingTools: [],
  };
}

function restoredState(saved: unknown): BuilderState {
  const candidate = saved as Partial<BuilderState> | undefined;
  return candidate?.version === TRACER_BUILDER_STATE_VERSION
    ? (candidate as BuilderState)
    : freshState();
}

function restoredWalk(saved: SavedWalk | undefined): RolloutWalk {
  const walk: RolloutWalk = { ...createRolloutWalk(), ...saved, spawnAgentMessages: new Map() };
  for (const message of walk.task?.messages ?? []) {
    const item = message.message;
    if (item.type === "function_call" && item.name === SPAWN_AGENT_CALL)
      walk.spawnAgentMessages.set(item.call_id, message);
  }
  return walk;
}

function runPost({ run, mode, metadata }: CodexReconstructedRun): RunPost {
  const parentRunId = run.parent_run?.id ?? run.parent_run_id;
  return {
    id: run.id,
    name: run.name,
    run_type: run.run_type,
    trace_id: run.trace_id,
    dotted_order: run.dotted_order,
    ...(parentRunId === undefined ? {} : { parent_run_id: parentRunId }),
    start_time: isoTime(run.start_time),
    ...(run.end_time === undefined ? {} : { end_time: isoTime(run.end_time) }),
    inputs: run.inputs,
    ...(run.outputs === undefined ? {} : { outputs: run.outputs }),
    ...(run.error == null ? {} : { error: run.error }),
    metadata,
    tracingMode: mode,
  };
}

function openRootPost(root: CodexReconstructedRun): RunPost {
  const { end_time: _end, outputs: _outputs, error: _error, ...open } = runPost(root);
  return open;
}

function closingRootPatch(root: CodexReconstructedRun): RunPatch {
  const { inputs: _inputs, ...patch } = runPost(root);
  return patch;
}

function mentionedCallId({ payload }: LineSchema): string | undefined {
  const fields = payload as Record<string, unknown>;
  const callId = fields.call_id ?? (isRecord(fields.item) ? fields.item.id : undefined);
  return typeof callId === "string" ? callId : undefined;
}

export const createCodexTranscriptBuilder: CreateTranscriptBuilder = ({
  sessionId,
  savedState,
  sink,
  tracingMode,
}) => {
  const state = restoredState(savedState);
  const walk = restoredWalk(state.walk);
  const attributor = createRepositoryAttributor({
    githubLoginMarkerPath: join(
      homeDirectory(),
      CODEX_CONFIG_DIRECTORY,
      GITHUB_LOGIN_MARKER_FILE_NAME,
    ),
  });

  function nativeTurnMode(privacyTurnId: string | undefined) {
    const thread = walk.sessionMeta;
    if (thread?.session_id === undefined) return MODE_METADATA;
    if (thread.is_subagent)
      return inheritedTurnMode(defaultPrivacyPath(), thread.session_id) ?? MODE_METADATA;
    return savedTurnMode(defaultPrivacyPath(), thread.session_id, privacyTurnId);
  }

  function privacyMode(turnId: string) {
    return state.turnModes[turnId] ?? tracingMode;
  }

  function turnMode({ privacyTurnId }: CompletedTurn, turnId: string) {
    return combinedTurnMode(nativeTurnMode(privacyTurnId), privacyMode(turnId));
  }

  function convertTurn(turn: CompletedTurn, turnId: string, includeOpenTurn: boolean) {
    const runs: CodexReconstructedRun[] = [];
    postTurn(turn.task, walk.sessionMeta, turnMode(turn, turnId), {
      rolloutFile: state.transcriptPath ?? "",
      includeOpenTurn,
      options: {
        captureRun: (run, mode, metadata) => {
          runs.push({ run, mode, metadata });
        },
        nextRunId: runIdGenerator(sessionId, turnId),
        toolRunId: toolRunIdGenerator(sessionId, turnId),
        metadata: state.metadata,
        parentRunTree: state.parentHeaders && RunTree.fromHeaders(state.parentHeaders),
        privacyMode: privacyMode(turnId),
        attributor,
      },
    });
    return runs;
  }

  function completeTurn(turn: CompletedTurn) {
    const turnId = turn.completedTurnId;
    if (turnId === undefined || turnId === state.lastPostedTurn) return;
    if (state.firstNoteTurnId !== undefined && turnId !== state.firstNoteTurnId) return;
    state.firstNoteTurnId = undefined;
    state.lastPostedTurn = turnId;
    const mode = turnMode(turn, turnId);
    for (const child of turn.task.subagentThreads)
      void inheritThreadMode(defaultPrivacyPath(), child, mode).catch(() => undefined);
    const liveRoot = state.liveRoots.includes(turnId);
    for (const [index, captured] of convertTurn(turn, turnId, false).entries()) {
      if (index === 0 && liveRoot) sink.patch(closingRootPatch(captured));
      else if (!state.liveTools.includes(captured.run.id)) sink.post(runPost(captured));
    }
    delete state.turnModes[turnId];
    state.liveRoots = state.liveRoots.filter((id) => id !== turnId);
    state.liveTools = [];
    state.waitingTools = [];
  }

  function postFinishedTools() {
    if (walk.task === undefined || state.lastLineTime === undefined) return;
    const openWalk = { ...walk, task: { ...walk.task } };
    const turn = finishTurn(openWalk, state.lastLineTime, state.currentTurnId);
    const turnId = turn.completedTurnId;
    if (turnId === undefined) return;
    const [root, ...children] = convertTurn(turn, turnId, true);
    if (root === undefined || root.metadata.agentType === SUBAGENT_AGENT_TYPE) return;
    const toolRunId = toolRunIdGenerator(sessionId, turnId);
    for (const callId of state.waitingTools) {
      const tool = children.find(({ run }) => run.id === toolRunId(callId));
      if (tool === undefined) continue;
      const outputs = turn.task.toolCalls[callId]?.outputs ?? {};
      if (TOOLS_WITH_END_EVENTS.has(tool.run.name) && Object.keys(outputs).length === 0) continue;
      if (!state.liveRoots.includes(turnId)) {
        sink.post(openRootPost(root));
        state.liveRoots.push(turnId);
      }
      sink.post(runPost(tool));
      state.liveTools.push(tool.run.id);
      state.waitingTools = state.waitingTools.filter((id) => id !== callId);
    }
  }

  return {
    lineId: () => undefined,
    transcripts: () => (state.transcriptPath === undefined ? [] : [state.transcriptPath]),
    turnOpen: () => walk.task !== undefined,
    readLine: (path, line: TranscriptLine) => {
      state.transcriptPath ??= path;
      if (path !== state.transcriptPath) return;
      const rollout = line as LineSchema;
      state.lastLineTime = Date.parse(rollout.timestamp);
      if (readRolloutLine(walk, rollout, false)) {
        const stoppedTurnTail = state.stopClosedTurn && walk.task?.turnId === undefined;
        state.stopClosedTurn = false;
        if (stoppedTurnTail) {
          walk.task = undefined;
          return;
        }
        const turn = finishTurn(walk, state.lastLineTime, state.currentTurnId);
        if (state.noteSeen) completeTurn(turn);
        else state.heldTurn = { turn, end: state.lastLineTime };
        return;
      }
      const callId = mentionedCallId(rollout);
      if (callId !== undefined && state.waitingTools.includes(callId)) postFinishedTools();
    },
    receiveNote: (note) => {
      const details = (note.details ?? {}) as NoteDetails;
      state.transcriptPath ??= note.transcriptPath;
      state.metadata = details.metadata;
      state.parentHeaders = details.parentHeaders;
      if (details.turnId !== undefined) {
        state.currentTurnId = details.turnId;
        if (note.tracingMode !== undefined) state.turnModes[details.turnId] = note.tracingMode;
      }
      if (!state.noteSeen) state.firstNoteTurnId = details.turnId;
      else if (details.turnId !== undefined && details.turnId !== state.firstNoteTurnId)
        state.firstNoteTurnId = undefined;
      state.noteSeen = true;
      const held = state.heldTurn;
      state.heldTurn = undefined;
      const unmarked = held !== undefined && held.turn.completedTurnId === undefined;
      if (unmarked && note.event === STOP_EVENT && details.turnId) {
        held.turn.completedTurnId = details.turnId;
        held.turn.task.turnId = { id: details.turnId, timestamp: held.end };
      }
      if (held !== undefined && held.turn.completedTurnId === details.turnId)
        completeTurn(held.turn);
      if (note.event === POST_TOOL_USE_EVENT && details.toolUseId !== undefined) {
        state.waitingTools.push(details.toolUseId);
        postFinishedTools();
      }
      const openTurnId = walk.task?.turnId?.id;
      if (
        note.event === STOP_EVENT &&
        walk.task !== undefined &&
        (openTurnId === undefined || openTurnId === details.turnId) &&
        state.lastLineTime !== undefined
      ) {
        completeTurn(finishTurn(walk, state.lastLineTime, details.turnId));
        state.stopClosedTurn = true;
      }
    },
    state: () => {
      const { spawnAgentMessages: _spawned, ...saved } = walk;
      return { ...state, walk: saved };
    },
  };
};
