import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_ARCHES = ["arm64", "x64"] as const;
type Arch = (typeof SUPPORTED_ARCHES)[number];

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(repoRoot, "plugins", "tracing");

function requestedArches(argv: string[]): Arch[] {
  const flag = argv.find((arg) => arg.startsWith("--arch="))?.slice("--arch=".length);
  if (!flag) return [process.arch === "x64" ? "x64" : "arm64"];
  if (flag === "all") return [...SUPPORTED_ARCHES];
  if ((SUPPORTED_ARCHES as readonly string[]).includes(flag)) return [flag as Arch];
  throw new Error(
    `Unsupported --arch=${flag}, expected one of ${SUPPORTED_ARCHES.join(", ")}, all`,
  );
}

function readPluginVersion(): string {
  return JSON.parse(readFileSync(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf-8"))
    .version as string;
}

function outputPath(arch: Arch): string {
  const { output } = JSON.parse(readFileSync(path.join(repoRoot, "sea-config.json"), "utf-8"));
  const base = path.join(repoRoot, output);
  return arch === process.arch ? base : `${base}-darwin-${arch}`;
}

async function compile(arch: Arch, version: string, binary: string) {
  console.log(`[sea] 1/3 compiling the hook into a darwin-${arch} binary`);

  await fs.mkdir(path.dirname(binary), { recursive: true });
  await fs.rm(binary, { force: true });
  execFileSync(
    "bun",
    [
      "build",
      "--compile",
      `--target=bun-darwin-${arch}`,
      "--minify",
      "--define",
      `__LS_INTEGRATION_VERSION__=${JSON.stringify(version)}`,
      path.join(pluginRoot, "src", "index.ts"),
      "--outfile",
      binary,
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

function signAdHoc(binary: string) {
  console.log("[sea] 2/3 applying an ad-hoc signature");

  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", binary], { stdio: "inherit" });
}

function checkReportedVersion(binary: string, arch: Arch, version: string) {
  if (arch !== process.arch) {
    console.log(`[sea] 3/3 skipping the version check, darwin-${arch} is not this host`);
    return;
  }
  console.log("[sea] 3/3 checking the binary reports the plugin version");

  const reported = execFileSync(binary, ["--version"], { encoding: "utf8" }).trim();
  if (reported !== version) {
    throw new Error(
      `The built binary reports version ${reported}, but plugin.json declares ${version}`,
    );
  }
}

if (process.platform !== "darwin") {
  throw new Error(`Unsupported build host ${process.platform}, only darwin is built`);
}

const arches = requestedArches(process.argv.slice(2));
const version = readPluginVersion();

for (const arch of arches) {
  const binary = outputPath(arch);
  await compile(arch, version, binary);
  signAdHoc(binary);
  checkReportedVersion(binary, arch, version);
  console.log(
    `[sea] built the darwin-${arch} binary ${binary} (${statSync(binary).size} bytes, version ${version})`,
  );
}
