import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  options: undefined as Record<string, any> | undefined,
  launch: vi.fn(async () => 4242),
}));

vi.mock("@langchain/plugins-base/plugin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langchain/plugins-base/plugin")>()),
  launchDetachedWorker: engine.launch,
  openPluginSession: (options: Record<string, any>) => {
    engine.options = options;
    return { sessionId: options.sessionId, store: { read: async () => undefined } };
  },
}));

import type { Config } from "../src/models/config.js";
import { readJobContext, saveJobContext } from "../src/job-context.js";
import {
  buildLiveToolRuns,
  createCodexTracingSession,
  saveLiveToolRuns,
} from "../src/tracing-engine.js";
import {
  contextSourceRef,
  reconstructionEventId,
  transcriptSourceRef,
} from "../src/tracing-engine-locator.js";
import { ids, outputLine, read } from "./utils/live-wire.js";
import { rolloutText } from "./utils/rollout.js";

const base: Config = {
  enabled: true,
  defaultMuted: false,
  redact: true,
  locked: [],
  api_key: "synthetic-key",
};
let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "codex-engine-"));
  vi.stubEnv("HOME", home);
  engine.options = undefined;
  engine.launch.mockClear();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

function open(config: Config = base, sessionId = "thread-1") {
  createCodexTracingSession(config, sessionId, "/work/repo", home);
  return engine.options!;
}

it("wakes the worker it is asked to wake, with the folder and the engine storage folder", async () => {
  const options = open();
  await expect(options.scheduleWake("stranded-2")).resolves.toBe(4242);
  expect(engine.launch).toHaveBeenCalledWith(["--engine-worker", "stranded-2", "/work/repo"], {
    storageRoot: options.storageRoot,
  });
  expect(options.storageRoot).toBe(path.join(home, ".codex", "langsmith_engine"));
});

it.each([{ replicas: [] }, { replicas: [{ api_url: "https://replica.example" }] }])(
  "opens no session with no API key and no replica with its own key: %j",
  ({ replicas }) => {
    createCodexTracingSession(
      { ...base, api_key: undefined, replicas },
      "thread-1",
      "/work/repo",
      home,
    );
    expect(engine.options).toBeUndefined();
  },
);

it("uploads with the configured CLI profile and workspace when signed in by login", async () => {
  vi.stubEnv("LANGSMITH_API_KEY", undefined);
  vi.stubEnv("LANGSMITH_PROFILE", undefined);
  await mkdir(path.join(home, ".langsmith"));
  await writeFile(
    path.join(home, ".langsmith", "config.json"),
    JSON.stringify({
      current_profile: "default",
      profiles: {
        default: { api_url: "https://one.example", oauth: { access_token: "synthetic-one" } },
        work: { api_url: "https://two.example", oauth: { access_token: "synthetic-two" } },
      },
    }),
  );
  const { writer } = open({
    ...base,
    api_key: undefined,
    profile: "work",
    workspace_id: "11111111-1111-4111-8111-111111111111",
  });
  expect(writer.destinations[0]).toMatchObject({
    apiUrl: "https://two.example",
    login: { profile: "work", workspaceId: "11111111-1111-4111-8111-111111111111" },
  });
});

it("sends the primary upload to the configured agent and refuses an invalid agent ID", () => {
  const { writer } = open({ ...base, agent_id: "my-agent", replicas: [{ project: "copy" }] });
  expect(writer.destinations[0].agentId).toBe("my-agent");
  expect(writer.replicas[0]).not.toHaveProperty("agentId");
  engine.options = undefined;
  createCodexTracingSession({ ...base, agent_id: "Not Valid" }, "thread-2", "/work/repo", home);
  expect(engine.options).toBeUndefined();
});

const parentHeaders = (baggage?: string) => ({
  "langsmith-trace": "20250101T000000000000Z019dbc02-0000-7000-8000-000000000001",
  ...(baggage === undefined ? {} : { baggage }),
});

