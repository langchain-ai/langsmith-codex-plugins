import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { TracingHookInput } from "./models/tracing-hook.js";
import type { CaptureRedactor, CapturedTool } from "./models/tool-capture.js";
import type { TurnMode } from "./tracing-policy.js";
import {
  TOOL_CAPTURE_END_SUFFIX,
  TOOL_CAPTURE_FILE_PATTERN,
  TOOL_CAPTURE_START_SUFFIX,
  TURN_CAPTURE_SUFFIX,
} from "./tool-capture-constants.js";

export function turnCaptureDirectory(transcript: string, turn: string) {
  return `${transcript}${TURN_CAPTURE_SUFFIX}${createHash("sha256").update(turn).digest("hex")}`;
}

export async function recordToolHook(
  input: TracingHookInput,
  mode: TurnMode,
  redact?: CaptureRedactor,
): Promise<CapturedTool | undefined> {
  if (mode === "off" || !input.tool_use_id || !input.tool_name) return undefined;
  const directory = turnCaptureDirectory(input.transcript_path, input.turn_id);
  const key = createHash("sha256").update(input.tool_use_id).digest("hex");
  const startFile = path.join(directory, `${key}${TOOL_CAPTURE_START_SUFFIX}`);
  const endFile = path.join(directory, `${key}${TOOL_CAPTURE_END_SUFFIX}`);
  let start = await readRecord(startFile);
  if (!start) {
    const values = {
      id: input.tool_use_id,
      name: input.tool_name,
      startedAt: Date.now(),
      mode,
      ...(mode === "full" ? { input: redact ? redact(input.tool_input) : input.tool_input } : {}),
    };
    start = await writeFirst(startFile, values);
  }
  if (input.hook_event_name === "PostToolUse") {
    let end = await readRecord(endFile);
    if (!end) {
      const values = {
        id: input.tool_use_id,
        name: input.tool_name,
        startedAt: start.startedAt,
        endedAt: Date.now(),
        mode: start.mode,
        ...(start.mode === "full"
          ? {
              input: Object.hasOwn(start, "input")
                ? start.input
                : redact
                  ? redact(input.tool_input)
                  : input.tool_input,
              output: redact ? redact(input.tool_response) : input.tool_response,
            }
          : {}),
      };
      end = await writeFirst(endFile, values);
    }
    return { ...start, ...end, startedAt: start.startedAt, endedAt: end.endedAt };
  }
  return start;
}

export async function readCapturedTools(transcript: string, turn: string): Promise<CapturedTool[]> {
  const directory = turnCaptureDirectory(transcript, turn);
  const files = await fs.readdir(directory).catch((error: unknown) => {
    if (isMissing(error)) return [];
    throw error;
  });
  const records = new Map<string, CapturedTool>();
  for (const file of files.filter((name) => TOOL_CAPTURE_FILE_PATTERN.test(name)).sort()) {
    const value = await readRecord(path.join(directory, file));
    if (!value) continue;
    const existing = records.get(value.id);
    records.set(
      value.id,
      existing ? { ...existing, ...value, startedAt: existing.startedAt } : value,
    );
  }
  return [...records.values()].sort((left, right) => left.startedAt - right.startedAt);
}

export async function clearTurnCapture(transcript: string, turn: string) {
  const directory = turnCaptureDirectory(transcript, turn);
  const files = await fs.readdir(directory).catch((error: unknown) => {
    if (isMissing(error)) return [];
    throw error;
  });
  for (const file of files.filter((name) => TOOL_CAPTURE_FILE_PATTERN.test(name))) {
    await fs.unlink(path.join(directory, file));
  }
  await fs.rmdir(directory).catch((error: unknown) => {
    if (!isMissing(error) && !isNotEmpty(error)) throw error;
  });
}

async function writeFirst(file: string, value: CapturedTool): Promise<CapturedTool> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.link(temporary, file);
    } catch (error) {
      if (!isExists(error)) throw error;
    }
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
  const saved = await readRecord(file);
  if (!saved) throw new Error("Tool capture was not saved");
  return saved;
}

async function readRecord(file: string): Promise<CapturedTool | undefined> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.name !== "string" ||
      !Number.isFinite(value.startedAt ?? value.endedAt)
    ) {
      throw new Error("Invalid tool capture");
    }
    return value as unknown as CapturedTool;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return isSystemError(error, "ENOENT");
}

function isExists(error: unknown): boolean {
  return isSystemError(error, "EEXIST");
}

function isNotEmpty(error: unknown): boolean {
  return isSystemError(error, "ENOTEMPTY");
}

function isSystemError(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}
