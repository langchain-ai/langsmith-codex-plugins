import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// Mirror tsdown's build-time __LS_INTEGRATION_VERSION__ define for tests.
const pluginVersion = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "plugins", "tracing", ".codex-plugin", "plugin.json"),
    "utf-8",
  ),
).version as string;

export default defineConfig({
  define: {
    __LS_INTEGRATION_VERSION__: JSON.stringify(pluginVersion),
  },
});
