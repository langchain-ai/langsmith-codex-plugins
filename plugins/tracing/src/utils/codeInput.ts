import { isRecord } from "./isRecord.js";

type CodeInput = { code: string; language: "shell" | "python" | "javascript" };

function shellWords(command: string): string[] | undefined {
  const words: string[] = [];
  let word = "";
  let quote = "";
  let started = false;
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (char === quote) {
      quote = "";
    } else if (quote === "'") {
      word += char;
    } else if (char === "\\") {
      const next = command[++i];
      if (next == null) return;
      if (quote === '"' && !'$`"\\\n'.includes(next)) word += "\\";
      if (next !== "\n") word += next;
    } else if (char === "$" || char === "`" || (!quote && /[|&;<>()[\]{}*?~#\n\r]/.test(char))) {
      return;
    } else if (quote) {
      word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (/\s/.test(char)) {
      if (started) words.push(word);
      word = "";
      started = false;
      continue;
    } else {
      word += char;
    }
    started = true;
  }
  if (quote) return;
  if (started) words.push(word);
  return words;
}

function inlineCode(words: string[], depth = 0): CodeInput | undefined {
  if (depth > 4) return;
  let index = 0;
  while (/^[A-Za-z_][A-Za-z_0-9]*=/.test(words[index] ?? "")) index++;
  const executable = words[index++]?.split("/").at(-1);
  if (executable === "env" || executable === "command" || executable === "exec") {
    if (words[index] === "--") index++;
    return inlineCode(words.slice(index), depth + 1);
  }
  const python = /^python(?:\d+(?:\.\d+)*)?$/.test(executable ?? "");
  const node = executable === "node" || executable === "nodejs";
  const shell = /^(?:ba|da|z|k)?sh$/.test(executable ?? "");
  if (!python && !node && !shell) return;
  for (; index < words.length; index++) {
    const option = words[index]!;
    if (option === "--" || !option.startsWith("-")) return;
    if (shell && /^-[abefhkmnptuvxBCEHPTls]*c[abefhkmnptuvxBCEHPTls]*$/.test(option)) {
      if (words[index + 1] === "--") index++;
      if (words.length !== index + 2) return;
      const command = words[index + 1];
      const nested = command == null ? undefined : shellWords(command);
      return nested == null ? undefined : inlineCode(nested, depth + 1);
    }
    let code: string | undefined;
    if (python && option.startsWith("-c")) {
      code = option.length > 2 ? option.slice(2) : words[index + 1];
    } else if (node && /^(?:-[ep]|--eval|--print)$/.test(option)) {
      code = words[index + 1];
    } else if (node && /^(?:-[ep].+|--(?:eval|print)=)/.test(option)) {
      code = option.startsWith("--") ? option.slice(option.indexOf("=") + 1) : option.slice(2);
    }
    if (code != null) return { code, language: python ? "python" : "javascript" };
    if (python && /^-[BEIuOsqv]+$/.test(option)) continue;
    if (
      node &&
      /^(?:--(?:no-warnings|enable-source-maps)|--input-type=(?:module|commonjs))$/.test(option)
    )
      continue;
    if (shell && /^-[abefhkmnptuvxBCEHPTls]+$/.test(option)) continue;
    return;
  }
}

export function toolCodeInput(name: string | undefined, args: unknown): CodeInput | undefined {
  if (!/^(?:exec_command|shell_command|shell|local_shell_call)$/.test(name ?? "")) return;
  if (!isRecord(args)) return;
  const command = args.cmd ?? args.command;
  if (typeof command === "string") {
    const words = shellWords(command);
    return (words && inlineCode(words)) ?? { code: command, language: "shell" };
  }
  if (
    Array.isArray(command) &&
    command.length > 0 &&
    command.every((word) => typeof word === "string")
  ) {
    return (
      inlineCode(command) ?? {
        code: command
          .map((word) => (/^[\w./=-]+$/.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`))
          .join(" "),
        language: "shell",
      }
    );
  }
}
