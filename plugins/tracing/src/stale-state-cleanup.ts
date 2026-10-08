import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Dirent } from "node:fs";
import { FILE_LOCK_OWNER_FILENAME, TRACE_UPLOAD_LOCK_SUFFIX } from "./constants.js";
import {
  STALE_PLUGIN_TTL_MS,
  CODEX_SESSIONS_DIRECTORY,
  CODEX_WRITER_LOCKS_DIRECTORY,
  STALE_PLUGIN_CAPTURE_PATTERN,
  STALE_PLUGIN_INCREMENTAL_LOCK_PATTERN,
  STALE_PLUGIN_INCREMENTAL_PATTERN,
  STALE_PLUGIN_INCREMENTAL_TEMP_PATTERN,
  STALE_PLUGIN_NATIVE_ROLLOUT_PATTERN,
  STALE_PLUGIN_STATE_PATTERN,
  STALE_PLUGIN_TOPOLOGY_PATTERN,
  STALE_PLUGIN_TOPOLOGY_TEMP_PATTERN,
  STALE_PLUGIN_UUID_PATTERN,
  STALE_PLUGIN_NATIVE_LOCK_PATTERN,
  STALE_PLUGIN_COMPRESSED_SUFFIX_PATTERN,
  STALE_PLUGIN_LOCK_RECOVERY_PATTERN,
} from "./constants/stale-state-cleanup.js";
import type {
  SessionScan,
  StaleStateArtifactGroup,
  StaleStateCleanupOptions,
} from "./models/stale-state-cleanup.js";
import {
  TOOL_CAPTURE_FILE_PATTERN,
  TOOL_CAPTURE_TEMP_PATTERN,
  TURN_CAPTURE_LOCK_SUFFIX,
  TURN_CAPTURE_PLAN,
  TURN_CAPTURE_STOP,
  TURN_CAPTURE_TRANSCRIPT,
} from "./tool-capture-constants.js";
import { transcriptSessionId } from "./tool-capture.js";
import { defaultPrivacyPath, pruneInactiveSessionEvidence } from "./tracing-policy.js";
import { pathHasSymbolicLink } from "./utils/paths.js";
import {
  fileLockOwnerIsLive,
  fileLockRecoveryOwnerState,
  tryWithFileLock,
} from "./utils/fileLock.js";

function groupFor(scan: SessionScan, transcript: string): StaleStateArtifactGroup {
  let group = scan.groups.get(transcript);
  if (!group) {
    group = {
      transcript,
      artifacts: [],
      captureDirectories: [],
      lockDirectories: [],
      recoveryFiles: [],
      recent: false,
      live: false,
      unsafe: false,
    };
    scan.groups.set(transcript, group);
  }
  return group;
}

async function inspectDirectory(
  group: StaleStateArtifactGroup,
  directory: string,
  cutoff: number,
  lock: boolean,
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const stat = await fs.lstat(file);
    const recognized = lock
      ? entry.name === FILE_LOCK_OWNER_FILENAME
      : TOOL_CAPTURE_FILE_PATTERN.test(entry.name) ||
        TOOL_CAPTURE_TEMP_PATTERN.test(entry.name) ||
        [TURN_CAPTURE_TRANSCRIPT, TURN_CAPTURE_STOP, TURN_CAPTURE_PLAN].includes(entry.name);
    if (!stat.isFile() || stat.isSymbolicLink() || !recognized) {
      group.unsafe = true;
      continue;
    }
    if (stat.mtimeMs > cutoff) group.recent = true;
    if (!lock) group.artifacts.push(file);
  }
}

