import {
  APPLY_PATCH_NAME,
  EXEC_COMMAND_NAME,
  PATCH_FILE_PATTERN,
  PROGRAM_TOKEN,
  WORKDIR_KEY,
} from "../constants.js";
import type { ProgramToken } from "../models/program-tokens.js";
import { unescapeLiteral } from "./stringLiterals.js";

function programTokens(program: string): ProgramToken[] {
  return [...program.matchAll(PROGRAM_TOKEN)]
    .map(([text, double, single, backtick]) => ({ text, literal: double ?? single ?? backtick }))
    .filter(({ text }) => !/^\s+$/.test(text) && !text.startsWith("//") && !text.startsWith("/*"));
}

function plainLiteral(token: ProgramToken | undefined): string | undefined {
  return token?.literal === undefined || token.literal.includes("${") ? undefined : token.literal;
}

function isWorkdirKey(token: ProgramToken): boolean {
  return token.text === WORKDIR_KEY || token.literal === WORKDIR_KEY;
}

export function programPaths(program: string): string[] {
  const tokens = programTokens(program);
  const paths: string[] = [];
  let depth = 0;
  let execDepth: number | undefined;
  tokens.forEach((token, index) => {
    const [before, previous, next, value, after] = [
      tokens[index - 2],
      tokens[index - 1],
      tokens[index + 1],
      tokens[index + 2],
      tokens[index + 3],
    ];
    if ("{[(".includes(token.text)) {
      depth++;
      if (token.text === "{" && previous?.text === "(" && before?.text === EXEC_COMMAND_NAME) {
        execDepth = depth;
      }
    } else if ("}])".includes(token.text)) {
      if (depth === execDepth) execDepth = undefined;
      depth--;
    } else if (
      depth === execDepth &&
      isWorkdirKey(token) &&
      (previous?.text === "{" || previous?.text === ",") &&
      next?.text === ":" &&
      (after?.text === "," || after?.text === "}")
    ) {
      const workdir = plainLiteral(value);
      if (workdir !== undefined) paths.push(unescapeLiteral(workdir));
    } else if (
      token.text === APPLY_PATCH_NAME &&
      next?.text === "(" &&
      value?.literal !== undefined
    ) {
      const patch = unescapeLiteral(value.literal);
      paths.push(...[...patch.matchAll(PATCH_FILE_PATTERN)].map(([, file]) => file));
    }
  });
  return paths;
}
