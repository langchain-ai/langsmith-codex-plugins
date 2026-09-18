import { LIST_TIMEOUT_MS, RELEASES_PER_PAGE } from "./sea-constants.ts";
import type { Release } from "./sea-models.ts";
import {
  githubHeaders,
  isSemver,
  isVersionNewer,
  parseReleases,
  releaseAssetName,
} from "./updater-utils.ts";

function carriesOurAsset(release: Release): boolean {
  const wanted = releaseAssetName(release.tag_name);
  return release.assets.some((asset) => asset.name === wanted);
}

export function newestInstallableRelease(
  releases: Release[],
  currentVersion?: string,
): Release | undefined {
  let best: Release | undefined;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (!isSemver(release.tag_name)) continue;
    if (!carriesOurAsset(release)) continue;
    if (currentVersion && !isVersionNewer(release.tag_name, currentVersion)) continue;
    if (!best || isVersionNewer(release.tag_name, best.tag_name)) best = release;
  }
  return best;
}

export async function fetchReleases(
  fetchImpl: typeof fetch,
  releaseApi: string,
  currentVersion: string,
): Promise<Release[]> {
  const response = await fetchImpl(`${releaseApi}?per_page=${RELEASES_PER_PAGE}`, {
    headers: githubHeaders(currentVersion),
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`failed to list GitHub releases: HTTP ${response.status}`);
  return parseReleases(await response.json());
}
