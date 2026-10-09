import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ignoreMissingFile, writePrivateFile } from "./utils/files.js";
import { withFileLock } from "./utils/fileLock.js";
import type {
  CapturedTool,
  CaptureRedactor,
  TracingHookInput,
  TurnCapture,
  ReconciliationMetadata,
} from "./models/tool-capture.js";
import type { TurnMode } from "./models/tracing-policy.js";
import type { LineSchema, SessionMetaLine } from "./types.js";
import { readTranscriptSessionMetadata } from "./transcript-metadata.js";
import {
  TURN_CAPTURE_SUFFIX,
  TURN_CAPTURE_TRANSCRIPT,
  TOOL_CAPTURE_START_SUFFIX,
  TOOL_CAPTURE_END_SUFFIX,
  TOOL_CAPTURE_FILE_PATTERN,
  TURN_CAPTURE_STOP,
  TURN_CAPTURE_PLAN,
  TOOL_CAPTURE_TEMP_PATTERN,
  TURN_CAPTURE_LOCK_SUFFIX,
} from "./tool-capture-constants.js";

export function turnCaptureDirectory(transcript: string, turn: string) {
  return `${transcript}${TURN_CAPTURE_SUFFIX}${createHash("sha256").update(turn).digest("hex")}`;
}

export function withTurnCaptureLock<T>(transcript: string, action: () => Promise<T>) {
  return withFileLock(`${transcript}${TURN_CAPTURE_LOCK_SUFFIX}`, action);
}

export async function recordToolHook(
  input: TracingHookInput,
  mode: TurnMode,
  redact?: CaptureRedactor,
) {
  if (mode === "off" || !input.tool_use_id || !input.tool_name) return;
  const ended = input.hook_event_name === "PostToolUse";
  const key = createHash("sha256").update(input.tool_use_id).digest("hex");
  const directory = turnCaptureDirectory(input.transcript_path, input.turn_id);
  const file = path.join(
    directory,
    `${key}${ended ? TOOL_CAPTURE_END_SUFFIX : TOOL_CAPTURE_START_SUFFIX}`,
  );
  const record: CapturedTool = {
    id: input.tool_use_id,
    name: input.tool_name,
    startedAt: Date.now(),
    ...(ended ? { endedAt: Date.now() } : {}),
    mode,
    ...(mode === "full" && ended
      ? {
          input: input.tool_input,
          output: input.tool_response,
        }
      : {}),
  };
  const content =
    redact && mode === "full"
      ? { ...record, ...redact({ input: record.input, output: record.output }) }
      : record;
  await withTurnCaptureLock(input.transcript_path, () =>
    writePrivateFile(file, JSON.stringify(content), { firstWriteWins: true }),
  );
}

export async function readTranscript(file: string, turn?: string): Promise<LineSchema[]> {
  let contents: string;
  try {
    contents = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !turn) throw error;
    contents = await fs.readFile(
      path.join(turnCaptureDirectory(file, turn), TURN_CAPTURE_TRANSCRIPT),
      "utf8",
    );
  }
  const lines = contents.split("\n");
  return lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as LineSchema];
    } catch (error) {
      if (index === lines.length - 1 && !contents.endsWith("\n")) return [];
      throw error;
    }
  });
}

export async function transcriptSessionId(file: string): Promise<string | undefined> {
  try {
    const metadata = await readTranscriptSessionMetadata(file);
    return typeof metadata?.payload.id === "string" ? metadata.payload.id : undefined;
  } catch {
    return undefined;
  }
}

export async function readTranscriptSessionMeta(
  file: string,
  turn?: string,
): Promise<SessionMetaLine | undefined> {
  try {
    return await readTranscriptSessionMetadata(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !turn) throw error;
    return readTranscriptSessionMetadata(
      path.join(turnCaptureDirectory(file, turn), TURN_CAPTURE_TRANSCRIPT),
    );
  }
}

