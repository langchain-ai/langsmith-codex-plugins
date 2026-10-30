import { BACKSLASH_ESCAPE, STRING_ESCAPES } from "../constants.js";

export function unescapeLiteral(literal: string): string {
  return literal.replace(BACKSLASH_ESCAPE, (_, char: string) => STRING_ESCAPES[char] ?? char);
}

export function stringLiterals(program: string, pattern: RegExp): string[] {
  return [...program.matchAll(pattern)]
    .map(([, ...groups]) => groups.find((group) => group !== undefined))
    .filter((literal) => literal !== undefined)
    .map(unescapeLiteral);
}