async function scanDirectory(
  directory: string,
  scan: SessionScan,
  cutoff: number,
  ownLocks: Set<string>,
  recurse: boolean,
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    scan.unreadable = true;
    scan.failures++;
    return;
  }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const native = STALE_PLUGIN_NATIVE_ROLLOUT_PATTERN.test(entry.name);
    const capture = STALE_PLUGIN_CAPTURE_PATTERN.exec(entry.name);
    const sidecar =
      STALE_PLUGIN_STATE_PATTERN.exec(entry.name) ||
      STALE_PLUGIN_TOPOLOGY_PATTERN.exec(entry.name) ||
      STALE_PLUGIN_INCREMENTAL_PATTERN.exec(entry.name) ||
      STALE_PLUGIN_TOPOLOGY_TEMP_PATTERN.exec(entry.name) ||
      STALE_PLUGIN_INCREMENTAL_TEMP_PATTERN.exec(entry.name);
    const lock = STALE_PLUGIN_INCREMENTAL_LOCK_PATTERN.exec(entry.name);
    const recovery = STALE_PLUGIN_LOCK_RECOVERY_PATTERN.exec(entry.name);
    const rolloutLock = entry.name.endsWith(TRACE_UPLOAD_LOCK_SUFFIX)
      ? entry.name.slice(0, -TRACE_UPLOAD_LOCK_SUFFIX.length)
      : entry.name.endsWith(TURN_CAPTURE_LOCK_SUFFIX)
        ? entry.name.slice(0, -TURN_CAPTURE_LOCK_SUFFIX.length)
        : undefined;
    const transcriptName = native
      ? entry.name.replace(STALE_PLUGIN_COMPRESSED_SUFFIX_PATTERN, "")
      : (capture?.[1] ?? sidecar?.[1] ?? lock?.[1] ?? recovery?.[1] ?? rolloutLock);
    if (!transcriptName) {
      if (recurse && entry.isDirectory() && !entry.isSymbolicLink())
        await scanDirectory(file, scan, cutoff, ownLocks, true);
      if (entry.isSymbolicLink()) scan.unreadable = true;
      continue;
    }
    const group = groupFor(scan, path.join(directory, transcriptName));
    if (ownLocks.has(file)) continue;
    try {
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) {
        group.unsafe = true;
        continue;
      }
      if (stat.mtimeMs > cutoff) group.recent = true;
      if (recovery) {
        group.lockDirectories.push(path.join(directory, `${recovery[1]}${recovery[2]}`));
        if (!stat.isFile()) group.unsafe = true;
        else {
          const ownerState = await fileLockRecoveryOwnerState(file);
          if (ownerState === "live") group.live = true;
          else if (ownerState === "unknown") group.unsafe = true;
          else if (stat.mtimeMs <= cutoff) group.recoveryFiles.push(file);
        }
      } else if (native || sidecar) {
        if (!stat.isFile()) group.unsafe = true;
        else if (sidecar) group.artifacts.push(file);
      } else if (capture || lock || rolloutLock) {
        if (!stat.isDirectory()) group.unsafe = true;
        else {
          const isLock = !!(lock || rolloutLock);
          (isLock ? group.lockDirectories : group.captureDirectories).push(file);
          await inspectDirectory(group, file, cutoff, isLock);
          if (isLock && (await fileLockOwnerIsLive(file))) group.live = true;
        }
      }
    } catch {
      group.unsafe = true;
      scan.unreadable = true;
      scan.failures++;
    }
  }
}

function emptyScan(): SessionScan {
  return {
    groups: new Map(),
    failures: 0,
    unreadable: false,
  };
}

async function sessionIdentity(group: StaleStateArtifactGroup): Promise<string | undefined> {
  const filenameId = STALE_PLUGIN_UUID_PATTERN.exec(path.basename(group.transcript))?.[1];
  const nativeId = await transcriptSessionId(group.transcript);
  if (filenameId && nativeId && filenameId !== nativeId) return undefined;
  if (nativeId) return nativeId;
  if (filenameId) return filenameId;
  for (const directory of group.captureDirectories) {
    const id = await transcriptSessionId(path.join(directory, TURN_CAPTURE_TRANSCRIPT));
    if (id) return id;
  }
  return undefined;
}

