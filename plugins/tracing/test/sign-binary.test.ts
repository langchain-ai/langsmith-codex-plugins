import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  acceptedSubmissionId,
  APPLE_CREDENTIALS,
  decodeBase64Credential,
  developerIdIdentity,
  developerIdRequirement,
  missingAppleCredentials,
  sign,
} from "../../../scripts/sign.binary.ts";
import { BINARY_NAME, PUBLISHED_ARCHES } from "../src/binary-constants.ts";
import { releaseAssetName } from "../src/updater-utils.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workflow = readFileSync(join(root, ".github/workflows/build-binary.yml"), "utf8");
const entitlements = readFileSync(join(root, "macos-entitlements.plist"), "utf8");
const watchedPaths = /paths:\n((?:\s+- \S+\n)+)/.exec(workflow)?.[1] ?? "";
const credentials: string[] = [...APPLE_CREDENTIALS];
const allSet = Object.fromEntries(credentials.map((name) => [name, "set"]));
const missing = (env: Record<string, string>): string[] => [...missingAppleCredentials(env)].sort();

function job(name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  expect(start, `the workflow declares no ${name} job`).toBeGreaterThan(-1);
  const rest = workflow.slice(start + 1);
  const end = /\n {2}[a-z][\w-]*:\n/.exec(rest)?.index;
  return end === undefined ? rest : rest.slice(0, end);
}

const FOUND_IDENTITIES = [
  '  1) 0000000000000000000000000000000000000001 "Apple Development: Someone (AAAAAAAAAA)"',
  '  2) 0000000000000000000000000000000000000002 "Developer ID Installer: LangChain (BBBBBBBBBB)"',
  '  3) 0000000000000000000000000000000000000003 "Developer ID Application: LangChain (CCCCCCCCCC)"',
  "     3 valid identities found",
].join("\n");

describe("the Apple credentials", () => {
  it("names the five secrets the signing step is given", () => {
    expect([...credentials].sort()).toEqual([
      "APPLE_API_ISSUER",
      "APPLE_API_KEY",
      "APPLE_API_KEY_ID",
      "CSC_KEY_PASSWORD",
      "CSC_LINK",
    ]);
    for (const name of credentials) expect(workflow).toContain(`secrets.${name} }}`);
  });

  it("reports every unset or blank one", () => {
    expect(missing({})).toEqual([...credentials].sort());
    expect(missing(allSet)).toEqual([]);
    expect(missing({ ...allSet, CSC_LINK: "  \n" })).toEqual(["CSC_LINK"]);
  });
});

describe("sign", () => {
  const absent = join(root, "plugins/tracing/bin/no-such-binary");

  it("refuses to run and names every credential when nothing is set", async () => {
    const lines: string[] = [];
    const attempt = sign({ binaryPath: absent, env: {}, out: (line: string) => lines.push(line) });

    await expect(attempt).rejects.toThrow("these Apple credentials are not set");
    await expect(attempt).rejects.toThrow(credentials.join(", "));
    expect(lines).toEqual([]);
  });

  it("refuses to run when only some credentials are set", async () => {
    const attempt = sign({ binaryPath: absent, env: { ...allSet, APPLE_API_ISSUER: "" } });

    await expect(attempt).rejects.toThrow("APPLE_API_ISSUER");
    await expect(attempt).rejects.not.toThrow("CSC_LINK");
  });
});

describe("developerIdIdentity", () => {
  it("picks the Developer ID Application identity and ignores the others", () => {
    expect(developerIdIdentity(FOUND_IDENTITIES)).toBe(
      "Developer ID Application: LangChain (CCCCCCCCCC)",
    );
  });

  it("rejects a keychain holding no such identity", () => {
    expect(() => developerIdIdentity("     0 valid identities found")).toThrow(
      "Developer ID Application",
    );
  });
});

