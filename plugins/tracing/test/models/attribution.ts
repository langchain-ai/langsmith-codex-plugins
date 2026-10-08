export type AttributionRolloutCall = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  input?: string;
};

export type AttributionRolloutEvidence = {
  cwd?: string;
  changes?: Record<string, unknown>;
};

export type AttributionRolloutOptions = {
  sessionCwd: string;
  sessionMetaCwd?: string;
  sessionGit?: Record<string, string>;
  sessionIdentifier?: string;
  calls: AttributionRolloutCall[];
  completionOrder?: string[];
  evidence?: Record<string, AttributionRolloutEvidence>;
};
