import { setTimeout as sleep } from "node:timers/promises";
import { getConfig } from "./config.js";
import {
  MODE_OFF,
  ITEM_COMPLETED_EVENT,
  TOOL_END_EVENT_SUFFIX,
  TOOL_OUTPUT_POLL_MS,
  TOOL_OUTPUT_WAIT_MS,
  TOOLS_WITH_END_EVENTS,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type { CodexHookInput } from "./models/hook-input.js";
import type { LiveToolRequest, LiveToolRuns } from "./models/tracing-engine.js";
import type { TracingMode } from "./models/tracing-policy.js";
import { loadUploadedTurnIds, withSidecarLock } from "./sidecar.js";
import {
  buildLiveToolRuns,
  createCodexTracingSession,
  saveLiveToolRuns,
} from "./tracing-engine.js";
import { lockedTurnMode } from "./tracing-policy.js";
import { homeDirectory } from "./utils/home.js";
import { isRecord } from "./utils/isRecord.js";
import { loadSession } from "./utils/rollout.js";

export async function handlePostToolUse(input: CodexHookInput): Promise<void> {
  const { session_id, turn_id, transcript_path, tool_use_id } = input;
  if (!session_id || !turn_id || !transcript_path || !tool_use_id) return;
  const config = await getConfig({ home: homeDirectory(), cwd: input.cwd, env: process.env });
  if (!config.enabled || config.capture_hook_outputs) return;
  const mode = lockedTurnMode(config, session_id, turn_id);
  if (mode === MODE_OFF) return;
  const plugin = createCodexTracingSession(config, session_id, input.cwd);
  if (!plugin) return;
  const request = { session_id, turn_id, transcript_path, tool_use_id };
  const runs = await waitForToolRuns(config, request, mode);
  if (!runs) return;
  await withSidecarLock(transcript_path, async () => {
    if ((await loadUploadedTurnIds(transcript_path)).has(turn_id)) return;
    await saveLiveToolRuns(plugin, turn_id, runs);
  });
}

async function waitForToolRuns(
  config: Config,
  request: LiveToolRequest,
  mode: TracingMode,
): Promise<LiveToolRuns | undefined> {
  const deadline = Date.now() + TOOL_OUTPUT_WAIT_MS;
  for (;;) {
    const runs = await buildLiveToolRuns(config, request, mode).catch((error: unknown) => {
      if (error instanceof SyntaxError) return undefined;
      throw error;
    });
    const finished =
      runs !== undefined &&
      (!TOOLS_WITH_END_EVENTS.has(runs.tool.run.name) ||
        (await hasToolEndEvent(request.transcript_path, request.tool_use_id).catch(() => false)));
    if (finished) return runs;
    if (Date.now() >= deadline) return undefined;
    await sleep(TOOL_OUTPUT_POLL_MS);
  }
}

async function hasToolEndEvent(transcriptPath: string, callId: string): Promise<boolean> {
  return (await loadSession(transcriptPath)).some(
    ({ type, payload }) =>
      type === "event_msg" &&
      ((payload.call_id === callId && payload.type.endsWith(TOOL_END_EVENT_SUFFIX)) ||
        (payload.type === ITEM_COMPLETED_EVENT &&
          isRecord(payload.item) &&
          payload.item.id === callId)),
  );
}
