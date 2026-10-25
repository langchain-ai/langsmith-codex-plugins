import { shouldShowNotice } from "@langchain/plugins-base/plugin";
import { LS_INTEGRATION } from "./constants.js";
import type { Config } from "./models/config.js";
import type { Notice } from "./models/notices.js";
import { engineStorageRoot } from "./tracing-engine.js";

export async function showNotices(
  home: string,
  config: Config,
  notices: readonly Notice[],
): Promise<string[]> {
  const shown: string[] = [];
  for (const { kind, text } of notices) {
    const show = await shouldShowNotice({
      plugin: LS_INTEGRATION,
      kind,
      cooldown: config.notice_cooldown,
      storageRoot: engineStorageRoot(home),
    });
    if (show) shown.push(text);
  }
  return shown;
}
