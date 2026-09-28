import * as fs from "node:fs/promises";

import { binary } from "./binary.ts";
import { STANDALONE_BINARY_WARNING_MARKER_SUFFIX } from "./binary-constants.ts";
import { standaloneBinaryWarning } from "./messages.ts";

export async function warnOnceAboutStandaloneBinary(
  registered: string | undefined,
): Promise<string | undefined> {
  const marker = `${binary.installedBinaryPath()}${STANDALONE_BINARY_WARNING_MARKER_SUFFIX}`;
  if (registered === undefined) {
    await fs.rm(marker, { force: true }).catch(() => undefined);
    return undefined;
  }
  const recorded = await fs.writeFile(marker, "", { flag: "wx" }).then(
    () => true,
    () => false,
  );
  return recorded ? standaloneBinaryWarning(registered) : undefined;
}
