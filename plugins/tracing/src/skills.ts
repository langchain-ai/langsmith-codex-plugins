// Skill detection for Codex rollouts.
//
// Codex has no skill tool, so reading `.../skills/<name>/SKILL.md` is the only
// sign of a skill. Everything here parses the shell command that did the read.

// Codex 0.153+ calls the shell tool `exec`; older versions call it `exec_command`.
const SHELL_TOOL_NAMES = new Set(["exec", "exec_command"]);

// A shell word: no whitespace, no quotes.
const SHELL_WORD = /[^\s"']+/g;
const SKILL_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Anchored, so a read verb inside a path argument is not mistaken for the command.
const READ_COMMAND =
  /^\s*(?:\S*\/)?(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;

// The segment rewrites the file rather than reading it.
// The digit guard spares `2>/dev/null`.
const WRITES_TO_FILE = /(?<![-=<>!0-9])>>?\s*\S|\bsed\b[^\n]*\s-i\b/;

// Quoted runs are data, not syntax: `grep '>' file` redirects nothing.
const QUOTED_RUN = /"[^"]*"|'[^']*'/g;

// The `cmd:` string of one exec_command call, in double, single or backtick quotes.
const COMMAND_LITERAL =
  /\bcmd["']?\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|`((?:[^`\\]|\\[\s\S])*)`)/g;

// The literal is source text, so `\n` between two commands arrives as two characters.
const BACKSLASH_ESCAPE = /\\([\s\S])/g;
const STRING_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

// One command per run of non-separator characters.
// A separator inside quotes does not split.
const SHELL_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;|&\n"'])+/g;

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
