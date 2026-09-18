export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string | null;
}

export interface Release {
  tag_name: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: ReleaseAsset[];
}

export type SignatureVerifier = (binary: string) => Promise<void>;

export type UpdateResult =
  | { status: "unsupported" | "busy" | "current" }
  | { status: "updated"; version: string };

export interface UpdateOptions {
  currentVersion: string;
  installDir?: string;
  fetchImpl?: typeof fetch;
  releaseApi?: string;
  verifySignature?: SignatureVerifier;
  now?: () => number;
  runtimePlatform?: NodeJS.Platform;
  runtimeArch?: string;
}

export interface HookEntry {
  type?: unknown;
  command?: unknown;
}

export interface HookGroup {
  hooks?: HookEntry[];
}

export type HookEvents = Record<string, HookGroup[]>;

export interface InstallBinaryOptions {
  source?: string;
  tag?: string;
  installDir?: string;
  hooksFile?: string;
  currentVersion?: string;
  fetchImpl?: typeof fetch;
  releaseApi?: string;
  runtimePlatform?: string;
  runtimeArch?: string;
  verifySignature?: SignatureVerifier;
}
