import { isRecord } from "./isRecord.js";

// spawn_agent's output carries the child thread id as `agent_id` (string or object).
export function extractSpawnedAgentId(output: unknown): string | undefined {
  let obj: unknown = output;
  if (typeof output === "string") {
    try {
      obj = JSON.parse(output);
    } catch {
      return undefined;
    }
  }
  if (obj != null && typeof obj === "object") {
    const id = (obj as { agent_id?: unknown }).agent_id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

export function extractSubagentActivities(payload: Record<string, unknown>) {
  const activities: { threadId: string; callId?: string }[] = [];

  if (payload.type === "sub_agent_activity" && payload.kind === "started") {
    if (typeof payload.agent_thread_id === "string") {
      activities.push({
        threadId: payload.agent_thread_id,
        callId: typeof payload.event_id === "string" ? payload.event_id : undefined,
      });
    }
    return activities;
  }

  if (payload.type !== "item_completed" || !isRecord(payload.item)) return activities;

  const item = payload.item;
  const callId = typeof item.id === "string" ? item.id : undefined;
  if (
    item.type === "SubAgentActivity" &&
    item.kind === "started" &&
    typeof item.agent_thread_id === "string"
  ) {
    activities.push({ threadId: item.agent_thread_id, callId });
  }

  if (item.type === "CollabAgentToolCall" && item.tool === "spawn_agent") {
    const ids = new Set<string>();
    if (Array.isArray(item.receiver_thread_ids)) {
      for (const id of item.receiver_thread_ids) {
        if (typeof id === "string") ids.add(id);
      }
    }
    if (Array.isArray(item.receiver_agents)) {
      for (const agent of item.receiver_agents) {
        if (isRecord(agent) && typeof agent.thread_id === "string") ids.add(agent.thread_id);
      }
    }
    for (const threadId of ids) activities.push({ threadId, callId });
  }

  return activities;
}
