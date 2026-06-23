import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// Inject the plugin version at build time (no runtime package.json in the
// bundle). Mirrored in vitest.config.ts.
const pluginVersion = JSON.parse(
  readFileSync(path.join(import.meta.dirname, ".codex-plugin", "plugin.json"), "utf-8"),
).version as string;

export default defineConfig({
  deps: {
    alwaysBundle: ["langsmith", "zod"],
    onlyBundle: false,
  },
  define: {
    __LS_INTEGRATION_VERSION__: JSON.stringify(pluginVersion),
  },
  clean: true,
});
