import { execFileSync } from "node:child_process";
import {
  LAUNCHER_ARGUMENT_SEPARATOR,
  LAUNCHER_AUTOMATED_SUBCOMMANDS,
  LAUNCHER_CODEX_PATTERN,
  LAUNCHER_LINE_PATTERN,
  LAUNCHER_LOOKUP_ARGUMENTS,
  LAUNCHER_LOOKUP_COMMAND,
  LAUNCHER_MAX_ANCESTORS,
} from "../constants.js";
import type { LauncherProcess } from "../models/notices.js";

export function launchedByPerson(
  readProcess: (id: number) => LauncherProcess | undefined = processInfo,
  startId: number = process.ppid,
): boolean {
  let id = startId;
  for (let depth = 0; depth < LAUNCHER_MAX_ANCESTORS && id > 1; depth++) {
    const info = readProcess(id);
    if (info === undefined) return false;
    const codex = info.args.findIndex((arg) => LAUNCHER_CODEX_PATTERN.test(arg));
    if (codex !== -1)
      return !info.args
        .slice(codex + 1)
        .some((arg) => LAUNCHER_AUTOMATED_SUBCOMMANDS.includes(arg));
    id = info.parentId;
  }
  return false;
}

function processInfo(id: number): LauncherProcess | undefined {
  try {
    const line = execFileSync(LAUNCHER_LOOKUP_COMMAND, [...LAUNCHER_LOOKUP_ARGUMENTS, String(id)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = LAUNCHER_LINE_PATTERN.exec(line.trim());
    return match
      ? { parentId: Number(match[1]), args: match[2]!.split(LAUNCHER_ARGUMENT_SEPARATOR) }
      : undefined;
  } catch {
    return undefined;
  }
}
