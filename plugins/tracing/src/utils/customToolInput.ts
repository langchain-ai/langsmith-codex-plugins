import { BACKSLASH_ESCAPE, STRING_ESCAPES, TOOL_OUTPUT_ENVELOPE_KEYS } from "../constants.js";
import { isRecord } from "./isRecord.js";

export function customToolInput(args: unknown): unknown {
  return isRecord(args) && Object.keys(args).length === 1 && typeof args.input === "string"
    ? args.input
    : args;
}

function parsedRecord(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function toolOutputText(value: unknown): string {
  const record = typeof value === "string" ? parsedRecord(value) : value;
  if (
    isRecord(record) &&
    typeof record.output === "string" &&
    Object.keys(record).every((key) => TOOL_OUTPUT_ENVELOPE_KEYS.includes(key))
  ) {
    const metadata = isRecord(record.metadata) ? record.metadata : {};
    const exitCode = record.exit_code ?? metadata.exit_code;
    return exitCode == null || exitCode === 0
      ? record.output
      : `${record.output.trimEnd()}\n\nExit code: ${String(exitCode)}`;
  }
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function stringLiterals(program: string, pattern: RegExp): string[] {
  return [...program.matchAll(pattern)].map(([, double, single, backtick]) =>
    (double ?? single ?? backtick).replace(
      BACKSLASH_ESCAPE,
      (_, char: string) => STRING_ESCAPES[char] ?? char,
    ),
  );
}
