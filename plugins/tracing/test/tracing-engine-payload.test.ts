import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { RunTree } from "langsmith";
import { afterEach, expect, it, vi } from "vitest";
import type { Config } from "../src/models/config.js";
import {
  closingRootSubmission,
  createRunClient,
  postSubmission,
  runIdGenerator,
} from "../src/tracing-engine-payload.js";

const metadata = {
  integration: "openai-codex",
  threadId: "thread",
  agentType: "root",
  runType: "root",
} as const;

function run(): RunTree {
  return new RunTree({ name: "openai.codex", run_type: "chain", inputs: { prompt: "hello" } });
}

it("derives the same run IDs for the same turn so a retry cannot duplicate runs", () => {
  const first = runIdGenerator("session", "turn");
  const retry = runIdGenerator("session", "turn");
  const ids = [first(), first(), first()];
  expect([retry(), retry(), retry()]).toEqual(ids);
  expect(new Set(ids).size).toBe(3);
  expect(runIdGenerator("other", "turn")()).not.toBe(ids[0]);
  expect(runIdGenerator("session", "other")()).not.toBe(ids[0]);
});

it("refuses a run whose metadata has no trusted thread ID", () => {
  expect(() => postSubmission(run(), "full", { ...metadata, threadId: "" })).toThrow(
    "no trusted thread ID",
  );
});

it.each([
  ["name", (value: RunTree) => ((value as unknown as { name?: string }).name = undefined)],
  ["inputs", (value: RunTree) => ((value as unknown as { inputs: unknown }).inputs = "text")],
])("refuses a run whose %s is unavailable", (_field, damage) => {
  const broken = run();
  damage(broken);
  expect(() => postSubmission(broken, "full", metadata)).toThrow("identity or inputs");
});

it("labels a failed run as an error rather than completed", () => {
  const failed = run();
  failed.error = "tool crashed";
  failed.end_time = Date.now();
  expect(postSubmission(failed, "full", metadata).privacyContext).toEqual({ status: "error" });
});

it("keeps the run outputs in the upload", () => {
  const done = run();
  done.outputs = { messages: ["done"] };
  expect(postSubmission(done, "full", metadata).run.outputs).toEqual({ messages: ["done"] });
});

it("closes a failed turn root with an error status and both its error and end time", () => {
  const failed = run();
  failed.error = "turn aborted";
  failed.end_time = Date.now();
  const closing = closingRootSubmission(postSubmission(failed, "full", metadata));
  expect(closing.privacyContext).toEqual({ status: "error" });
  expect(closing.patch.fields).toEqual(["end_time", "error"]);
});

let home: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (home !== undefined) await rm(home, { recursive: true, force: true });
  home = undefined;
});

it("builds the run client from the chosen login profile and workspace", async () => {
  vi.stubEnv("LANGSMITH_API_KEY", "synthetic-shell-key");
  vi.stubEnv("LANGSMITH_PROFILE", undefined);
  home = await mkdtemp(path.join(tmpdir(), "codex-client-"));
  const configPath = path.join(home, "config.json");
  await mkdir(home, { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify({
      current_profile: "default",
      profiles: {
        default: { api_url: "https://one.example", oauth: { access_token: "synthetic-one" } },
        work: { api_url: "https://two.example", oauth: { access_token: "synthetic-two" } },
      },
    }),
  );
  const config: Config = { enabled: true, defaultMuted: false, redact: true, locked: [] };
  const client = createRunClient(config, {
    kind: "login",
    login: { configPath, profile: "work", workspaceId: "ws-1" },
    apiUrl: "https://two.example",
  });
  expect(client).toMatchObject({ apiUrl: "https://two.example", workspaceId: "ws-1" });
  expect(client).toMatchObject({ apiKey: undefined });
});