it.each([
  [
    "a parent in a project beats agent_id",
    "langsmith-project=parent-project",
    "parent-project",
    undefined,
  ],
  [
    "a parent in an agent beats agent_id",
    `langsmith-address=${encodeURIComponent("lrn:agents/parent-agent/environments/staging")}`,
    "configured",
    "parent-agent",
  ],
  ["a parent naming nothing leaves agent_id", undefined, "configured", "my-agent"],
])("nested trace: %s", (_name, baggage, projectName, agentId) => {
  const { writer } = open({
    ...base,
    project: "configured",
    agent_id: "my-agent",
    parent_headers: parentHeaders(baggage) as Config["parent_headers"],
  });
  expect(writer.destinations[0].projectName).toBe(projectName);
  expect(writer.destinations[0].agentId).toBe(agentId);
});

it("keeps a managed-locked agent_id over a parent trace's project or agent", () => {
  for (const baggage of [
    "langsmith-project=parent-project",
    `langsmith-address=${encodeURIComponent("lrn:agents/parent-agent/environments/production")}`,
  ]) {
    const { writer } = open({
      ...base,
      project: "configured",
      agent_id: "my-agent",
      locked: ["agent_id"],
      parent_headers: parentHeaders(baggage) as Config["parent_headers"],
    });
    expect(writer.destinations[0].agentId).toBe("my-agent");
    expect(writer.destinations[0].projectName).toBe("configured");
  }
});

it("uploads to the project named by the parent headers, with the configured redaction", () => {
  const parent = "019dbc02-0000-7000-8000-000000000001";
  const { writer } = open({
    ...base,
    project: "configured",
    api_url: "https://api.example",
    redact_extra_rules: [{ pattern: "secret", replace: "[x]" }],
    parent_headers: {
      "langsmith-trace": `20250101T000000000000Z${parent}`,
      baggage: "langsmith-project=parent-project",
    },
  });
  expect(writer.destinations).toEqual([
    { apiKey: "synthetic-key", apiUrl: "https://api.example", projectName: "parent-project" },
  ]);
  expect(writer.redact).toBe(true);
  expect(writer.redactExtraRules).toEqual([{ pattern: "secret", replace: "[x]" }]);
});

it("keeps a project the managed file locks when the parent headers name another", () => {
  const { writer } = open({
    ...base,
    project: "locked",
    locked: ["project"],
    parent_headers: {
      "langsmith-trace": "20250101T000000000000Z019dbc02-0000-7000-8000-000000000001",
      baggage: "langsmith-project=parent-project",
    },
  });
  expect(writer.destinations[0].projectName).toBe("locked");
  expect(writer.projectLocked).toBe(true);
});

it("opens no session while the managed file is broken, so saved work waits", () => {
  createCodexTracingSession(
    { ...base, managedConfigProblem: "broken" },
    "thread-1",
    "/work/repo",
    home,
  );
  expect(engine.options).toBeUndefined();
});

it("sends the configured replicas to the shared uploader", () => {
  const { writer } = open({
    ...base,
    replicas: [{ api_url: "https://replica.example", api_key: "replica-key", project: "replica" }],
  });
  expect(writer.replicas).toEqual([
    { apiUrl: "https://replica.example", apiKey: "replica-key", projectName: "replica" },
  ]);
});

it("reports a recovery that did not finish and stays quiet when it did", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { onRecoveryReport } = open();
  onRecoveryReport({ status: "completed", report: { scheduled: [], failed: [] } });
  expect(log).not.toHaveBeenCalled();
  onRecoveryReport({ status: "failed", message: "boom", retryable: true });
  expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
  log.mockRestore();
});

