import { defineConfig } from "tsdown";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const aliases = {
  "langsmith/anonymizer": fileURLToPath(import.meta.resolve("langsmith/anonymizer")),
  langsmith: fileURLToPath(import.meta.resolve("langsmith")),
  uuid: fileURLToPath(import.meta.resolve("uuid")),
};

// Inject the plugin version at build time (no runtime package.json in the
// bundle). Mirrored in vitest.config.ts.
const pluginVersion = JSON.parse(
  readFileSync(path.join(import.meta.dirname, ".codex-plugin", "plugin.json"), "utf-8"),
).version as string;

export default defineConfig({
  alias: aliases,
  deps: {
    // Regex so subpath imports (e.g. langsmith/anonymizer) are bundled too; the
    // cached plugin has no node_modules, so nothing may stay external.
    alwaysBundle: [
      /^langsmith(\/.*)?$/,
      /^uuid(\/.*)?$/,
      /^zod(\/.*)?$/,
      /^@langchain\/plugins-base(\/.*)?$/,
    ],
    onlyBundle: false,
  },
  define: {
    __LS_INTEGRATION_VERSION__: JSON.stringify(pluginVersion),
  },
  clean: true,
});
