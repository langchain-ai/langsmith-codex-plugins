import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import binaryHooks from "../hooks/hooks.binary.json" with { type: "json" };
import { binary } from "./binary.ts";
import type { InstallBinaryOptions, InstalledPlugin } from "./binary-models.ts";
import { UNKNOWN_VERSION } from "./binary-constants.ts";
import { unsupportedHost } from "./messages.ts";
import { printStandDownNotice } from "./plugin-status.ts";
import { hookCount, readHooksFile, renderHooksFile } from "./utils/hooks.ts";
import { codexFile, underHome } from "./utils/paths.ts";
import { writeFileAtomic } from "./utils/writeFileAtomic.ts";

export async function installBinary(options: InstallBinaryOptions): Promise<InstalledPlugin> {
  const runtimePlatform = options.runtimePlatform ?? os.platform();
  const runtimeArch = options.runtimeArch ?? os.arch();
  if (!binary.supportsHost(runtimePlatform, runtimeArch)) {
    throw new Error(unsupportedHost(runtimePlatform, runtimeArch));
  }

  const hooksFile = options.hooksFile ?? codexFile("hooks.json", false);
  const host = { ...options, runtimePlatform, runtimeArch };
  const copyable = options.tag === undefined ? options.source : undefined;
  const installed =
    copyable === undefined
      ? await binary.install(host)
      : await binary.installLocalCopy(copyable, options.currentVersion ?? UNKNOWN_VERSION, host);

  const rendered = renderHooksFile(await readHooksFile(hooksFile), installed.path);
  await fs.mkdir(path.dirname(hooksFile), { recursive: true });
  await writeFileAtomic(hooksFile, `${JSON.stringify(rendered, null, 2)}\n`);

  return { binary: installed.path, hooks: hooksFile, version: installed.version };
}

export async function runInstall(options: {
  source?: string;
  currentVersion?: string;
  projectScoped?: boolean;
  print?: boolean;
  tag?: string;
}): Promise<void> {
  const hooksFile = codexFile("hooks.json", options.projectScoped ?? false);
  try {
    if (options.print) {
      const target = binary.installedBinaryPath();
      console.log(JSON.stringify(renderHooksFile(await readHooksFile(hooksFile), target), null, 2));
      return;
    }

    const installed = await installBinary({
      source: options.source,
      currentVersion: options.currentVersion,
      tag: options.tag,
      hooksFile,
    });
    const configFile = path.join(path.dirname(installed.hooks), "langsmith.json");
    for (const line of [
      `Installed ${binary.target.executableName} ${installed.version} to ${underHome(path.dirname(installed.binary))}`,
      `Registered ${hookCount(binaryHooks.hooks)} hooks in ${underHome(installed.hooks)}`,
      "",
      "Next:",
      `  1. Create ${underHome(configFile)} (if it doesn't exist already):`,
      `       {"enabled": true, "api_key": "<your-api-key>", "project": "my-project"}`,
      `  2. Restart Codex, then choose "Trust all and continue" when it asks`,
    ]) {
      console.log(line);
    }
    await printStandDownNotice();
  } catch (error) {
    console.error(`install failed: ${error}`);
    process.exitCode = 1;
  }
}
