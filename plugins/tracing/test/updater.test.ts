import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateFromGitHub } from "../src/updater.js";
import { MAX_BINARY_BYTES, PUBLISHED_ARCHES } from "../src/binary-constants.js";
import { newestInstallableRelease } from "../src/updater-releases.js";
import {
  isPublishedTarget,
  isSemver,
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

function release(
  tag: string,
  body = BODY,
  digest: string | null = `sha256:${sha256(body)}`,
  arch = "arm64",
) {
  const name = releaseAssetName(tag, arch);
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
  expect(isVersionNewer("v0.2.0-beta.1", "0.1.0")).toBe(true);
  expect(isVersionNewer("v0.2.0-beta", "0.1.0")).toBe(true);
  expect(isVersionNewer("v0.2.0-Beta.1", "0.1.0")).toBe(false);
  expect(isVersionNewer("latest", "0.1.0")).toBe(false);
  expect(releaseAssetName("v0.1.0", "arm64")).toBe(`${EXECUTABLE}-darwin-arm64-v0.1.0`);
  expect(releaseAssetName("v0.1.0", "x64")).toBe(`${EXECUTABLE}-darwin-x64-v0.1.0`);
  expect(PUBLISHED_ARCHES).toEqual(["arm64", "x64"]);
  expect(isPublishedTarget("darwin", "arm64")).toBe(true);
  expect(isPublishedTarget("darwin", "x64")).toBe(true);
  expect(isPublishedTarget("darwin", "ia32")).toBe(false);
  expect(isPublishedTarget("win32", "x64")).toBe(false);
  expect(isPublishedTarget("linux", "arm64")).toBe(false);

  const releases = parseReleases([
    { ...release("v0.9.0"), draft: true },
    { ...release("v0.8.0"), prerelease: true },
    { tag_name: "v0.7.0", assets: [{ name: "other", browser_download_url: "x", size: 1 }] },
    release("v0.2.0"),
    release("v0.3.0"),
  ]);
  expect(newestInstallableRelease(releases, "arm64")?.tag_name).toBe("v0.3.0");
  expect(newestInstallableRelease(releases, "arm64", "0.3.0")).toBeUndefined();
  expect(() => parseReleases({ tag_name: "v0.1.0" })).toThrow("invalid GitHub releases response");
});

it("orders a prerelease below the release it leads to", () => {
  expect(isVersionNewer("0.5.0", "0.5.0-beta.1")).toBe(true);
  expect(isVersionNewer("0.5.0-beta.1", "0.5.0")).toBe(false);
  expect(isVersionNewer("0.5.0-beta.1", "0.4.9")).toBe(true);
  expect(isVersionNewer("0.4.9", "0.5.0-beta.1")).toBe(false);
  expect(isVersionNewer("0.5.0-beta.10", "0.5.0-beta.2")).toBe(true);
  expect(isVersionNewer("0.5.0-beta.2", "0.5.0-beta.10")).toBe(false);
  expect(isVersionNewer("0.5.0-beta.1", "0.5.0-alpha.99")).toBe(true);
  expect(isVersionNewer("0.5.0-alpha.99", "0.5.0-beta.1")).toBe(false);
  expect(isVersionNewer("0.5.0-beta.1", "0.5.0-beta.1")).toBe(false);
  expect(isVersionNewer("0.6.0-beta.1", "0.5.0")).toBe(true);

  const prerelease = { ...release("0.5.0-beta.1"), prerelease: true };
  const listed = parseReleases([prerelease, release("0.4.0")]);
  expect(newestInstallableRelease(listed, "arm64")?.tag_name).toBe("0.4.0");
  expect(newestInstallableRelease(parseReleases([prerelease]), "arm64")).toBeUndefined();
});

const ARM_BODY = new TextEncoder().encode("the arm64 binary");
const INTEL_BODY = new TextEncoder().encode("the x64 binary");

function bothArches(tag: string, sidecarFirst = false) {
  const assets = [];
  for (const [arch, body] of [
    ["arm64", ARM_BODY],
    ["x64", INTEL_BODY],
  ] as const) {
    const name = releaseAssetName(tag, arch);
    const url = `http://releases.test/download/${tag}/${name}`;
    const binary = {
      name,
      browser_download_url: url,
      size: body.byteLength,
      digest: `sha256:${sha256(body)}`,
    };
    const sidecar = { name: `${name}.sha256`, browser_download_url: `${url}.sha256`, size: 80 };
    assets.push(...(sidecarFirst ? [sidecar, binary] : [binary, sidecar]));
  }
  return { tag_name: tag, draft: false, prerelease: false, assets };
}

