import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const repoRoot = new URL("../../../", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/build-binary.yml", repoRoot), "utf8");
const lockfile = readFileSync(new URL("pnpm-lock.yaml", repoRoot), "utf8");

it("builds with the same release of the shared pipeline the repository installs", () => {
  const release = /uses: langchain-ai\/langsmith-plugin-binary\/\S+@[0-9a-f]{40} # v(\S+)/.exec(
    workflow,
  )?.[1];
  const installed = JSON.parse(readFileSync(new URL("package.json", repoRoot), "utf8"))
    .devDependencies["@langchain/plugins-base"];

  expect(release).toBeDefined();
  expect(installed).toBe(release);
  expect(lockfile).toContain(`'@langchain/plugins-base@${release}`);
});

it("keeps every setting a release depends on", () => {
  expect(workflow).toContain("contents: write");
  expect(workflow).toContain("secrets: inherit");
  expect(workflow).not.toContain("paths:");
  expect(workflow).not.toContain("concurrency:");
});
