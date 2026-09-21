import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLISHED_ARCHES,
  PUBLISHED_PLATFORM,
  SEA_EXECUTABLE_NAME,
} from "../plugins/tracing/src/sea-constants.ts";

const MACH_O_ARCHES: Record<string, string> = { arm64: "arm64", x64: "x86_64" };

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(repoRoot, "plugins", "tracing");
const binDirectory = path.join(pluginRoot, "bin");

export function requestedArches(argv: string[]): string[] {
  const flag = argv.find((arg) => arg.startsWith("--arch="))?.slice("--arch=".length);
  if (flag === "all") return [...PUBLISHED_ARCHES];
  const arch = flag ?? process.arch;
  if (!PUBLISHED_ARCHES.includes(arch)) {
    throw new Error(
      `Unsupported architecture ${arch}, expected one of ${[...PUBLISHED_ARCHES, "all"].join(", ")}`,
    );
  }
  return [arch];
}

export function machOArch(arch: string): string {
  const name = MACH_O_ARCHES[arch];
  if (!name) throw new Error(`No Mach-O architecture is known for ${arch}`);
  return name;
}

export function outputPath(arch: string): string {
  if (arch === process.arch) return path.join(binDirectory, SEA_EXECUTABLE_NAME);
  return path.join(binDirectory, `${PUBLISHED_PLATFORM}-${arch}`, SEA_EXECUTABLE_NAME);
}

function readPluginVersion(): string {
  return JSON.parse(readFileSync(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf-8"))
    .version as string;
}

async function compile(arch: string, version: string, binary: string) {
  console.log(`[sea] 1/4 compiling the hook into a ${PUBLISHED_PLATFORM}-${arch} binary`);

  await fs.mkdir(path.dirname(binary), { recursive: true });
  await fs.rm(binary, { force: true });
  execFileSync(
    "bun",
    [
      "build",
      "--compile",
      `--target=bun-${PUBLISHED_PLATFORM}-${arch}`,
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

export function checkBuiltArch(binary: string, arch: string) {
  console.log(`[sea] 2/4 checking the binary is ${PUBLISHED_PLATFORM}-${arch}`);

  const wanted = machOArch(arch);
  const built = execFileSync("/usr/bin/lipo", ["-archs", binary], { encoding: "utf8" }).trim();
  if (built !== wanted) {
    throw new Error(`The ${arch} build produced ${built}, not ${wanted}`);
  }
}

function signAdHoc(binary: string) {
  console.log("[sea] 3/4 applying an ad-hoc signature");

  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", binary], { stdio: "inherit" });
}

function checkReportedVersion(binary: string, arch: string, version: string) {
  if (arch !== process.arch) {
    console.log(`[sea] 4/4 skipping the version check, ${arch} does not run on this host`);
    return;
  }
  console.log("[sea] 4/4 checking the binary reports the plugin version");

  const reported = execFileSync(binary, ["--version"], { encoding: "utf8" }).trim();
  if (reported !== version) {
    throw new Error(
      `The built binary reports version ${reported}, but plugin.json declares ${version}`,
    );
  }
}

export async function build(argv: string[]) {
  if (process.platform !== PUBLISHED_PLATFORM) {
    throw new Error(
      `Unsupported build host ${process.platform}, only ${PUBLISHED_PLATFORM} is built`,
    );
  }

  const version = readPluginVersion();
  for (const arch of requestedArches(argv)) {
    const binary = outputPath(arch);
    await compile(arch, version, binary);
    checkBuiltArch(binary, arch);
    signAdHoc(binary);
    checkReportedVersion(binary, arch, version);
    console.log(
      `[sea] built the ${PUBLISHED_PLATFORM}-${arch} binary ${binary} (${statSync(binary).size} bytes, version ${version})`,
    );
  }
}

if (import.meta.main) {
  try {
    await build(process.argv.slice(2));
  } catch (err) {
    console.error(`Build failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
