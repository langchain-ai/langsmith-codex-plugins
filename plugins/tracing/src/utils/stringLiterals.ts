import { BACKSLASH_ESCAPE, STRING_ESCAPES } from "../constants.js";
import type { QuotedLiteralPattern } from "../models/string-literals.js";

export function stringLiterals(program: string, pattern: QuotedLiteralPattern): string[] {
  return [...program.matchAll(pattern)]
    .filter(([, double, single, backtick]) => (double ?? single ?? backtick) !== undefined)
    .map(([, double, single, backtick]) =>
      (double ?? single ?? backtick)!.replace(
        BACKSLASH_ESCAPE,
        (_, char: string) => STRING_ESCAPES[char] ?? char,
      ),
    );
}
