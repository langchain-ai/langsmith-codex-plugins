import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateFromGitHub } from "../src/updater.js";
import { MAX_BINARY_BYTES } from "../src/sea-constants.js";
import { newestInstallableRelease } from "../src/updater-releases.js";
import {
  isPublishedSeaTarget,
  isVersionNewer,
  parseReleases,
  releaseAssetName,
} from "../src/updater-utils.js";

const { execFile } = vi.hoisted(() => ({
  execFile: vi.fn((_command, _args, _options, callback) => callback(null)),
}));
vi.mock("node:child_process", () => ({ execFile }));

const RELEASE_API = "http://releases.test/releases";
const EXECUTABLE = "langsmith-codex-tracing";
const LOCK_FILE = ".update.lock";
const BODY = new TextEncoder().encode("a newer binary");
const CODESIGN = ["/usr/bin/codesign", ["--verify", "--strict", expect.any(String)]];

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "codex-update-"));
}

function stamp(file: string, mtimeMs: number): string {
  writeFileSync(file, "held");
  utimesSync(file, new Date(mtimeMs), new Date(mtimeMs));
  return file;
}

function release(tag: string, body = BODY, digest: string | null = `sha256:${sha256(body)}`) {
  const name = releaseAssetName(tag);
  const url = `http://releases.test/download/${tag}/${name}`;
  const asset = { name, browser_download_url: url, size: body.byteLength, digest };
  const sidecar = { name: `${name}.sha256`, browser_download_url: `${url}.sha256`, size: 80 };
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: digest === null ? [asset, sidecar] : [asset],
  };
}

function fetchSequence(...responses: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
  return fetchImpl;
}

let dir: string;
let target: string;
beforeEach(() => {
  dir = tempDir();
  target = path.join(dir, EXECUTABLE);
  writeFileSync(target, "the old binary");
});

function opts(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return {
    currentVersion: "0.1.0",
    installDir: dir,
    fetchImpl,
    releaseApi: RELEASE_API,
    runtimePlatform: "darwin" as NodeJS.Platform,
    runtimeArch: "arm64",
    ...extra,
  };
}

it("targets only newer stable releases carrying this plugin's asset, on the published platform", () => {
  expect(isVersionNewer("1.0.0", "0.99.99")).toBe(true);
  expect(isVersionNewer("v0.2.0-beta.1", "0.1.0")).toBe(false);
  expect(isVersionNewer("latest", "0.1.0")).toBe(false);
  expect(releaseAssetName("v0.1.0")).toBe(`${EXECUTABLE}-darwin-arm64-v0.1.0-unsigned`);
  expect(isPublishedSeaTarget("darwin", "arm64")).toBe(true);
  expect(isPublishedSeaTarget("darwin", "x64")).toBe(false);
  expect(isPublishedSeaTarget("win32", "x64")).toBe(false);
  expect(isPublishedSeaTarget("linux", "arm64")).toBe(false);

  const releases = parseReleases([
    { ...release("v0.9.0"), draft: true },
    { ...release("v0.8.0"), prerelease: true },
    { tag_name: "v0.7.0", assets: [{ name: "other", browser_download_url: "x", size: 1 }] },
    release("v0.2.0"),
    release("v0.3.0"),
  ]);
  expect(newestInstallableRelease(releases)?.tag_name).toBe("v0.3.0");
  expect(newestInstallableRelease(releases, "0.3.0")).toBeUndefined();
  expect(() => parseReleases({ tag_name: "v0.1.0" })).toThrow("invalid GitHub releases response");
});

describe("updateFromGitHub", () => {
  it.each([
    ["the digest on the asset", [Response.json([release("v0.2.0")]), new Response(BODY)]],
    [
      "the published checksum sidecar",
      [
        Response.json([release("v0.2.0", BODY, null)]),
        new Response(`${sha256(BODY)}  ${releaseAssetName("v0.2.0")}\n`),
        new Response(BODY),
      ],
    ],
  ])("replaces the installed binary after verifying %s", async (_label, responses) => {
    const fetchImpl = fetchSequence(...responses);

    await expect(updateFromGitHub(opts(fetchImpl))).resolves.toEqual({
      status: "updated",
      version: "0.2.0",
    });
    expect(readFileSync(target)).toEqual(Buffer.from(BODY));
    expect(fetchImpl.mock.calls[0][0]).toBe(`${RELEASE_API}?per_page=30`);
    expect(execFile).toHaveBeenCalledWith(...CODESIGN, { timeout: 120_000 }, expect.any(Function));
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["the checksum does not match", { digest: `sha256:${"0".repeat(64)}` }, "SHA-256 mismatch"],
    ["the asset is hosted elsewhere", { url: "http://attacker.test/x" }, "unexpected download URL"],
    [
      "the signature is rejected",
      { verifySignature: () => Promise.reject(new Error("invalid signature")) },
      "invalid signature",
    ],
    ["the asset declares no bytes", { size: 0 }, "outside the allowed range"],
    ["the asset declares more than the cap", { size: MAX_BINARY_BYTES + 1 }, "allowed range"],
    ["the body stops short of the declared size", { body: BODY.slice(0, 4) }, "size mismatch"],
    ["the body runs past the declared size", { size: 4 }, "exceeds its declared size"],
  ])("keeps the installed binary when %s", async (_label, tamper, message) => {
    const { digest, url, size, body, ...extra } = tamper;
    const payload = release("v0.2.0", BODY, (digest as string) ?? `sha256:${sha256(BODY)}`);
    if (url) payload.assets[0].browser_download_url = url as string;
    if (size !== undefined) payload.assets[0].size = size as number;
    const fetchImpl = fetchSequence(
      Response.json([payload]),
      new Response((body as typeof BODY) ?? BODY),
    );

    await expect(updateFromGitHub(opts(fetchImpl, extra))).rejects.toThrow(message);
    expect(readFileSync(target, "utf8")).toBe("the old binary");
  });

  it("releases the lock whether GitHub answers or not", async () => {
    const lockFile = path.join(dir, LOCK_FILE);

    const failing = fetchSequence(new Response("rate limited", { status: 403 }));
    await expect(updateFromGitHub(opts(failing))).rejects.toThrow("HTTP 403");
    expect(existsSync(lockFile)).toBe(false);

    const current = fetchSequence(Response.json([release("v0.1.0")]));
    await expect(updateFromGitHub(opts(current))).resolves.toEqual({ status: "current" });
    expect(existsSync(lockFile)).toBe(false);
  });

  it.each([
    ["another updater holds the lock", "busy"],
    ["the platform has no published binary", "unsupported"],
  ])("does not reach the network when %s", async (situation, status) => {
    const now = Date.now();
    const extra: Record<string, unknown> = { now: () => now };

    if (status === "busy") stamp(path.join(dir, LOCK_FILE), now);
    if (status === "unsupported") extra.runtimePlatform = "win32";

    const fetchImpl = vi.fn<typeof fetch>();
    await expect(updateFromGitHub(opts(fetchImpl, extra))).resolves.toEqual({ status });
    expect(fetchImpl, situation).not.toHaveBeenCalled();
  });
});

it("installs nothing when no release carries this plugin's asset", async () => {
  const assets = [{ name: "other", browser_download_url: "x", size: 3 }];
  const fetchImpl = fetchSequence(Response.json([{ tag_name: "v9.9.9", assets }]));

  await expect(updateFromGitHub(opts(fetchImpl))).resolves.toEqual({ status: "current" });
  expect(readFileSync(target, "utf8")).toBe("the old binary");
});