describe.each([
  ["the binary listed before its sidecar", false],
  ["the sidecar listed before its binary", true],
])("a release carrying all four assets with %s", (_label, sidecarFirst) => {
  it.each([
    ["arm64", ARM_BODY],
    ["x64", INTEL_BODY],
  ])("installs the %s binary and never a sidecar", async (arch, body) => {
    const listing = bothArches("0.2.0", sidecarFirst);
    const fetchImpl = fetchSequence(Response.json([listing]), new Response(body));

    await expect(updateFromGitHub(opts(fetchImpl, { runtimeArch: arch }))).resolves.toEqual({
      status: "updated",
      version: "0.2.0",
    });
    expect(readFileSync(target)).toEqual(Buffer.from(body));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      `http://releases.test/download/0.2.0/${releaseAssetName("0.2.0", arch)}`,
    );
  });
});

describe("selecting a release by architecture", () => {
  it("finds a release carrying all four assets for either architecture", () => {
    const releases = parseReleases([bothArches("0.2.0")]);
    for (const arch of PUBLISHED_ARCHES) {
      expect(newestInstallableRelease(releases, arch)?.tag_name).toBe("0.2.0");
    }
    expect(newestInstallableRelease(releases, "ia32")).toBeUndefined();
  });

  it("installs a release that carries only this machine's architecture", async () => {
    const only = release("0.2.0", INTEL_BODY, `sha256:${sha256(INTEL_BODY)}`, "x64");
    const fetchImpl = fetchSequence(Response.json([only]), new Response(INTEL_BODY));

    await expect(updateFromGitHub(opts(fetchImpl, { runtimeArch: "x64" }))).resolves.toEqual({
      status: "updated",
      version: "0.2.0",
    });
    expect(readFileSync(target)).toEqual(Buffer.from(INTEL_BODY));
  });

  it("leaves the binary alone when only the other architecture is published", async () => {
    const fetchImpl = fetchSequence(Response.json([release("0.2.0")]));

    await expect(updateFromGitHub(opts(fetchImpl, { runtimeArch: "x64" }))).resolves.toEqual({
      status: "current",
    });
    expect(readFileSync(target, "utf8")).toBe("the old binary");
  });
});

it("parses a bare prerelease and sorts it as the first iteration of its label", () => {
  expect(isSemver("0.4.0-beta")).toBe(true);
  expect(isSemver("v0.4.0-beta")).toBe(true);
  expect(isSemver("0.4.0-Beta")).toBe(false);

  expect(isVersionNewer("0.4.0-beta.1", "0.4.0-beta")).toBe(true);
  expect(isVersionNewer("0.4.0-beta", "0.4.0-beta.1")).toBe(false);
  expect(isVersionNewer("0.4.0", "0.4.0-beta")).toBe(true);
  expect(isVersionNewer("0.4.0-beta", "0.4.0")).toBe(false);
  expect(isVersionNewer("0.4.0-beta", "0.4.0-alpha")).toBe(true);
  expect(isVersionNewer("0.4.0-alpha", "0.4.0-beta")).toBe(false);
  expect(isVersionNewer("0.4.0-beta", "0.4.0-beta")).toBe(false);
});

it("updates an installed prerelease to the release, and never to another prerelease", async () => {
  const current = { currentVersion: "0.5.0-beta.1" };
  const newer = { ...release("0.5.0-beta.2"), prerelease: true };

  const stuck = fetchSequence(Response.json([newer]));
  await expect(updateFromGitHub(opts(stuck, current))).resolves.toEqual({ status: "current" });
  expect(readFileSync(target, "utf8")).toBe("the old binary");

  const shipped = fetchSequence(Response.json([newer, release("0.5.0")]), new Response(BODY));
  await expect(updateFromGitHub(opts(shipped, current))).resolves.toEqual({
    status: "updated",
    version: "0.5.0",
  });
  expect(readFileSync(target)).toEqual(Buffer.from(BODY));
});

describe("updateFromGitHub", () => {
  it.each([
    ["the digest on the asset", [Response.json([release("v0.2.0")]), new Response(BODY)]],
    [
      "the published checksum sidecar",
      [
        Response.json([release("v0.2.0", BODY, null)]),
        new Response(`${sha256(BODY)}  ${releaseAssetName("v0.2.0", "arm64")}\n`),
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
    expect(fetchImpl.mock.calls[0][0]).toBe(`${RELEASE_API}?per_page=100`);
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
