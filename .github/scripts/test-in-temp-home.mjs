import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanEnvironment } from "./clean-env.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const testPaths = process.argv.slice(2);
const selectedTests = testPaths.length
  ? testPaths
  : ["plugins/tracing/test/tracing-policy.test.ts"];
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", ...selectedTests],
  {
    cwd: repositoryRoot,
    env: cleanEnvironment("codex-tests-", ["CODEX_TEST_BINARY"]),
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
