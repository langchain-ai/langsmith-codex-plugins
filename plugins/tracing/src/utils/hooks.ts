import * as fs from "node:fs/promises";
import binaryHooks from "../../hooks/hooks.binary.json" with { type: "json" };
import { binary } from "../binary.ts";
import type { HookEvents, HookGroup } from "../binary-models.ts";
import { asRecord } from "./objects.ts";
import { quoteForShell } from "./quoteForShell.ts";

export function hookCount(events: HookEvents): number {
  return Object.values(events).reduce(
    (total, groups) =>
      total + groups.reduce((inGroups, group) => inGroups + (group.hooks ?? []).length, 0),
    0,
  );
}

function pointedAtBinary(events: HookEvents, executable: string): HookEvents {
  const command = quoteForShell(executable);
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
        (hook) =>
          typeof hook?.command !== "string" || !hook.command.includes(binary.target.executableName),
      ),
    }))
    .filter((group) => group.hooks.length > 0);
}

export function renderHooksFile(existing: unknown, executable: string): Record<string, unknown> {
  const file = asRecord(existing);
  const existingEvents = asRecord(file.hooks) as HookEvents;
  const hooks: HookEvents = { ...existingEvents };
  for (const [event, groups] of Object.entries(pointedAtBinary(binaryHooks.hooks, executable))) {
    const kept = Array.isArray(existingEvents[event]) ? withoutOurHooks(existingEvents[event]) : [];
    hooks[event] = [...kept, ...groups];
  }
  return { ...file, hooks };
}

export async function readHooksFile(hooksFile: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(hooksFile, "utf-8"));
  } catch {
    return {};
  }
}
