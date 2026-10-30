import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { ReconstructionToolOrigin } from "@langchain/plugins-base/tracing/reconstruction";
import { PATCH_FILE_PATTERN, TOOL_PATH_INPUT_KEYS, WORKDIR_LITERAL } from "./constants.js";
import { customToolInput, stringLiterals } from "./utils/customToolInput.js";
import { isRecord } from "./utils/isRecord.js";

export function toolOriginFromArgs(
  toolArgs: unknown,
  cwd: string | undefined,
): ReconstructionToolOrigin {
  const session = cwd === undefined ? {} : { cwd };
  const args = customToolInput(toolArgs);
  const named =
    typeof args === "string"
      ? [
          ...[...args.matchAll(PATCH_FILE_PATTERN)].map((match) => match[1]),
          ...stringLiterals(args, WORKDIR_LITERAL),
        ]
      : isRecord(args)
        ? TOOL_PATH_INPUT_KEYS.map((key) => args[key])
        : [];
  let namedAPath = false;
  let fallback: string | undefined;
  for (const value of named) {
    if (typeof value !== "string" || value.length === 0) continue;
    namedAPath = true;
    if (isAbsolute(value)) {
      if (existsSync(value)) return { path: value, namedAPath, ...session };
      fallback ??= value;
      continue;
    }
    if (!cwd || !isAbsolute(cwd)) continue;
    const resolved = resolve(cwd, value);
    let nearest = resolved;
    while (!existsSync(nearest) && dirname(nearest) !== nearest) nearest = dirname(nearest);
    if (nearest === resolved) return { path: resolved, namedAPath, ...session };
    fallback ??= nearest;
  }
  return fallback === undefined
    ? { namedAPath, ...session }
    : { path: fallback, namedAPath, ...session };
}
