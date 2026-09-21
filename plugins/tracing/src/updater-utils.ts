import * as path from "node:path";
import {
  DEFAULT_RELEASE_API,
  PUBLISHED_ARCH,
  PUBLISHED_PLATFORM,
  RELEASE_DOWNLOAD_PREFIX,
  SEA_EXECUTABLE_NAME,
} from "./sea-constants.ts";
import type { Release, ReleaseAsset } from "./sea-models.ts";

export function isPublishedSeaTarget(runtimePlatform: string, runtimeArch: string): boolean {
  return runtimePlatform === PUBLISHED_PLATFORM && runtimeArch === PUBLISHED_ARCH;
}

export function releaseAssetName(tag: string): string {
  return `${SEA_EXECUTABLE_NAME}-${PUBLISHED_PLATFORM}-${PUBLISHED_ARCH}-${tag}`;
}

export function versionFromTag(tag: string): string {
  return tag.trim().replace(/^v/, "");
}

export type ParsedSemver = {
  numbers: [number, number, number];
  final: number;
  label: string;
  iteration: number;
};

function parseSemver(version: string): ParsedSemver | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)(?:\.(\d+))?)?$/.exec(version.trim());
  if (!match) return undefined;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    final: match[4] === undefined ? 1 : 0,
    label: match[4] ?? "",
    iteration: match[5] === undefined ? 0 : Number(match[5]),
  };
}

function compareSemver(next: ParsedSemver, installed: ParsedSemver): number {
  for (let index = 0; index < next.numbers.length; index += 1) {
    if (next.numbers[index] !== installed.numbers[index]) {
      return next.numbers[index] - installed.numbers[index];
    }
  }
  if (next.final !== installed.final) return next.final - installed.final;
  if (next.label !== installed.label) return next.label < installed.label ? -1 : 1;
  return next.iteration - installed.iteration;
}

export function isSemver(version: string): boolean {
  return parseSemver(version) !== undefined;
}

export function isVersionNewer(candidate: string, current: string): boolean {
  const next = parseSemver(candidate);
  const installed = parseSemver(current);
  if (!next || !installed) return false;
  return compareSemver(next, installed) > 0;
}

function isReleaseAsset(value: unknown): value is ReleaseAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.name === "string" &&
    typeof asset.browser_download_url === "string" &&
    typeof asset.size === "number" &&
    (asset.digest == null || typeof asset.digest === "string")
  );
}

export function parseReleases(value: unknown): Release[] {
  if (!Array.isArray(value)) throw new Error("invalid GitHub releases response");
  const releases: Release[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const release = entry as Record<string, unknown>;
    if (typeof release.tag_name !== "string" || !Array.isArray(release.assets)) continue;
    releases.push({
      tag_name: release.tag_name,
      draft: release.draft === true,
      prerelease: release.prerelease === true,
      assets: release.assets.filter(isReleaseAsset),
    });
  }
  return releases;
}

export function githubHeaders(currentVersion: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": `langsmith-codex/${currentVersion}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function assertAllowedDownloadUrl(asset: ReleaseAsset, releaseApi: string): URL {
  const downloadUrl = new URL(asset.browser_download_url);
  const allowed =
    releaseApi === DEFAULT_RELEASE_API
      ? downloadUrl.href.startsWith(RELEASE_DOWNLOAD_PREFIX)
      : downloadUrl.origin === new URL(releaseApi).origin;
  if (!allowed) throw new Error(`release asset ${asset.name} has an unexpected download URL`);
  return downloadUrl;
}

export function sha256FromDigestField(value: string | null | undefined): string | undefined {
  const match = /^sha256:([a-f0-9]{64})$/i.exec(value ?? "");
  return match?.[1].toLowerCase();
}

export function sha256FromSidecarText(text: string, assetName: string): string {
  const match = /^([a-f0-9]{64})\s+[* ]?(\S+)\s*$/im.exec(text);
  if (!match || path.basename(match[2]) !== assetName) {
    throw new Error(`release asset ${assetName} has an invalid SHA-256 sidecar`);
  }
  return match[1].toLowerCase();
}
