import type { CommonConfig, LockableField } from "@langchain/plugins-base/settings";

export type ParentHeaders = Record<string, string> & { "langsmith-trace": string };

export interface Config extends CommonConfig {
  enabled: boolean;
  defaultMuted: boolean;
  redact: boolean;
  locked: LockableField[];
  managedConfigProblem?: string;
  managedConfigWarnings?: string[];
  parent_headers?: ParentHeaders;
}

export interface ConfigOptions {
  home: string;
  cwd: string;
  env: Record<string, string | undefined>;
}

export type ConfigEnv = ConfigOptions["env"];

export interface EnvironmentLayer {
  common: CommonConfig;
  parentHeaders?: ParentHeaders;
}
