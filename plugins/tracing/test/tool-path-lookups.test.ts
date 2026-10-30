import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootFromGitMarker } from "@langchain/plugins-base/git";
import { beforeEach, expect, it, vi } from "vitest";
import { toolOriginFromArgs } from "../src/tool-path.js";

vi.mock("@langchain/plugins-base/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("@langchain/plugins-base/git")>();
  return { ...original, rootFromGitMarker: vi.fn(original.rootFromGitMarker) };
});

beforeEach(() => {
  vi.mocked(rootFromGitMarker).mockClear();
});

const patchOf = (files: string[]) =>
  `*** Begin Patch\n${files.map((file) => `*** Add File: ${file}\n+x`).join("\n")}\n*** End Patch`;

it("looks up at most twenty paths for a repo", () => {
  const input = patchOf(Array.from({ length: 100 }, (_, n) => `/work/plain/f${n}.txt`));
  toolOriginFromArgs({ input }, "/work/a");
  expect(rootFromGitMarker).toHaveBeenCalledTimes(20);
});

it("looks up a repeated path only once", () => {
  const input = patchOf(Array.from({ length: 5 }, () => "/work/plain/same.txt"));
  toolOriginFromArgs({ input }, "/work/a");
  expect(rootFromGitMarker).toHaveBeenCalledTimes(1);
});

it("stops looking once a path sits in a repo", () => {
  const repo = mkdtempSync(join(tmpdir(), "tool-path-lookups-"));
  mkdirSync(join(repo, ".git"));
  const input = patchOf([`${repo}/first.txt`, "/work/plain/a.txt", "/work/plain/b.txt"]);
  expect(toolOriginFromArgs({ input }, "/work/a").path).toBe(`${repo}/first.txt`);
  expect(rootFromGitMarker).toHaveBeenCalledTimes(1);
});
