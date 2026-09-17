// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only sign of one.

import {
  BACKSLASH_ESCAPE,
  COMMAND_LITERAL,
  QUOTED_RUN,
  READ_COMMAND,
  SHELL_SEGMENT,
  SHELL_TOOL_NAMES,
  SHELL_WORD,
  SKILL_DIR_NAME,
  STRING_ESCAPES,
  WRITES_TO_FILE,
} from "./constants.js";

// Split rather than match: one pattern spanning `/skills/<name>/SKILL.md` backtracks for seconds.
function skillDirectoryInPath(word: string): string | undefined {
  const parts = word.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== "SKILL.md" || name == null || !SKILL_DIR_NAME.test(name)) return undefined;
  return parts.slice(0, -2).includes("skills") ? name : undefined;
}

// Codex 0.153+ sends a JS program that may call exec_command more than once; before that, `{cmd}`.
function shellCommands(args: unknown): string[] {
  if (typeof args !== "string") {
    const cmd = (args as { cmd?: unknown } | undefined)?.cmd;
    return typeof cmd === "string" ? [cmd] : [];
  }
  return [...args.matchAll(COMMAND_LITERAL)].map(([, double, single, backtick]) =>
    (double ?? single ?? backtick).replace(
      BACKSLASH_ESCAPE,
      (_, char: string) => STRING_ESCAPES[char] ?? char,
    ),
  );
}

// Gate each segment on its own: a `cat` in one command must not excuse a `git diff` in the next.
export function skillNamesFromToolCall(toolName: string | undefined, args: unknown): string[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const segments = shellCommands(args).flatMap((command) => command.match(SHELL_SEGMENT) ?? []);

  const names = new Set<string>();
  for (const segment of segments) {
    const unquoted = segment.replace(QUOTED_RUN, " ");
    if (!READ_COMMAND.test(segment) || WRITES_TO_FILE.test(unquoted)) continue;
    for (const word of segment.match(SHELL_WORD) ?? []) {
      const name = skillDirectoryInPath(word);
      if (name != null) names.add(name);
    }
  }
  return [...names];
}