describe("developerIdRequirement", () => {
  it("pins the Apple anchor and the team the certificate carries", () => {
    expect(developerIdRequirement(developerIdIdentity(FOUND_IDENTITIES))).toBe(
      "=anchor apple generic and certificate leaf[subject.OU] = CCCCCCCCCC",
    );
  });

  it("rejects an identity that ends in no team ID", () => {
    expect(() => developerIdRequirement("Developer ID Application: LangChain")).toThrow(
      "no Apple team ID",
    );
  });
});

describe("decodeBase64Credential", () => {
  it("decodes a wrapped base64 value", () => {
    expect(decodeBase64Credential("bGFuZ3Nt\naXRo\n", "CSC_LINK").toString()).toBe("langsmith");
  });

  it("rejects a value that decodes to nothing", () => {
    expect(() => decodeBase64Credential("   ", "CSC_LINK")).toThrow("CSC_LINK is empty");
  });
});

describe("acceptedSubmissionId", () => {
  it("returns the submission id Apple accepted", () => {
    expect(acceptedSubmissionId({ id: "abc", status: "Accepted" })).toBe("abc");
  });

  it.each([
    [{ id: "abc", status: "Invalid" }, "abc came back Invalid"],
    [{}, "submission came back an unreadable status"],
  ])("refuses %j", (submission, message) => {
    expect(() => acceptedSubmissionId(submission)).toThrow(message);
  });
});

describe("the macOS entitlements", () => {
  it("grants allow-jit and nothing wider", () => {
    expect(entitlements.match(/<key>([^<]+)<\/key>/g)).toEqual([
      "<key>com.apple.security.cs.allow-jit</key>",
    ]);
  });

  it("carries no entitlement that Apple refuses to notarize", () => {
    expect(entitlements).not.toContain("com.apple.security.get-task-allow");
  });
});

