import { constants as fsConstants, copyFileSync } from "node:fs";
import * as path from "node:path";
import { readPolicyFile, updatePolicyFile } from "@langchain/plugins-base/plugin";
import type { PolicyFileOptions, PolicyUpdateResult } from "@langchain/plugins-base/plugin";
import {
  CODEX_CONFIG_DIRECTORY,
  LEGACY_PRIVACY_FILE_NAME,
  MODE_FULL,
  MODE_METADATA,
  MODE_OFF,
  MUTE_COMMAND,
  POLICY_VERSION,
  PREFERENCE_WARNING_PREFIX,
  PRIVACY_FILE_NAME,
  UNMUTE_COMMAND,
} from "./constants.js";
import type { Config } from "./models/config.js";
import type {
  PreferenceRequest,
  ThreadPolicy,
  TracingPolicy,
  TurnMode,
} from "./models/tracing-policy.js";
import { homeDirectory } from "./utils/home.js";
import { parsePolicy } from "./utils/validation/tracing-policy.js";

const POLICY_FILE: PolicyFileOptions<TracingPolicy> = {
  empty: () => ({ version: POLICY_VERSION, threads: {} }),
  parse: parsePolicy,
};

export function defaultPrivacyPath(): string {
  return path.join(homeDirectory(), CODEX_CONFIG_DIRECTORY, PRIVACY_FILE_NAME);
}

function adoptLegacyPreferences(file: string): string {
  if (path.basename(file) !== PRIVACY_FILE_NAME) return file;
  try {
    copyFileSync(
      path.join(path.dirname(file), LEGACY_PRIVACY_FILE_NAME),
      file,
      fsConstants.COPYFILE_EXCL,
    );
  } catch {}
  return file;
}

function threadPolicy(policy: TracingPolicy, id: string): ThreadPolicy | undefined {
  return Object.hasOwn(policy.threads, id) ? policy.threads[id] : undefined;
}

/** No launch evidence means metadata-only, never today's sticky preference. */
export function savedTurnMode(file: string, sessionId: string, turnId?: string): TurnMode {
  try {
    const thread = threadPolicy(
      readPolicyFile(adoptLegacyPreferences(file), POLICY_FILE),
      sessionId,
    );
    if (thread?.inherited) return thread.inherited;
    return turnId && thread && Object.hasOwn(thread.turns, turnId)
      ? thread.turns[turnId]
      : MODE_METADATA;
  } catch {
    return MODE_METADATA;
  }
}

export function muteLocked(config: Config): boolean {
  return config.defaultMuted && config.locked.includes("defaultMuted");
}

export function lockedTurnMode(config: Config, sessionId: string, turnId: string): TurnMode {
  const mode = savedTurnMode(defaultPrivacyPath(), sessionId, turnId);
  return mode === MODE_FULL && muteLocked(config) ? MODE_METADATA : mode;
}

/** Exact, argument-free commands only; ordinary prompts are never interpreted. */
export function parseTracingCommand(prompt: string): "mute" | "unmute" | undefined {
  if (prompt === MUTE_COMMAND) return "mute";
  if (prompt === UNMUTE_COMMAND) return "unmute";
  return undefined;
}

function requireIds(sessionId: string, turnId?: string): void {
  if (typeof sessionId !== "string" || !sessionId || typeof turnId !== "string" || !turnId) {
    throw new Error(
      "Nonempty native session_id and turn_id are required; update Codex and enable synchronous UserPromptSubmit hooks",
    );
  }
}

/** One atomic transaction preserves active/queued snapshots before changing preference. */
export async function submitPreference(
  file: string,
  request: PreferenceRequest,
): Promise<PolicyUpdateResult> {
  const {
    sessionId,
    turnId,
    enabled,
    command,
    defaultMuted = false,
    mutedLocked = false,
  } = request;
  const lockedMode = mutedLocked && enabled ? MODE_METADATA : undefined;
  requireIds(sessionId, turnId);
  return updatePolicyFile(adoptLegacyPreferences(file), POLICY_FILE, (policy) => {
    const thread: ThreadPolicy = threadPolicy(policy, sessionId) ?? { turns: {} };
    if (!Object.hasOwn(thread.turns, turnId)) {
      thread.turns = {
        ...thread.turns,
        [turnId]:
          lockedMode ??
          thread.inherited ??
          (enabled ? (thread.preference ?? (defaultMuted ? MODE_METADATA : MODE_FULL)) : MODE_OFF),
      };
    }
    if (command && !(mutedLocked && command === "unmute"))
      thread.preference = command === "mute" ? MODE_METADATA : MODE_FULL;
    policy.threads = { ...policy.threads, [sessionId]: thread };
  });
}

/** First launch wins, even after unmute, a direct child Stop, or sidecar deletion. */
export async function inheritThreadMode(
  file: string,
  sessionId: string,
  mode: TurnMode,
): Promise<TurnMode> {
  let inherited: TurnMode = MODE_METADATA;
  const result = await updatePolicyFile(adoptLegacyPreferences(file), POLICY_FILE, (policy) => {
    const thread: ThreadPolicy = threadPolicy(policy, sessionId) ?? { turns: {} };
    thread.inherited ??= mode;
    inherited = thread.inherited;
    policy.threads = { ...policy.threads, [sessionId]: thread };
  });
  if (result.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${result.warning}`);
  return inherited;
}
