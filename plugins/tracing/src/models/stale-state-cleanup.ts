export interface StaleStateCleanupOptions {
  now?: number;
  privacyPath?: string;
  recover?: (group: StaleStateArtifactGroup, guard: StaleRecoveryGuard) => Promise<boolean>;
}

export type StaleRecoveryGuard = (checkSessionsRoot?: boolean) => Promise<boolean>;

export interface StaleTranscriptFileState {
  ctimeMs: number;
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
}

export interface StaleStateArtifactGroup {
  transcript: string;
  artifacts: string[];
  captureDirectories: string[];
  lockDirectories: string[];
  recoveryFiles: string[];
  sessionId?: string;
  recent: boolean;
  live: boolean;
  unsafe: boolean;
}

export interface SessionScan {
  groups: Map<string, StaleStateArtifactGroup>;
  failures: number;
  unreadable: boolean;
}
