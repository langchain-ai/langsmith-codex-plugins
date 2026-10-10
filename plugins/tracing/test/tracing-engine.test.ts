import { afterEach, expect, it, vi } from "vitest";
import { createCaptureStore } from "@langchain/plugins-base/storage/capture";
import { tryAcquireFileLock } from "@langchain/plugins-base/storage";
import { vol } from "memfs";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createCodexTracingSession, handleCodexToolHook } from "../src/tracing-engine.js";
import type { Config } from "../src/config.js";
import type { TracingHookInput } from "../src/models/tracing-hook.js";
import { stableRunId } from "../src/trace-delivery.js";
import { TOOL_COMPLETE_EVENT_SUFFIX, TOOL_START_EVENT_SUFFIX } from "../src/constants.js";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

afterEach(() => {
  vol.reset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("saves a completed tool without its transcript while the shared worker lock is held", async () => {
  const home = "/home/codex-user";
  const sessionId = "session-test";
  const turnId = "turn-test";
  const cwd = "/repo";
  const transcript = join(home, ".codex", "sessions", "missing-rollout.jsonl");
  const key = "synthetic-test-key";
  const endpoint = "http://localhost:8123";
  const project = "codex-test";
  const config: Config = {
    enabled: true,
    defaultMuted: false,
    api_key: key,
    api_url: endpoint,
    project,
    redact: false,
  };
  vol.fromJSON({
    [join(home, ".codex", "langsmith-state.privacy.json")]: JSON.stringify({
      version: 1,
      threads: { [sessionId]: { turns: { [turnId]: "full" } } },
    }),
  });
  vi.stubEnv("HOME", home);
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", key);
  vi.stubEnv("LANGSMITH_CODEX_ENDPOINT", endpoint);
  vi.stubEnv("LANGSMITH_CODEX_PROJECT", project);
  vi.stubEnv("LANGSMITH_CODEX_REDACT", "false");
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const requests: { url: string; method: string; body: BodyInit | null }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ?? null,
    });
    return new Response(null, { status: 200 });
  });

  const start: TracingHookInput = {
    session_id: sessionId,
    turn_id: turnId,
    transcript_path: transcript,
    hook_event_name: "PreToolUse",
    cwd,
    prompt: "test",
    tool_use_id: "call-1",
    tool_name: "exec",
    tool_input: { cmd: "printf saved" },
  };
  const launchWorker = () => {
    throw new Error("The worker is already active");
  };
  await handleCodexToolHook(start, config, undefined, home, launchWorker);

  const context = createCodexTracingSession(config, sessionId, cwd, home, launchWorker);
  expect(context).toBeDefined();
  const toolRunId = stableRunId(sessionId, transcript, turnId, "tool:call-1");
  const startScope = {
    integration: "openai-codex",
    sessionId,
    turnId,
    eventId: `${toolRunId}${TOOL_START_EVENT_SUFFIX}`,
  };
  expect(await context!.captureStore.read(startScope)).toBeDefined();

  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const workerLockPath = join(
    context!.storageRoot,
    "background-worker",
    "integrations",
    "openai-codex",
    "sessions",
    hash(sessionId),
    "accounts",
    hash(context!.accountFingerprint),
    "worker",
  );
  await mkdir(dirname(workerLockPath), { recursive: true });
  const workerLock = await tryAcquireFileLock(workerLockPath);
  expect(workerLock).toBeDefined();
  const completion = {
    ...start,
    hook_event_name: "PostToolUse" as const,
    tool_response: "saved-output",
  };
  await handleCodexToolHook(completion, config, undefined, home, launchWorker);
  expect(vol.existsSync(transcript)).toBe(false);

  const reconstructionStore = createCaptureStore(join(context!.storageRoot, "reconstruction-v1"));
  const completionScope = {
    integration: "openai-codex",
    sessionId,
    turnId,
    eventId: `${toolRunId}${TOOL_COMPLETE_EVENT_SUFFIX}`,
  };
  const saved = await reconstructionStore.read(completionScope);
  expect(saved).toBeDefined();
  expect(saved?.normalizedPayload).toMatchObject({
    sourceSnapshots: [
      {
        submission: {
          patch: { values: { outputs: { output: "saved-output" } } },
        },
      },
    ],
  });

  await workerLock!.release();
  await expect(
    handleCodexToolHook(completion, config, undefined, home, launchWorker),
  ).resolves.toBeUndefined();
  const restarted = createCodexTracingSession(config, sessionId, cwd, home, launchWorker);
  expect(restarted).toBeDefined();
  const result = await restarted!.session.drain();
  expect(result).toBe("completed");
  const debug = {
    result,
    requests: requests.map(({ url, method }) => ({ url, method })),
    captures: (await context!.captureStore.enumerate("openai-codex", sessionId)).map(
      ({ record }) => ({
        eventId: record.eventId,
        eventKind: record.eventKind,
        runId: record.runId,
      }),
    ),
  };
  expect(requests.length, JSON.stringify(debug)).toBeGreaterThanOrEqual(2);
  await expect(
    context!.captureStore.readOutcome(startScope, context!.destinations[0]!.id),
    JSON.stringify(debug),
  ).resolves.toMatchObject({
    status: "settled",
    receipt: { outcome: "delivered" },
  });
  await expect(
    reconstructionStore.readOutcome(completionScope, context!.accountFingerprint),
  ).resolves.toMatchObject({ status: "settled", receipt: { outcome: "delivered" } });
});
