import type { InstallOptions } from "@langchain/langsmith-plugin-binary";

export interface HookEntry {
  type?: unknown;
  command?: unknown;
}

export interface HookGroup {
  hooks?: HookEntry[];
}

export type HookEvents = Record<string, HookGroup[]>;

export interface InstallBinaryOptions extends InstallOptions {
  source?: string | undefined;
  hooksFile?: string | undefined;
}

export interface InstalledPlugin {
  binary: string;
  hooks: string;
  version: string;
}
