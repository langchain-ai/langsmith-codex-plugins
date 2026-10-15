import { MODE_METADATA } from "./constants.js";
import type { SessionMetaLine, SubagentSource } from "./models/rollout.js";
import type { TurnMode } from "./models/tracing-policy.js";
import { defaultPrivacyPath, inheritThreadMode, savedTurnMode } from "./tracing-policy.js";
import { findRolloutFileByThreadId, loadSession } from "./utils/rollout.js";
import { extractSpawnedAgentId, extractSubagentActivities } from "./utils/subagents.js";

function parentThreadId(meta: SessionMetaLine): string | undefined {
  const source = meta.payload.source as SubagentSource | undefined;
  return source && typeof source === "object"
    ? (source.subagent?.thread_spawn?.parent_thread_id ?? meta.payload.parent_thread_id)
    : meta.payload.parent_thread_id;
}

function isChildSession(meta: SessionMetaLine, parentId: string | undefined): boolean {
  const source = meta.payload.source as SubagentSource | undefined;
  return (
    !!parentId ||
    meta.payload.thread_source === "subagent" ||
    (!!source && typeof source === "object" && !!source.subagent)
  );
}

async function launchedTurns(parentFile: string, sessionId: string): Promise<Set<string>> {
  let nativeTurn: string | undefined;
  const calls = new Map<string, string>();
  const launches = new Set<string>();
  for (const event of await loadSession(parentFile)) {
    if (event.type === "event_msg") {
      if (event.payload.type === "task_started") nativeTurn = event.payload.turn_id;
      const ids = extractSubagentActivities(event.payload).map((activity) => activity.threadId);
      if (
        event.payload.type === "collab_agent_spawn_end" &&
        typeof event.payload.new_thread_id === "string"
      )
        ids.push(event.payload.new_thread_id);
      if (nativeTurn && ids.includes(sessionId)) launches.add(nativeTurn);
      if (["task_complete", "turn_complete", "turn_aborted"].includes(event.payload.type)) {
        nativeTurn = undefined;
      }
    }
    if (event.type === "response_item") {
      if (
        event.payload.type === "function_call" &&
        event.payload.name === "spawn_agent" &&
        nativeTurn
      )
        calls.set(event.payload.call_id, nativeTurn);
      if (
        event.payload.type === "function_call_output" &&
        calls.has(event.payload.call_id) &&
        extractSpawnedAgentId(event.payload.output) === sessionId
      )
        launches.add(calls.get(event.payload.call_id)!);
    }
  }
  return launches;
}

async function parentLaunchMode(
  file: string,
  sessionId: string,
  parentId: string | undefined,
  visited: Set<string>,
): Promise<TurnMode> {
  const parentFile = parentId ? await findRolloutFileByThreadId(file, parentId) : undefined;
  if (!parentFile || !parentId) return MODE_METADATA;
  const launches = await launchedTurns(parentFile, sessionId);
  if (launches.size !== 1) return MODE_METADATA;
  return rolloutTurnMode(parentFile, parentId, [...launches][0], visited);
}

/** Resolve direct child Stops exactly as recursive uploads: use the spawning
 * parent's native turn, not the parent's current preference or Stop turn_id.
 * Missing/ambiguous launch evidence is metadata-only. No timing heuristic. */
export async function rolloutTurnMode(
  file: string,
  sessionId: string,
  turnId: string | undefined,
  visited = new Set<string>(),
): Promise<TurnMode> {
  if (visited.has(sessionId)) return MODE_METADATA;
  visited.add(sessionId);
  const meta = (await loadSession(file)).find((event) => event.type === "session_meta");
  if (meta?.type !== "session_meta" || meta.payload.id !== sessionId) return MODE_METADATA;
  const parentId = parentThreadId(meta);
  if (!isChildSession(meta, parentId)) {
    return savedTurnMode(defaultPrivacyPath(), sessionId, turnId);
  }
  const mode = await parentLaunchMode(file, sessionId, parentId, visited);
  try {
    return await inheritThreadMode(defaultPrivacyPath(), sessionId, mode);
  } catch {
    return MODE_METADATA;
  }
}
