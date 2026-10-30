import { randomUUID } from "node:crypto";
import type { TraceConversionOptions, TraceInput } from "../../src/models/trace-conversion.js";
import { convertToRunTree as convert } from "../../src/trace.js";

export function convertToRunTree(input: TraceInput, options: Partial<TraceConversionOptions> = {}) {
  return convert(input, { captureRun: (run) => run.postRun(), nextRunId: randomUUID, ...options });
}
