import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const repoRoot = new URL("../../../", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/build-binary.yml", repoRoot), "utf8");
const lockfile = readFileSync(new URL("pnpm-lock.yaml", repoRoot), "utf8");

it("builds with the same commit of the shared pipeline the repository installs", () => {
  const pinned = /uses: langchain-ai\/langsmith-plugin-binary\/\S+@([0-9a-f]{40})/.exec(
    workflow,
  )?.[1];

  expect(pinned).toBeDefined();
  expect(lockfile).toContain(`langsmith-plugin-binary/tar.gz/${pinned}`);
});

it("keeps every setting a release depends on", () => {
  expect(workflow).toContain("contents: write");
  expect(workflow).toContain("secrets: inherit");
  expect(workflow).not.toContain("paths:");
  expect(workflow).not.toContain("concurrency:");
});
