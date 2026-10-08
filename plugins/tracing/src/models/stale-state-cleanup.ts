export interface StaleStateCleanupOptions {
  now?: number;
  privacyPath?: string;
  recover?: (group: StaleStateArtifactGroup) => Promise<boolean>;
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