export async function prepareTurnCapture(
  transcript: string,
  turn: string,
  mode: TurnMode,
  redact?: CaptureRedactor,
): Promise<TurnCapture> {
  const directory = turnCaptureDirectory(transcript, turn);
  const snapshot = path.join(directory, TURN_CAPTURE_TRANSCRIPT);
  const events = await readTranscript(transcript, turn);
  if (mode === "full") {
    let active = false;
    const current = events.filter((event) => {
      if (event.type === "session_meta") return true;
      if (event.type === "event_msg" && event.payload.type === "task_started")
        active = event.payload.turn_id === turn;
      return active;
    });
    const safe = redact
      ? current.map((event) => redact(event as unknown as Record<string, unknown>))
      : current;
    await writePrivateFile(snapshot, safe.map((event) => JSON.stringify(event)).join("\n") + "\n");
  }
  const files = await fs.readdir(directory).catch(ignoreMissingFile);
  if (!files) return { events, tools: [], stopped: false };
  const records = new Map<string, CapturedTool>();
  for (const file of files.filter((name) => TOOL_CAPTURE_FILE_PATTERN.test(name)).sort()) {
    const value: CapturedTool = JSON.parse(await fs.readFile(path.join(directory, file), "utf8"));
    if (
      typeof value.id !== "string" ||
      typeof value.name !== "string" ||
      !Number.isFinite(value.startedAt)
    )
      throw new Error("Invalid captured tool");
    const existing = records.get(value.id);
    records.set(
      value.id,
      existing
        ? {
            ...existing,
            ...value,
            startedAt: Math.min(existing.startedAt, value.startedAt),
            endedAt: existing.endedAt ?? value.endedAt,
            output: existing.output ?? value.output,
          }
        : value,
    );
  }
  return {
    events,
    stopped: files.includes(TURN_CAPTURE_STOP),
    tools: [...records.values()].sort(
      (a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id),
    ),
  };
}

export async function clearTurnCapture(transcript: string, turn: string) {
  const directory = turnCaptureDirectory(transcript, turn);
  const files = await fs.readdir(directory).catch(ignoreMissingFile);
  if (!files) return;
  for (const name of files) {
    if (
      [TURN_CAPTURE_TRANSCRIPT, TURN_CAPTURE_STOP, TURN_CAPTURE_PLAN].includes(name) ||
      TOOL_CAPTURE_FILE_PATTERN.test(name) ||
      TOOL_CAPTURE_TEMP_PATTERN.test(name)
    )
      await fs.unlink(path.join(directory, name));
  }
  await fs.rmdir(directory);
}

export async function markTurnStopped(transcript: string, turn: string) {
  await writePrivateFile(
    path.join(turnCaptureDirectory(transcript, turn), TURN_CAPTURE_STOP),
    "true",
  );
}

export function pendingCapturedTools(tools: CapturedTool[], events: LineSchema[], turn: string) {
  let active = false;
  const completed = new Set<string>();
  for (const event of events) {
    if (event.type === "event_msg" && event.payload.type === "task_started")
      active = event.payload.turn_id === turn;
    if (!active) continue;
    if (
      event.type === "response_item" &&
      ["function_call_output", "custom_tool_call_output"].includes(event.payload.type) &&
      "call_id" in event.payload &&
      typeof event.payload.call_id === "string"
    )
      completed.add(event.payload.call_id);
  }
  return tools.some((tool) => tool.endedAt == null && !completed.has(tool.id));
}

export async function reconciliationMetadata(
  transcript: string,
  turn: string,
  proposed: ReconciliationMetadata,
): Promise<ReconciliationMetadata> {
  const file = path.join(turnCaptureDirectory(transcript, turn), TURN_CAPTURE_PLAN);
  try {
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      saved?.root == null ||
      saved?.tools == null ||
      typeof saved.root !== "object" ||
      typeof saved.tools !== "object"
    )
      throw new Error("Invalid reconciliation metadata");
    return saved as ReconciliationMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writePrivateFile(file, JSON.stringify(proposed));
  return proposed;
}
