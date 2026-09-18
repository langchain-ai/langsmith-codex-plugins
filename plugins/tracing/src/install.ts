import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import seaHooks from "../hooks/hooks.sea.json" with { type: "json" };
import { printStandDownNotice } from "./plugin-status.ts";
import { DEFAULT_RELEASE_API, SEA_EXECUTABLE_NAME } from "./sea-constants.ts";
import type {
  HookEvents,
  HookGroup,
  InstallBinaryOptions,
  SignatureVerifier,
} from "./sea-models.ts";
import { verifyAdHocSignature } from "./updater-download.ts";
import {
  defaultInstallDir,
  installReleaseAsset,
  installedExecutablePath,
} from "./updater-install.ts";
import { fetchReleases, newestInstallableRelease } from "./updater-releases.ts";
import { isPublishedSeaTarget, releaseAssetName, versionFromTag } from "./updater-utils.ts";

export function quoteForShell(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`;
}

export function defaultHooksFile(projectScoped: boolean, cwd = process.cwd()): string {
  if (projectScoped) return path.join(cwd, ".codex", "hooks.json");
  return path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "hooks.json");
}

function pointedAtBinary(events: HookEvents, binary: string): HookEvents {
  const command = quoteForShell(binary);
  return Object.fromEntries(
    Object.entries(events).map(([event, groups]) => [
      event,
      groups.map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).map((hook) =>
          hook.type === "command" ? { ...hook, command } : hook,
        ),
      })),
    ]),
  );
}

function withoutOurHooks(groups: HookGroup[]): HookGroup[] {
  return groups
    .map((group) => ({
      ...group,
      hooks: (group.hooks ?? []).filter(
        (hook) => typeof hook?.command !== "string" || !hook.command.includes(SEA_EXECUTABLE_NAME),
      ),
    }))
    .filter((group) => group.hooks.length > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function renderHooksFile(existing: unknown, binary: string): Record<string, unknown> {
  const file = asRecord(existing);
  const existingEvents = asRecord(file.hooks) as HookEvents;
  const hooks: HookEvents = { ...existingEvents };
  for (const [event, groups] of Object.entries(pointedAtBinary(seaHooks.hooks, binary))) {
    const kept = Array.isArray(existingEvents[event]) ? withoutOurHooks(existingEvents[event]) : [];
    hooks[event] = [...kept, ...groups];
  }
  return { ...file, hooks };
}

async function readHooksFile(hooksFile: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(hooksFile, "utf-8"));
  } catch {
    return {};
  }
}

async function existingMode(target: string): Promise<number | undefined> {
  try {
    return (await fs.stat(target)).mode & 0o777;
  } catch {
    return undefined;
  }
}

async function writeFileAtomic(target: string, contents: string): Promise<void> {
  const directory = path.dirname(target);
  const partial = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`);
  const mode = await existingMode(target);
  try {
    await fs.writeFile(partial, contents);
    if (mode !== undefined) await fs.chmod(partial, mode);
    await fs.rename(partial, target);
  } catch (error) {
    await fs.unlink(partial).catch(() => undefined);
    throw error;
  }
}

async function copyExecutable(
  source: string,
  target: string,
  verifySignature: SignatureVerifier,
): Promise<void> {
  const partial = `${target}.${process.pid}.tmp`;
  try {
    await fs.copyFile(source, partial);
    await fs.chmod(partial, 0o755);
    await verifySignature(partial);
    await fs.rename(partial, target);
  } catch (error) {
    await fs.unlink(partial).catch(() => undefined);
    throw error;
  }
}

async function downloadExecutable(
  options: InstallBinaryOptions,
  installDir: string,
  verifySignature: SignatureVerifier,
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const releaseApi =
    options.releaseApi ?? process.env.LANGSMITH_CODEX_RELEASE_API ?? DEFAULT_RELEASE_API;
  const currentVersion = options.currentVersion ?? "0.0.0";
  const releases = await fetchReleases(fetchImpl, releaseApi, currentVersion);
  const release = options.tag
    ? releases.find((candidate) => candidate.tag_name === options.tag)
    : newestInstallableRelease(releases);
  if (!release) {
    throw new Error(
      options.tag
        ? `no published release is tagged ${options.tag}`
        : `no published release carries a ${releaseAssetName("<tag>")} asset`,
    );
  }
  await installReleaseAsset(
    release,
    installDir,
    fetchImpl,
    releaseApi,
    versionFromTag(release.tag_name),
    verifySignature,
    `${process.pid}.${Date.now()}`,
  );
}

export async function installBinary(
  options: InstallBinaryOptions,
): Promise<{ binary: string; hooks: string }> {
  const runtimePlatform = options.runtimePlatform ?? os.platform();
  const runtimeArch = options.runtimeArch ?? os.arch();
  if (!isPublishedSeaTarget(runtimePlatform, runtimeArch)) {
    throw new Error(
      `The standalone binary only runs on macOS arm64, not ${runtimePlatform}-${runtimeArch}. Use the Codex plugin instead.`,
    );
  }

  const installDir = options.installDir ?? defaultInstallDir();
  const target = installedExecutablePath(installDir);
  const hooksFile = options.hooksFile ?? defaultHooksFile(false);
  const verifySignature = options.verifySignature ?? verifyAdHocSignature;
  const copyable = options.tag === undefined ? options.source : undefined;

  await fs.mkdir(installDir, { recursive: true, mode: 0o700 });
  if (copyable !== undefined) await copyExecutable(copyable, target, verifySignature);
  else await downloadExecutable(options, installDir, verifySignature);

  const rendered = renderHooksFile(await readHooksFile(hooksFile), target);
  await fs.mkdir(path.dirname(hooksFile), { recursive: true });
  await writeFileAtomic(hooksFile, `${JSON.stringify(rendered, null, 2)}\n`);

  return { binary: target, hooks: hooksFile };
}

export function flagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  const value = index < 0 ? undefined : argv[index + 1];
  return value === undefined || value.startsWith("-") ? undefined : value;
}

export async function runInstall(options: {
  source?: string;
  currentVersion?: string;
  argv: string[];
}): Promise<void> {
  const hooksFile = defaultHooksFile(options.argv.includes("--project"));
  try {
    if (options.argv.includes("--print")) {
      const target = installedExecutablePath(defaultInstallDir());
      console.log(JSON.stringify(renderHooksFile(await readHooksFile(hooksFile), target), null, 2));
      return;
    }

    const tag = flagValue(options.argv, "--tag");
    const installed = await installBinary({
      source: options.source,
      currentVersion: options.currentVersion,
      tag,
      hooksFile,
    });
    const from = tag ?? (options.source ? "this binary" : "the newest release");
    console.log(`Installed the LangSmith Codex tracing binary from ${from}`);
    console.log(`  binary:  ${installed.binary}`);
    console.log(`  hooks:   ${installed.hooks}`);
    await printStandDownNotice();
    console.log("");
    console.log("Next:");
    console.log("  1. Configure credentials as described in the README.");
    console.log("  2. Restart Codex, then trust these hooks when it prompts.");
  } catch (error) {
    console.error(`install failed: ${error}`);
    process.exitCode = 1;
  }
}
