// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only sign of one.

import {
  BACKSLASH_ESCAPE,
  COMMAND_LITERAL,
  QUOTED_RUN,
  READ_COMMAND,
  SHELL_SEGMENT,
  SHELL_WRAPPER,
  NON_SKILL_SUBFOLDERS,
  SKILLS_FOLDERS,
  SHELL_TOOL_NAMES,
  SHELL_WORD,
  SKILL_DIR_NAME,
  WRITES_TO_FILE,
} from "./constants.js";
import { customToolInput, stringLiterals } from "./utils/customToolInput.js";

// Split rather than match: one pattern spanning `/skills/<name>/SKILL.md` backtracks for seconds.
function skillDirectoryInPath(word: string): string | undefined {
  const parts = word.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== "SKILL.md" || name == null || !SKILL_DIR_NAME.test(name)) return undefined;
  if (NON_SKILL_SUBFOLDERS.has(name)) return undefined;
  return parts.slice(0, -2).some((part) => SKILLS_FOLDERS.has(part)) ? name : undefined;
}

// Codex 0.153+ sends a JS program that may call exec_command more than once; before that, `{cmd}`.
function shellCommands(toolArgs: unknown): string[] {
  const args = customToolInput(toolArgs);
  if (typeof args !== "string") {
    const cmd = (args as { cmd?: unknown } | undefined)?.cmd;
    return typeof cmd === "string" ? [cmd] : [];
  }
  return stringLiterals(args, COMMAND_LITERAL);
}

function unwrapped(command: string): string {
  const [, double, single] = SHELL_WRAPPER.exec(command) ?? [];
  return double?.replace(BACKSLASH_ESCAPE, "$1") ?? single ?? command;
}

// Gate each segment on its own: a `cat` in one command must not excuse a `git diff` in the next.
export function skillNamesFromToolCall(toolName: string | undefined, args: unknown): string[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const names = new Set<string>();
  for (const command of shellCommands(args)) {
    let folder = "";
    for (const segment of unwrapped(command).match(SHELL_SEGMENT) ?? []) {
      const [verb, target] = segment.match(SHELL_WORD) ?? [];
      if (verb === "cd" && target != null) folder = `${target}/`;
      const unquoted = segment.replace(QUOTED_RUN, " ");
      if (!READ_COMMAND.test(segment) || WRITES_TO_FILE.test(unquoted)) continue;
      for (const word of segment.match(SHELL_WORD) ?? []) {
        const name = skillDirectoryInPath(word.startsWith("/") ? word : folder + word);
        if (name != null) names.add(name);
      }
    }
  }
  return [...names];
}