async function sessionsRoot(transcript: string): Promise<string | undefined> {
  let current = path.dirname(path.resolve(transcript));
  for (;;) {
    if (path.basename(current) === CODEX_SESSIONS_DIRECTORY) {
      const canonicalParent = await fs.realpath(path.dirname(current));
      const root = path.join(canonicalParent, CODEX_SESSIONS_DIRECTORY);
      const stat = await fs.lstat(root);
      return stat.isDirectory() && !stat.isSymbolicLink() ? root : undefined;
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function nativeLocks(root: string): Promise<Set<string> | undefined> {
  const directory = path.join(path.dirname(root), CODEX_WRITER_LOCKS_DIRECTORY);
  try {
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return undefined;
    const entries = await fs.readdir(directory);
    return new Set(
      entries.flatMap((name) => STALE_PLUGIN_NATIVE_LOCK_PATTERN.exec(name)?.[1] ?? []),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    return undefined;
  }
}

async function underLocks(locks: string[], action: () => Promise<void>, index = 0): Promise<void> {
  if (index === locks.length) return action();
  await tryWithFileLock(locks[index], () => underLocks(locks, action, index + 1));
}

function locksForSession(groups: StaleStateArtifactGroup[]): string[] {
  return [
    ...new Set(
      groups.flatMap((group) => [
        `${group.transcript}${TURN_CAPTURE_LOCK_SUFFIX}`,
        `${group.transcript}${TRACE_UPLOAD_LOCK_SUFFIX}`,
        ...group.lockDirectories,
      ]),
    ),
  ].sort();
}

async function refreshSessionGroups(
  groups: StaleStateArtifactGroup[],
  cutoff: number,
  ownLocks: Set<string>,
): Promise<SessionScan> {
  const refreshed = emptyScan();
  for (const directory of new Set(groups.map((group) => path.dirname(group.transcript))))
    await scanDirectory(directory, refreshed, cutoff, ownLocks, false);
  for (const group of refreshed.groups.values()) {
    group.sessionId = await sessionIdentity(group);
    if (!group.sessionId) refreshed.unreadable = true;
  }
  return refreshed;
}

async function hasLinkedParent(groups: StaleStateArtifactGroup[]): Promise<boolean> {
  for (const group of groups)
    if (await pathHasSymbolicLink(path.dirname(group.transcript))) return true;
  return false;
}

export async function cleanupStalePluginState(
  transcript: string,
  currentSessionId: string,
  options: StaleStateCleanupOptions = {},
): Promise<void> {
  const root = await sessionsRoot(transcript);
  if (!root) return;
  const currentTranscript = path.join(
    await fs.realpath(path.dirname(transcript)),
    path.basename(transcript),
  );
  const cutoff = (options.now ?? Date.now()) - STALE_PLUGIN_TTL_MS;
  const scan = emptyScan();
  await scanDirectory(root, scan, cutoff, new Set(), true);
  const lockedSessionIds = await nativeLocks(root);
  if (!lockedSessionIds) return;
  const discoveredSessionIds = new Set<string>();
  const protectedSessionIds = new Set([currentSessionId, ...lockedSessionIds]);
  const groupsBySession = new Map<string, StaleStateArtifactGroup[]>();
  for (const group of scan.groups.values()) {
    group.sessionId = await sessionIdentity(group);
    if (!group.sessionId) {
      scan.unreadable = true;
      continue;
    }
    discoveredSessionIds.add(group.sessionId);
    const groups = groupsBySession.get(group.sessionId) ?? [];
    groups.push(group);
    groupsBySession.set(group.sessionId, groups);
    if (group.transcript === currentTranscript || group.recent || group.live || group.unsafe)
      protectedSessionIds.add(group.sessionId);
  }
  const privacyPath = options.privacyPath ?? defaultPrivacyPath();
  for (const [sessionId, groups] of groupsBySession) {
    if (protectedSessionIds.has(sessionId)) continue;
    try {
      if (await hasLinkedParent(groups)) continue;
      const locks = locksForSession(groups);
      await underLocks(locks, async () => {
        if (await hasLinkedParent(groups)) return;
        const locked = await nativeLocks(root);
        if (!locked || locked.has(sessionId)) return;
        const refreshed = await refreshSessionGroups(groups, cutoff, new Set(locks));
        scan.failures += refreshed.failures;
        scan.unreadable ||= refreshed.unreadable;
        const currentGroups = [...refreshed.groups.values()].filter(
          (group) => group.sessionId === sessionId,
        );
        const knownTranscripts = new Set(groups.map((group) => group.transcript));
        const changedOriginal = groups.some((group) => {
          const current = refreshed.groups.get(group.transcript);
          return current != null && current.sessionId !== sessionId;
        });
        for (const group of refreshed.groups.values())
          if (group.sessionId) discoveredSessionIds.add(group.sessionId);
        if (
          refreshed.unreadable ||
          changedOriginal ||
          currentGroups.some(
            (group) =>
              !knownTranscripts.has(group.transcript) ||
              group.transcript === currentTranscript ||
              group.unsafe ||
              group.recent ||
              group.live,
          )
        ) {
          protectedSessionIds.add(sessionId);
          return;
        }
        const evidence = await pruneInactiveSessionEvidence(privacyPath, {
          inactiveBefore: cutoff,
          currentSessionId,
          protectedSessionIds: [...protectedSessionIds],
          inactiveSessionIds: [sessionId],
          targetSessionIds: [sessionId],
        });
        if (evidence.activeSessionIds.includes(sessionId)) {
          protectedSessionIds.add(sessionId);
          return;
        }
        for (const group of currentGroups) {
          for (const file of group.artifacts) await fs.unlink(file);
          for (const file of group.recoveryFiles) await fs.unlink(file);
          for (const directory of group.captureDirectories) await fs.rmdir(directory);
        }
      });
    } catch {
      scan.failures++;
    }
  }
  if (!scan.unreadable) {
    try {
      const latestLocks = await nativeLocks(root);
      if (!latestLocks) return;
      await pruneInactiveSessionEvidence(privacyPath, {
        inactiveBefore: cutoff,
        currentSessionId,
        protectedSessionIds: [...protectedSessionIds],
        inactiveSessionIds: [],
        excludedSessionIds: [...discoveredSessionIds, ...lockedSessionIds, ...latestLocks],
      });
    } catch {
      scan.failures++;
    }
  }
  if (scan.failures)
    console.error(`Tracing cleanup skipped ${scan.failures} unreadable or busy entries.`);
}
