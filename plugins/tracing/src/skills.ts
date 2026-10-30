// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only sign of one.

import {
  ANCHORED_PATH,
  BACKSLASH_ESCAPE,
  CHANGE_DIRECTORY,
  COMMAND_LITERAL,
  MAX_TRACKED_DIRECTORY_PARTS,
  QUOTED_RUN,
  READ_COMMAND,
  RUNNER_PREFIX,
  SHELL_SEGMENT,
  SHELL_TOOL_NAMES,
  SHELL_WORD,
  SHELL_WRAPPER,
  SKILL_DIR_NAME,
  SKILL_FILE_NAME,
  SKILL_PARENT_DIRS,
  SKILLS_DIR,
  STRING_ESCAPES,
  SYSTEM_SKILL_DIR,
  TRUNCATED_DIRECTORY,
  WRITES_TO_FILE,
} from "./constants.js";
import type { SkillRead, ToolCallRecord, TypedSkill } from "./models/rollout.js";
import type { TimeWindow } from "./models/trace-conversion.js";
import { customToolInput } from "./utils/customToolInput.js";
import { normalizedPath } from "./utils/skillPaths.js";

// Split rather than match: one pattern spanning `/skills/<name>/SKILL.md` backtracks for seconds.
function skillDirectoryInPath(word: string): string | undefined {
  const parts = word.split(/[/\\]/);
  const name = parts.at(-2);
  if (parts.at(-1) !== SKILL_FILE_NAME || name == null || !SKILL_DIR_NAME.test(name))
    return undefined;
  const container = parts.at(-3);
  if (container != null && SKILL_PARENT_DIRS.has(container)) return name;
  return container === SYSTEM_SKILL_DIR && parts.at(-4) === SKILLS_DIR ? name : undefined;
}

function wrappedCommand(segment: string): string | undefined {
  const prefix = SHELL_WRAPPER.exec(segment);
  if (prefix == null) return undefined;
  const rest = segment.slice(prefix[0].length).trim();
  return rest.length > 1 && rest.at(-1) === rest.at(0) ? rest.slice(1, -1) : undefined;
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

function resolveDirectory(base: string[] | undefined, target: string): string[] {
  const stack = ANCHORED_PATH.test(target) ? [] : [...(base ?? [])];
  for (const part of target.split(/[/\\]/)) {
    if (part === "..") {
      stack.pop();
    } else if (part !== "." && (part !== "" || stack.length === 0)) {
      stack.push(part);
    }
  }
  return stack.length > MAX_TRACKED_DIRECTORY_PARTS
    ? [TRUNCATED_DIRECTORY, ...stack.slice(1 - MAX_TRACKED_DIRECTORY_PARTS)]
    : stack;
}

function placedIn(directory: string[] | undefined, word: string): string {
  return directory == null || ANCHORED_PATH.test(word) ? word : [...directory, word].join("/");
}

// Gate each segment on its own: a `cat` in one command must not excuse a `git diff` in the next.
function collectSkillReads(
  command: string,
  directory: string[] | undefined,
  nameByPath: Map<string, string>,
) {
  let current = directory;
  for (const [, segment, separator] of command.matchAll(SHELL_SEGMENT)) {
    const inner = wrappedCommand(segment);
    if (inner != null) {
      collectSkillReads(inner, current, nameByPath);
      continue;
    }
    const target = CHANGE_DIRECTORY.exec(segment);
    if (target != null) {
      if (separator === "&&")
        current = resolveDirectory(current, target[1] ?? target[2] ?? target[3]);
      continue;
    }
    const read = segment.replace(RUNNER_PREFIX, "");
    if (!READ_COMMAND.test(read) || WRITES_TO_FILE.test(read.replace(QUOTED_RUN, " "))) continue;
    for (const word of read.match(SHELL_WORD) ?? []) {
      const path = placedIn(current, word);
      const name = skillDirectoryInPath(path);
      if (name != null) nameByPath.set(path, name);
    }
  }
}

export function skillReadsFromToolCall(toolName: string | undefined, args: unknown): SkillRead[] {
  if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];

  const readsByName = new Map<string, SkillRead>();
  for (const command of shellCommands(args)) {
    const nameByPath = new Map<string, string>();
    collectSkillReads(command, undefined, nameByPath);
    for (const [path, name] of nameByPath) {
      const read = readsByName.get(name) ?? { name, paths: [], commands: [] };
      if (!read.paths.includes(path)) read.paths.push(path);
      if (!read.commands.includes(command)) read.commands.push(command);
      readsByName.set(name, read);
    }
  }
  return [...readsByName.values()];
}

export function typedSkillCoversRead(
  typedSkills: TypedSkill[],
  read: SkillRead,
  home: string,
  cwd: string | undefined,
): boolean {
  return typedSkills.some((typed) => {
    const typedPath = normalizedPath(typed.path, home, cwd);
    return read.paths.some((path) => {
      const readPath = normalizedPath(path, home, cwd);
      const unplaced = readPath.split("/").includes(TRUNCATED_DIRECTORY);
      return readPath === typedPath || (unplaced && read.name === typed.name);
    });
  });
}

function commandFailed(toolCall: ToolCallRecord): boolean {
  const exitCode = toolCall.outputs.exit_code;
  return toolCall.error != null || (typeof exitCode === "number" && exitCode !== 0);
}

function ranCommand(record: ToolCallRecord, commands: string[]): boolean {
  const { command } = record.outputs;
  const text = Array.isArray(command) ? command.at(-1) : command;
  return typeof text === "string" && commands.includes(text);
}

export function skillReadSucceeded(
  read: SkillRead,
  call: ToolCallRecord,
  calls: Record<string, ToolCallRecord>,
  window: TimeWindow,
): boolean {
  const records = Object.values(calls).filter(
    (record) =>
      ranCommand(record, read.commands) &&
      record.timings.some((time) => time >= window.min && time <= window.max),
  );
  const outcomes = read.commands.flatMap((command) => {
    const ran = records.filter((record) => ranCommand(record, [command]));
    return ran.length > 0 ? [ran.every((record) => !commandFailed(record))] : [];
  });
  return outcomes.length > 0 ? outcomes.some(Boolean) : !commandFailed(call);
}
