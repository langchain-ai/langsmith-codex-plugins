import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { INSTALL_DIR_NAME, SEA_EXECUTABLE_NAME } from "./sea-constants.ts";
import type { Release, SignatureVerifier } from "./sea-models.ts";
import { downloadAndVerifyAsset } from "./updater-download.ts";
import { releaseAssetName } from "./updater-utils.ts";

export function defaultInstallDir(home = os.homedir()): string {
  return path.join(home, INSTALL_DIR_NAME);
}

export function installedExecutablePath(installDir: string): string {
  return path.join(installDir, SEA_EXECUTABLE_NAME);
}

export async function installReleaseAsset(
  release: Release,
  installDir: string,
  fetchImpl: typeof fetch,
  releaseApi: string,
  currentVersion: string,
  verifySignature: SignatureVerifier | undefined,
  uniqueSuffix: string,
): Promise<string> {
  const assetName = releaseAssetName(release.tag_name);
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) throw new Error(`release ${release.tag_name} has no ${assetName} asset`);
  const sidecar = release.assets.find((candidate) => candidate.name === `${assetName}.sha256`);

  await fs.mkdir(installDir, { recursive: true, mode: 0o700 });
  const target = installedExecutablePath(installDir);
  const partial = path.join(installDir, `.${SEA_EXECUTABLE_NAME}.${uniqueSuffix}.tmp`);

  try {
    await downloadAndVerifyAsset(asset, sidecar, partial, fetchImpl, releaseApi, currentVersion);
    await fs.chmod(partial, 0o755);
    await verifySignature?.(partial);
    await fs.rename(partial, target);
    return target;
  } catch (error) {
    await fs.unlink(partial).catch(() => undefined);
    throw error;
  }
}
