import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { ABANDONED_LOCK_MS, DEFAULT_RELEASE_API, LOCK_FILE_NAME } from "./binary-constants.ts";
import type { UpdateOptions, UpdateResult } from "./binary-models.ts";
import { verifyAdHocSignature } from "./updater-download.ts";
import { defaultInstallDir, installReleaseAsset } from "./updater-install.ts";
import { fetchReleases, newestInstallableRelease } from "./updater-releases.ts";
import { isPublishedTarget, isSemver, versionFromTag } from "./updater-utils.ts";

async function claimUpdateLock(lockFile: string, now: number): Promise<fs.FileHandle | undefined> {
  try {
    return await fs.open(lockFile, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  let held: fs.FileHandle | undefined;
  try {
    held = await fs.open(lockFile, "r");
    if (now - (await held.stat()).mtimeMs <= ABANDONED_LOCK_MS) return undefined;
  } catch {
    return undefined;
  } finally {
    await held?.close().catch(() => undefined);
  }

  try {
    await fs.unlink(lockFile);
    return await fs.open(lockFile, "wx", 0o600);
  } catch {
    return undefined;
  }
}

export async function updateFromGitHub(options: UpdateOptions): Promise<UpdateResult> {
  const runtimePlatform = options.runtimePlatform ?? os.platform();
  const runtimeArch = options.runtimeArch ?? os.arch();
  if (!isPublishedTarget(runtimePlatform, runtimeArch)) return { status: "unsupported" };
  if (!isSemver(options.currentVersion)) return { status: "unsupported" };

  const installDir = options.installDir ?? defaultInstallDir();
  const now = (options.now ?? Date.now)();
  const lockFile = path.join(installDir, LOCK_FILE_NAME);

  await fs.mkdir(installDir, { recursive: true, mode: 0o700 });
  const lock = await claimUpdateLock(lockFile, now);
  if (!lock) return { status: "busy" };

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const releaseApi = options.releaseApi ?? DEFAULT_RELEASE_API;
    const releases = await fetchReleases(fetchImpl, releaseApi, options.currentVersion);
    const release = newestInstallableRelease(releases, runtimeArch, options.currentVersion);
    if (!release) return { status: "current" };

    await installReleaseAsset(
      release,
      runtimeArch,
      installDir,
      fetchImpl,
      releaseApi,
      options.currentVersion,
      options.verifySignature ?? verifyAdHocSignature,
      `${process.pid}.${now}`,
    );
    return { status: "updated", version: versionFromTag(release.tag_name) };
  } finally {
    await lock.close().catch(() => undefined);
    await fs.unlink(lockFile).catch(() => undefined);
  }
}
