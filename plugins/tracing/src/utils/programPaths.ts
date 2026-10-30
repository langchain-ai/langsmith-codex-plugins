import {
  APPLY_PATCH_NAME,
  BLOCK_COMMENT_START,
  CLOSE_BRACE,
  CLOSE_PAREN,
  COMMA,
  EXEC_COMMAND_NAME,
  KEY_SEPARATOR,
  LINE_COMMENT_START,
  MEMBER_ACCESS,
  OPEN_BRACE,
  OPEN_PAREN,
  PATCH_FILE_PATTERN,
  PLACEHOLDER_START,
  PLAIN_LITERAL,
  PROGRAM_TOKEN,
  TOOLS_NAMESPACE,
  WHITESPACE_ONLY,
  WORKDIR_KEY,
} from "../constants.js";
import type { ProgramToken } from "../models/program-tokens.js";
import { unescapeLiteral } from "./stringLiterals.js";

function programTokens(program: string): ProgramToken[] {
  const tokens: ProgramToken[] = [];
  for (const [text, double, single, backtick] of program.matchAll(PROGRAM_TOKEN)) {
    const isTrivia =
      WHITESPACE_ONLY.test(text) ||
      text.startsWith(LINE_COMMENT_START) ||
      text.startsWith(BLOCK_COMMENT_START);
    if (!isTrivia) tokens.push({ text, literal: double ?? single ?? backtick });
  }
  return tokens;
}

function plainLiteral(literal: string | undefined): string | undefined {
  return literal === undefined ||
    literal.includes(PLACEHOLDER_START) ||
    !PLAIN_LITERAL.test(literal)
    ? undefined
    : literal;
}

function isToolCall(tokens: ProgramToken[], nameIndex: number, name: string): boolean {
  return (
    tokens[nameIndex]?.text === name &&
    (tokens[nameIndex - 1]?.text !== MEMBER_ACCESS ||
      tokens[nameIndex - 2]?.text === TOOLS_NAMESPACE)
  );
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
    const [previous, next, value, after] = [
      tokens[index - 1],
      tokens[index + 1],
      tokens[index + 2],
      tokens[index + 3],
    ];
    if (token.text === OPEN_BRACE) {
      depth++;
      if (previous?.text === OPEN_PAREN && isToolCall(tokens, index - 2, EXEC_COMMAND_NAME)) {
        execDepth = depth;
      }
    } else if (token.text === CLOSE_BRACE) {
      if (depth === execDepth) execDepth = undefined;
      depth--;
    } else if (
      depth === execDepth &&
      isWorkdirKey(token) &&
      (previous?.text === OPEN_BRACE || previous?.text === COMMA) &&
      next?.text === KEY_SEPARATOR &&
      (after?.text === COMMA || after?.text === CLOSE_BRACE)
    ) {
      const workdir = plainLiteral(value?.literal);
      if (workdir !== undefined) paths.push(unescapeLiteral(workdir));
    } else if (
      isToolCall(tokens, index, APPLY_PATCH_NAME) &&
      next?.text === OPEN_PAREN &&
      after?.text === CLOSE_PAREN
    ) {
      const patch = plainLiteral(value?.literal);
      if (patch === undefined) return;
      for (const [, file] of unescapeLiteral(patch).matchAll(PATCH_FILE_PATTERN)) paths.push(file);
    }
  });
  return paths;
}
