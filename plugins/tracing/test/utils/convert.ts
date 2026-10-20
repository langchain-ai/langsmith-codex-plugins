import { randomUUID } from "node:crypto";
import type { TraceConversionOptions } from "../../src/models/trace-conversion.js";
import { convertToRunTree as convert } from "../../src/trace.js";

export function convertToRunTree(
  input: { transcript_path: string; turn_id: string | null },
  options: Partial<TraceConversionOptions> = {},
) {
  return convert(input, { captureRun: (run) => run.postRun(), nextRunId: randomUUID, ...options });
}
