import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanEnvironment } from "./clean-env.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(readFileSync(join(repositoryRoot, "binary.config.json"), "utf8"));
const version = JSON.parse(
  readFileSync(join(repositoryRoot, config.build.versionFile), "utf8"),
).version;
const platform = process.platform === "win32" ? "windows" : process.platform;
const extension = platform === "windows" ? ".exe" : "";
const output = resolve(
  repositoryRoot,
  config.build.outputDirectory,
  `${config.executableName}${extension}`,
);
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync(
  "bun",
  [
    "build",
    "--compile",
    `--target=bun-${platform}-${process.arch}`,
    ...(config.build.minify ? ["--minify"] : []),
    "--define",
    `__LS_INTEGRATION_VERSION__=${JSON.stringify(version)}`,
    resolve(repositoryRoot, config.build.entryPoint),
    "--outfile",
    output,
  ],
  { cwd: repositoryRoot, env: cleanEnvironment("codex-binary-build-"), stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
