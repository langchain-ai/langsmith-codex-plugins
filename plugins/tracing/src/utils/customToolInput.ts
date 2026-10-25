import { isRecord } from "./isRecord.js";

export function customToolInput(args: unknown): unknown {
  return isRecord(args) && Object.keys(args).length === 1 && typeof args.input === "string"
    ? args.input
    : args;
}
