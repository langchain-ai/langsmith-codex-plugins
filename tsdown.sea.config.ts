// Builds a Node SEA: a copy of the `node` binary with the hook bundle appended.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsdown";

const MINIMUM_NODE = { major: 25, minor: 5 };

// Windows needs its own suffix and signing story, so only darwin-arm64 is built.
const SUPPORTED_TARGET = "darwin-arm64";

const buildTarget = `${os.platform()}-${os.arch()}`;

function assertBuildHostIsSupported() {
  const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
  if (
    nodeMajor < MINIMUM_NODE.major ||
    (nodeMajor === MINIMUM_NODE.major && nodeMinor < MINIMUM_NODE.minor)
  ) {
    throw new Error(
      `Building the SEA requires Node.js >= ${MINIMUM_NODE.major}.${MINIMUM_NODE.minor}.0 for --build-sea, got ${process.versions.node}.`,
    );
  }

  if (buildTarget !== SUPPORTED_TARGET) {
    throw new Error(
      `Unsupported SEA build target: ${buildTarget}, only ${SUPPORTED_TARGET} is built`,
    );
  }
}

function moveToRepoRoot() {
  process.chdir(fileURLToPath(new URL("./", import.meta.url)));
}

function readPluginVersion(pluginRoot: string) {
  // Mirrored in vitest.config.ts so tests see the same version.
  return JSON.parse(readFileSync(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf-8"))
    .version as string;
}

async function bundleHookAsCommonJs(pluginRoot: string, pluginVersion: string) {
  console.log(`[sea] 1/3 bundling the hook into one CommonJS file for ${buildTarget}`);

  // A SEA holds exactly one CommonJS file, so this bundle is separate from the ESM one Codex loads.
  await build({
    config: false,
    entry: [path.join(pluginRoot, "src", "index.ts")],
    format: "cjs",
    platform: "node",
    outDir: path.join(pluginRoot, "bundle"),
    outputOptions: { entryFileNames: "sea.cjs" },
    dts: false,
    deps: {
      // The SEA has no node_modules, so the regex bundles subpath imports too.
      alwaysBundle: [/^langsmith(\/.*)?$/, /^zod(\/.*)?$/],
      onlyBundle: false,
    },
    define: {
      __LS_INTEGRATION_VERSION__: JSON.stringify(pluginVersion),
    },
    clean: true,
  });
}

async function injectBundleIntoNodeBinary() {
  console.log("[sea] 2/3 injecting the bundle into a copy of the Node binary");

  const seaSettings = JSON.parse(readFileSync("sea-config.json", "utf-8"));
  const seaBinary = path.resolve(seaSettings.output);

  await fs.mkdir(path.dirname(seaBinary), { recursive: true });
  await fs.rm(seaBinary, { force: true });

  const tempSettingsDir = await fs.mkdtemp(path.join(os.tmpdir(), "langsmith-codex-sea-"));
  try {
    // --build-sea resolves these against its own cwd, so hand it absolute paths.
    const absoluteSeaSettings = {
      ...seaSettings,
      main: path.resolve(seaSettings.main),
      output: seaBinary,
    };
    const absoluteSettingsPath = path.join(tempSettingsDir, "sea-config.json");
    await fs.writeFile(absoluteSettingsPath, `${JSON.stringify(absoluteSeaSettings, null, 2)}\n`);
    execFileSync(process.execPath, ["--build-sea", absoluteSettingsPath], { stdio: "inherit" });
  } finally {
    await fs.rm(tempSettingsDir, { force: true, recursive: true });
  }

  return seaBinary;
}

function signAdHoc(seaBinary: string) {
  console.log("[sea] 3/3 applying an ad-hoc signature");

  // macOS will not run a freshly injected SEA unsigned, and an ad-hoc signature needs no credentials.
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", seaBinary], { stdio: "inherit" });
}

assertBuildHostIsSupported();
moveToRepoRoot();

const pluginRoot = path.resolve("plugins", "tracing");
const pluginVersion = readPluginVersion(pluginRoot);

await bundleHookAsCommonJs(pluginRoot, pluginVersion);
const seaBinary = await injectBundleIntoNodeBinary();
signAdHoc(seaBinary);

console.log(
  `[sea] built the ${buildTarget} binary ${seaBinary} (${statSync(seaBinary).size} bytes)`,
);