describe("the build workflow", () => {
  it("rebuilds the binary when any signing input changes", () => {
    for (const path of [
      "macos-entitlements.plist",
      "scripts/build.bun.ts",
      "scripts/sign.binary.ts",
      "plugins/tracing/test/sign-binary.test.ts",
    ]) {
      expect(watchedPaths).toContain(`- ${path}\n`);
    }
  });

  it("watches only files that exist, so a rename cannot silence it", () => {
    const listed = [...watchedPaths.matchAll(/- (\S+)/g)].map((match) => match[1]);

    expect(listed.length).toBeGreaterThan(0);
    for (const path of listed) expect(existsSync(join(root, path)), path).toBe(true);
  });

  it("always signs, so a release can never go out unsigned", () => {
    const step = /- name: Sign and Notarize the Binary\n((?: {8}.+\n|\n)+)/.exec(
      job("sign-and-notarize"),
    )?.[1];

    expect(step).toBeDefined();
    expect(step).not.toContain("if:");
    for (const name of credentials) expect(step).toContain(`${name}: \${{ secrets.${name} }}`);
  });

  it("reads the Apple secrets only from the job that declares the environment", () => {
    expect(workflow.match(/^\s+environment: /gm)).toHaveLength(1);
    expect(job("sign-and-notarize")).toContain("environment: macos-signing");
    for (const name of credentials) expect(job("build-binary")).not.toContain(`secrets.${name}`);
    for (const name of credentials) expect(job("publish")).not.toContain(`secrets.${name}`);
  });

  it("holds every environment job behind the publishing gate", () => {
    for (const name of ["build-binary", "sign-and-notarize", "publish"]) {
      const body = job(name);
      if (!body.includes("environment: ")) continue;
      expect(body, name).toContain("if: ${{ needs.build-binary.outputs.publishing == 'true' }}");
    }
  });

  it("signs the binary the build job produced and hands the signed one on", () => {
    expect(job("sign-and-notarize")).toContain("pnpm run sign:binary");
    expect(job("sign-and-notarize")).toContain("actions/download-artifact");
    expect(job("publish")).toContain("needs: [build-binary, sign-and-notarize]");
  });

  it("runs the same suite against the unsigned, the Intel and the signed binary", () => {
    const command = /pnpm vitest run .+/;
    const built = job("build-binary").match(command)?.[0];
    expect(built).toBeDefined();
    expect(job("run-x64-on-intel").match(command)?.[0]).toBe(built);
    expect(job("sign-and-notarize").match(command)?.[0]).toBe(built);
  });

  it("restores the executable bit once, in an unconditional step of its own", () => {
    const body = job("sign-and-notarize");

    expect(body.match(/chmod \+x/g)).toHaveLength(1);
    expect(body).toContain(
      "- name: Restore the Executable Bit\n        run: chmod +x plugins/tracing/bin/langsmith-codex-tracing\n",
    );
  });

  it("publishes the asset name the updater and the installer look for", () => {
    expect(/^ +name="(.+)"$/m.exec(job("publish"))?.[1]).toBe(
      releaseAssetName("${TAG}", "${arch}"),
    );
    expect(job("publish")).toContain(`for arch in ${PUBLISHED_ARCHES.join(" ")}; do`);
  });

  it("attaches a SHA-256 sidecar beside every published architecture", () => {
    const body = job("publish");
    expect(body).toContain('sha256sum "$name" > "${name}.sha256"');
    expect(body).toContain('assets+=("release/${name}" "release/${name}.sha256")');
    expect(body.match(/gh release (upload|create) "\$TAG" "\$\{assets\[@\]\}"/g)).toHaveLength(2);
  });

  it("signs each published architecture on a runner of that architecture", () => {
    const body = job("sign-and-notarize");
    const legs = [...body.matchAll(/^ {10}- arch: (\S+)$/gm)].map((match) => match[1]);

    expect(legs).toEqual(PUBLISHED_ARCHES);
    expect(body).toContain("runs-on: ${{ matrix.runner }}");
    expect(body).toContain("architecture: ${{ matrix.arch }}");
    expect(body.match(/runner: macos-26\n/g)).toHaveLength(1);
    expect(body.match(/runner: macos-26-intel\n/g)).toHaveLength(1);
  });

  it("runs the x64 binary on an Intel runner on every build", () => {
    const body = job("run-x64-on-intel");

    expect(body).toContain("runs-on: macos-26-intel");
    expect(body).toContain("needs: build-binary");
    expect(body).not.toContain("publishing == 'true'");
    expect(body).toContain(`name: ${BINARY_NAME}-darwin-x64-unsigned`);
  });

  it("uploads every architecture under the one name the later jobs look for", () => {
    const uploads = [...job("build-binary").matchAll(/^ {10}path: (\S+)$/gm)].map(
      (match) => match[1],
    );

    expect(uploads).toEqual([
      `plugins/tracing/bin/${BINARY_NAME}`,
      `plugins/tracing/bin/darwin-x64/${BINARY_NAME}`,
    ]);
    for (const arch of PUBLISHED_ARCHES) {
      expect(job("build-binary"), arch).toContain(`name: ${BINARY_NAME}-darwin-${arch}-unsigned\n`);
    }
  });

  it("publishes only what the signing job signed, never the unsigned build", () => {
    const signing = job("sign-and-notarize");

    expect(signing).toContain(`name: ${BINARY_NAME}-darwin-\${{ matrix.arch }}-unsigned`);
    expect(signing).toContain(`name: ${BINARY_NAME}-darwin-\${{ matrix.arch }}-signed`);
    expect(job("publish")).toContain(`pattern: ${BINARY_NAME}-darwin-*-signed`);
    expect(job("publish")).toContain(`-signed/${BINARY_NAME}" "release/`);
    expect(job("publish")).not.toContain("-unsigned");
  });

  it("tests the ref for a tag once and shares that answer with the other jobs", () => {
    expect(workflow.match(/refs\/tags\//g)).toHaveLength(1);
    expect(workflow).toContain("PUBLISHING: ${{ startsWith(github.ref, 'refs/tags/') }}");
    expect(workflow).toContain("publishing: ${{ steps.release-gate.outputs.publishing }}");
    expect(workflow.match(/needs\.build-binary\.outputs\.publishing == 'true'/g)).toHaveLength(2);
  });
});
