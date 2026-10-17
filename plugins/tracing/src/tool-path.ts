import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { ReconstructionToolOrigin } from "@langchain/plugins-base/tracing/reconstruction";
import { PATCH_FILE_PATTERN, TOOL_PATH_INPUT_KEYS } from "./constants.js";
import { isRecord } from "./utils/isRecord.js";

export function toolOriginFromArgs(
  args: unknown,
  cwd: string | undefined,
): ReconstructionToolOrigin {
  const session = cwd === undefined ? {} : { cwd };
  const named =
    typeof args === "string"
      ? [PATCH_FILE_PATTERN.exec(args)?.[1]]
      : isRecord(args)
        ? TOOL_PATH_INPUT_KEYS.map((key) => args[key])
        : [];
  let namedAPath = false;
  for (const value of named) {
    if (typeof value !== "string" || value.length === 0) continue;
    namedAPath = true;
    if (isAbsolute(value)) return { path: value, namedAPath, ...session };
    if (!cwd || !isAbsolute(cwd)) continue;
    const resolved = resolve(cwd, value);
    if (existsSync(resolved)) return { path: resolved, namedAPath, ...session };
  }
  return { namedAPath, ...session };
}
