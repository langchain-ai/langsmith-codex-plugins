import * as fs from "node:fs/promises";
import { binary } from "./binary.ts";
import type { HookEntry, HookGroup } from "./binary-models.ts";
import { codexFile } from "./utils/paths.ts";
import { quoteForShell } from "./utils/quoteForShell.ts";

async function samePath(one: string, other: string): Promise<boolean> {
  if (one === other) return true;
  try {
    return (await fs.realpath(one)) === (await fs.realpath(other));
  } catch {
    return false;
  }
}

async function binaryExists(executable: string): Promise<boolean> {
  try {
    await fs.stat(executable);
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

async function hooksFileRunsBinary(hooksFile: string, executable: string): Promise<boolean> {
  const written = new Set([executable, quoteForShell(executable)]);
  try {
    const parsed = JSON.parse(await fs.readFile(hooksFile, "utf-8"));
    return registeredCommands(parsed).some((command) => written.has(command.trim()));
  } catch {
    return false;
  }
}

export async function standaloneBinaryRegistered(): Promise<string | undefined> {
  try {
    const installed = binary.installedBinaryPath();
    if (await samePath(process.execPath, installed)) return undefined;
    if (!(await binaryExists(installed))) return undefined;
    const projectHooks = codexFile("hooks.json", true);
    const userHooks = codexFile("hooks.json", false);
    for (const hooksFile of [projectHooks, userHooks]) {
      if (await hooksFileRunsBinary(hooksFile, installed)) return installed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
