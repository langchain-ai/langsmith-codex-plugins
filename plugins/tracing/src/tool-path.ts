import { isAbsolute, resolve } from "node:path";
import { rootFromGitMarker } from "@langchain/plugins-base/git";
import type { ReconstructionToolOrigin } from "@langchain/plugins-base/tracing/reconstruction";
import { PATCH_FILE_PATTERN, TOOL_PATH_INPUT_KEYS, WORKDIR_LITERAL } from "./constants.js";
import { customToolInput } from "./utils/customToolInput.js";
import { isRecord } from "./utils/isRecord.js";
import { stringLiterals } from "./utils/stringLiterals.js";

export function toolOriginFromArgs(
  toolArgs: unknown,
  cwd: string | undefined,
): ReconstructionToolOrigin {
  const session = cwd === undefined ? {} : { cwd };
  const args = customToolInput(toolArgs);
  const named =
    typeof args === "string"
      ? [
          ...[...args.matchAll(PATCH_FILE_PATTERN)].map(([, file]) => file),
          ...stringLiterals(args, WORKDIR_LITERAL),
        ]
      : isRecord(args)
        ? TOOL_PATH_INPUT_KEYS.map((key) => args[key])
        : [];
  const paths: string[] = [];
  for (const value of named) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (isAbsolute(value)) paths.push(value);
    else if (cwd && isAbsolute(cwd)) paths.push(resolve(cwd, value));
  }
  const namedAPath = named.some((value) => typeof value === "string" && value.length > 0);
  const path =
    paths.find((candidate) => typeof rootFromGitMarker(candidate) === "string") ?? paths[0];
  return { ...(path === undefined ? {} : { path }), namedAPath, ...session };
}
