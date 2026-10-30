// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only sign of one.

import {
  BACKSLASH_ESCAPE,
  CHANGE_DIRECTORY,
  COMMAND_LITERAL,
  COMMAND_PREFIX,
  MAX_SHELL_WRAP_DEPTH,
  QUOTED_RUN,
  READ_COMMAND,
  SHELL_SEGMENT,
  SHELL_TOOL_NAMES,
  SHELL_WORD,
  SHELL_WRAPPER,
  SKILL_CONTAINER_DIRS,
  SKILL_DIR_NAME,
  SKILL_FILE_NAME,
  STRING_ESCAPES,
  SYSTEM_SKILL_DIR,
  WRITES_TO_FILE,
} from "./constants.js";
import type { ToolCallRecord } from "./models/rollout.js";
import { customToolInput } from "./utils/customToolInput.js";

function placedIn(directory: string | undefined, word: string): string {
  return directory == null ? word : `${directory}/${word}`;
}

// Split rather than match: one pattern spanning `/skills/<name>/SKILL.md` backtracks for seconds.
function skillDirectoryInPath(word: string): string | undefined {
  const parts = word.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== SKILL_FILE_NAME || name == null || !SKILL_DIR_NAME.test(name))
    return undefined;
  const container = parts.at(-3);
  if (container != null && SKILL_CONTAINER_DIRS.has(container)) return name;
  return container === SYSTEM_SKILL_DIR && parts.at(-4) === "skills" ? name : undefined;
}

function wrappedCommand(segment: string): string | undefined {
  const prefix = SHELL_WRAPPER.exec(segment);
  if (prefix == null) return undefined;
  const rest = segment.slice(prefix[0].length).trim();
  const quote = rest.at(0);
  return (quote === '"' || quote === "'") && rest.length > 1 && rest.at(-1) === quote
    ? rest.slice(1, -1)
    : rest;
}

// Codex 0.153+ sends a JS program that may call exec_command more than once; before that, `{cmd}`.
function shellCommands(toolArgs: unknown): string[] {
  const args = customToolInput(toolArgs);
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
function collectSkillNames(
  command: string,
  shell: { directory: string | undefined },
  names: Set<string>,
  depth: number,
) {
  for (const segment of command.match(SHELL_SEGMENT) ?? []) {
    const inner = depth < MAX_SHELL_WRAP_DEPTH ? wrappedCommand(segment) : undefined;
    if (inner != null) {
      collectSkillNames(inner, shell, names, depth + 1);
      continue;
    }
    const target = CHANGE_DIRECTORY.exec(segment);
    if (target != null) {
      shell.directory = placedIn(shell.directory, target[1] ?? target[2] ?? target[3]);
      continue;
    }
    const read = segment.replace(COMMAND_PREFIX, "");
    if (!READ_COMMAND.test(read) || WRITES_TO_FILE.test(read.replace(QUOTED_RUN, " "))) continue;
    for (const word of read.match(SHELL_WORD) ?? []) {
      const name = skillDirectoryInPath(placedIn(shell.directory, word));
      if (name != null) names.add(name);
    }
  }
}

export function skillNamesFromToolCall(toolName: string | undefined, args: unknown): string[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const names = new Set<string>();
  for (const command of shellCommands(args)) {
    collectSkillNames(command, { directory: undefined }, names, 0);
  }
  return [...names];
}

function commandFailed(toolCall: ToolCallRecord): boolean {
  const exitCode = toolCall.outputs.exit_code;
  return toolCall.error != null || (typeof exitCode === "number" && exitCode !== 0);
}

function commandText(toolCall: ToolCallRecord): string {
  const { command } = toolCall.outputs;
  return Array.isArray(command) ? command.join(" ") : String(command ?? "");
}

// A script's own commands are logged as separate records, so match them to the skill by their text.
export function skillReadSucceeded(
  skillName: string,
  call: ToolCallRecord,
  calls: Record<string, ToolCallRecord>,
): boolean {
  const reads = Object.values(calls).filter((record) => {
    const text = commandText(record);
    return (
      text.includes(SKILL_FILE_NAME) &&
      (text.includes(`/${skillName}`) || text.includes(`\\${skillName}`))
    );
  });
  return reads.length > 0 ? reads.some((read) => !commandFailed(read)) : !commandFailed(call);
}