async function job(
  options: { turn?: string; refs?: (transcript: string, context: string) => string[] } = {},
) {
  const transcript = path.join(home, "rollout.jsonl");
  await writeFile(transcript, rolloutText("thread-1", ["turn-1"]));
  await mkdir(path.join(home, ".codex"), { recursive: true });
  await writeFile(
    path.join(home, ".codex", "langsmith_state_privacy.json"),
    JSON.stringify({ version: 1, threads: { "thread-1": { turns: { "turn-1": "full" } } } }),
  );
  const sourceRef = transcriptSourceRef(transcript);
  const contextRef = contextSourceRef("thread-1", "turn-1", sourceRef, "full");
  return {
    sourceRef,
    contextRef,
    job: {
      integration: "openai-codex",
      sessionId: "thread-1",
      turnId: options.turn ?? "turn-1",
      eventId: reconstructionEventId("thread-1", "turn-1", sourceRef, "full"),
      accountFingerprint: "fp",
      sourceRefs: options.refs?.(sourceRef, contextRef) ?? [sourceRef, contextRef],
      privacyMode: "full",
      turnEvidence: { childRunIds: [], closureState: "authoritative" },
    },
  };
}

it("rebuilds a turn from the settings saved with its job, not the worker's own", async () => {
  const { job: queued, contextRef } = await job();
  await saveJobContext(home, "thread-1", contextRef, {
    cwd: path.join(home, "project-a"),
    project: "project-a",
    metadata: { owner: "a" },
    parent_headers: undefined,
  });
  const options = open({ ...base, project: "project-b", metadata: { owner: "b" } });

  const { outputs } = await options.reconstruct(queued);

  expect(outputs.length).toBeGreaterThan(0);
  for (const { submission } of outputs) {
    expect(submission.metadata.base.owner).toBe("a");
  }
  expect(readJobContext(home, "thread-1", contextRef)).toBeUndefined();
  await expect(access(path.join(home, ".codex", "langsmith-job-context"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("falls back to the worker's settings, and says so, when the saved settings are gone", async () => {
  const { job: queued } = await job();
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const options = open({ ...base, metadata: { owner: "b" } });

  const { outputs } = await options.reconstruct(queued);

  expect(outputs[0].submission.metadata.base.owner).toBe("b");
  expect(log).toHaveBeenCalledWith(expect.stringContaining("context is missing"));
  log.mockRestore();
});

it("refuses a job that does not carry exactly a transcript and a context locator", async () => {
  const { job: queued } = await job({ refs: (transcript) => [transcript] });
  await expect(open().reconstruct(queued)).rejects.toThrow("transcript and a context locator");
});

it("refuses a job that carries an extra locator", async () => {
  const { job: queued } = await job({
    refs: (transcript, context) => [transcript, context, "extra"],
  });
  await expect(open().reconstruct(queued)).rejects.toThrow("transcript and a context locator");
});

it("fails the job when the transcript has no completed target turn", async () => {
  const { job: queued } = await job({ turn: "unknown-turn" });
  await expect(open().reconstruct(queued)).rejects.toThrow("no completed target turn");
});

it("names the turn's saved root when saving a tool, so the engine needs no scan to find it", async () => {
  const rows = await read("04/23/rollout-editing.jsonl");
  const [session_id, turn_id] = ids(rows);
  const tool_use_id = "call_VLRlIzWNfD2jSDW47dX5eEMz";
  const transcript_path = path.join(home, "rollout.jsonl");
  await writeFile(transcript_path, rows.slice(0, outputLine(tool_use_id, rows) + 1).join("\n"));
  const request = { session_id, turn_id, transcript_path, tool_use_id };
  const runs = (await buildLiveToolRuns(base, request, "full"))!;
  const capture = vi.fn(async (_: Record<string, any>) => ({ status: "published" }));
  const plugin = {
    sessionId: session_id,
    store: { read: async () => undefined },
    session: { capture },
  };

  await saveLiveToolRuns(plugin as any, turn_id, runs);

  const [[root], [tool]] = capture.mock.calls;
  expect(root.submission.run.id).toBe(tool.submission.run.parent_run_id);
  expect(tool.dependencies).toEqual([
    { integration: "openai-codex", sessionId: session_id, turnId: turn_id, eventId: root.eventId },
  ]);
});
