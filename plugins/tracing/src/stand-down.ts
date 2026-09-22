import * as fs from "node:fs/promises";
import { defaultHooksFile, quoteForShell } from "./install.ts";
import type { HookEntry, HookGroup } from "./binary-models.ts";
import { defaultInstallDir, installedExecutablePath } from "./updater-install.ts";
import { runningCompiledBinary } from "./utils/runningCompiledBinary.ts";

async function binaryExists(binary: string): Promise<boolean> {
  try {
    await fs.stat(binary);
    return true;
  } catch {
    return false;
  }
}

function registeredCommands(parsed: unknown): string[] {
  const events = (parsed as { hooks?: unknown } | null)?.hooks;
  if (!events || typeof events !== "object") return [];
  return Object.values(events as Record<string, unknown>)
    .flatMap((groups) => (Array.isArray(groups) ? (groups as HookGroup[]) : []))
    .flatMap((group) => (Array.isArray(group?.hooks) ? (group.hooks as HookEntry[]) : []))
    .map((hook) => hook?.command)
    .filter((command): command is string => typeof command === "string");
}

async function hooksFileRunsBinary(hooksFile: string, binary: string): Promise<boolean> {
  const written = new Set([binary, quoteForShell(binary)]);
  try {
    const parsed = JSON.parse(await fs.readFile(hooksFile, "utf-8"));
    return registeredCommands(parsed).some((command) => written.has(command.trim()));
  } catch {
    return false;
  }
}

export async function pluginShouldStandDown(): Promise<boolean> {
  try {
    if (runningCompiledBinary()) return false;
    const binary = installedExecutablePath(defaultInstallDir());
    if (!(await binaryExists(binary))) return false;
    const projectHooks = defaultHooksFile(true);
    const userHooks = defaultHooksFile(false);
    for (const hooksFile of [projectHooks, userHooks]) {
      if (await hooksFileRunsBinary(hooksFile, binary)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
