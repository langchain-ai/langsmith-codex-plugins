import { BACKSLASH_ESCAPE, STRING_ESCAPES } from "../constants.js";

export function stringLiterals(program: string, pattern: RegExp): string[] {
  return [...program.matchAll(pattern)].map(([, double, single, backtick]) =>
    (double ?? single ?? backtick).replace(
      BACKSLASH_ESCAPE,
      (_, char: string) => STRING_ESCAPES[char] ?? char,
    ),
  );
}
