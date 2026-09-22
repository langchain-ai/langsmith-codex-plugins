import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import {
  CODESIGN_TIMEOUT_MS,
  DOWNLOAD_TIMEOUT_MS,
  LIST_TIMEOUT_MS,
  MAX_BINARY_BYTES,
  MAX_CHECKSUM_BYTES,
} from "./binary-constants.ts";
import type { ReleaseAsset } from "./binary-models.ts";
import {
  assertAllowedDownloadUrl,
  githubHeaders,
  sha256FromDigestField,
  sha256FromSidecarText,
} from "./updater-utils.ts";

async function expectedSha256(
  asset: ReleaseAsset,
  sidecar: ReleaseAsset | undefined,
  fetchImpl: typeof fetch,
  releaseApi: string,
  currentVersion: string,
): Promise<string> {
  const fromField = sha256FromDigestField(asset.digest);
  if (fromField) return fromField;
  if (!sidecar) throw new Error(`release asset ${asset.name} has no SHA-256 digest or sidecar`);
  if (sidecar.size <= 0 || sidecar.size > MAX_CHECKSUM_BYTES) {
    throw new Error(`release checksum size ${sidecar.size} is outside the allowed range`);
  }
  const response = await fetchImpl(assertAllowedDownloadUrl(sidecar, releaseApi), {
    headers: githubHeaders(currentVersion),
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`failed to download the release checksum: HTTP ${response.status}`);
  }
  return sha256FromSidecarText(await response.text(), asset.name);
}

async function writeWholeChunk(handle: fs.FileHandle, chunk: Buffer): Promise<void> {
  let offset = 0;
  while (offset < chunk.byteLength) {
    const { bytesWritten } = await handle.write(chunk, offset);
    if (bytesWritten === 0) throw new Error("could not write the release asset");
    offset += bytesWritten;
  }
}

export async function downloadAndVerifyAsset(
  asset: ReleaseAsset,
  sidecar: ReleaseAsset | undefined,
  destination: string,
  fetchImpl: typeof fetch,
  releaseApi: string,
  currentVersion: string,
): Promise<void> {
  if (asset.size <= 0 || asset.size > MAX_BINARY_BYTES) {
    throw new Error(`release asset size ${asset.size} is outside the allowed range`);
  }
  const downloadUrl = assertAllowedDownloadUrl(asset, releaseApi);
  const expected = await expectedSha256(asset, sidecar, fetchImpl, releaseApi, currentVersion);

  const response = await fetchImpl(downloadUrl, {
    headers: githubHeaders(currentVersion),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`failed to download the release asset: HTTP ${response.status}`);
  }

  const handle = await fs.open(destination, "wx", 0o700);
  const hash = createHash("sha256");
  let written = 0;
  try {
    for await (const rawChunk of response.body) {
      const chunk = Buffer.from(rawChunk);
      written += chunk.byteLength;
      if (written > asset.size) throw new Error("the release asset exceeds its declared size");
      hash.update(chunk);
      await writeWholeChunk(handle, chunk);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }

  if (written !== asset.size) {
    throw new Error(`release asset size mismatch: expected ${asset.size}, got ${written}`);
  }
  if (hash.digest("hex") !== expected) throw new Error("release asset SHA-256 mismatch");
}

export async function verifyAdHocSignature(binary: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      "/usr/bin/codesign",
      ["--verify", "--strict", binary],
      { timeout: CODESIGN_TIMEOUT_MS },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}
