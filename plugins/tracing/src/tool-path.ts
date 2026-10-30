import { isAbsolute, resolve } from "node:path";
import { rootFromGitMarker } from "@langchain/plugins-base/git";
import type { ReconstructionToolOrigin } from "@langchain/plugins-base/tracing/reconstruction";
import {
  MAX_NAMED_PATHS,
  MAX_PATH_LENGTH,
  PATCH_FILE_PATTERN,
  PATCH_START,
  TOOL_INPUT_SCAN_LIMIT,
  TOOL_PATH_INPUT_KEYS,
} from "./constants.js";
import { customToolInput } from "./utils/customToolInput.js";
import { isRecord } from "./utils/isRecord.js";
import { programPaths } from "./utils/programPaths.js";

function namedValues(args: unknown): unknown[] {
  if (typeof args === "string") {
    if (args.length > TOOL_INPUT_SCAN_LIMIT) return [];
    return args.trimStart().startsWith(PATCH_START)
      ? [...args.matchAll(PATCH_FILE_PATTERN)].map(([, file]) => file)
      : programPaths(args);
  }
  return isRecord(args) ? TOOL_PATH_INPUT_KEYS.map((key) => args[key]) : [];
}

export function toolOriginFromArgs(
  toolArgs: unknown,
  cwd: string | undefined,
): ReconstructionToolOrigin {
  const session = cwd === undefined ? {} : { cwd };
  try {
    const named = namedValues(customToolInput(toolArgs))
      .slice(0, MAX_NAMED_PATHS)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const paths: string[] = [];
    for (const value of named) {
      const candidate = isAbsolute(value)
        ? value
        : cwd && isAbsolute(cwd)
          ? resolve(cwd, value)
          : undefined;
      if (candidate !== undefined && candidate.length <= MAX_PATH_LENGTH) paths.push(candidate);
    }
    const path =
      paths.find((candidate) => typeof rootFromGitMarker(candidate) === "string") ?? paths[0];
    return { ...(path === undefined ? {} : { path }), namedAPath: named.length > 0, ...session };
  } catch {
    return { namedAPath: false, ...session };
  }
}
