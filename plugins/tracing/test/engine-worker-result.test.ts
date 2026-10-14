import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  result: "completed",
  apiKey: "synthetic-worker-result-key" as string | undefined,
}));

vi.mock("@langchain/plugins-base/plugin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langchain/plugins-base/plugin")>()),
  openPluginSession: () => ({ session: { drain: async () => engine.result } }),
}));

vi.mock("../src/config.js", () => ({
  getConfig: async () => ({
    enabled: true,
    api_key: engine.apiKey,
    api_url: "http://127.0.0.1:9/api/v1",
    project: "worker-result",
    redact: false,
  }),
}));

import { runCodexEngineWorker } from "../src/tracing-engine.js";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "codex-worker-result-"));
  vi.stubEnv("HOME", home);
  await mkdir(path.join(home, ".codex"));
});
afterEach(async () => {
  engine.result = "completed";
  engine.apiKey = "synthetic-worker-result-key";
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

const warningFile = () => path.join(home, ".codex", "langsmith-warning.txt");

it("fails the worker and leaves a warning for the next hook when work is dropped", async () => {
  engine.result = "dropped";
  await expect(runCodexEngineWorker("thread", process.cwd())).rejects.toThrow("dropped");
  expect(await readFile(warningFile(), "utf8")).toContain("API key");
});

it("fails the worker without a warning when the account changed", async () => {
  engine.result = "scope-mismatch";
  await expect(runCodexEngineWorker("thread", process.cwd())).rejects.toThrow("scope-mismatch");
  await expect(readFile(warningFile(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("fails the worker when there is no credential to upload with", async () => {
  engine.apiKey = undefined;
  await expect(runCodexEngineWorker("thread", process.cwd())).rejects.toThrow("unavailable");
});
