import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tryAcquireFileLock } from "@langchain/plugins-base/storage";
import { createCaptureStore } from "@langchain/plugins-base/storage/capture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig } from "../src/config.js";
import { createCodexTracingSession } from "../src/tracing-engine.js";
import { readCapturedTools } from "../src/tool-capture.js";
import { stableRunId } from "../src/trace-delivery.js";
import { TOOL_COMPLETE_EVENT_SUFFIX, TOOL_START_EVENT_SUFFIX } from "../src/constants.js";

// Exercise the installed bundle, real file discovery, and real SDK. Only the
// destination is local; no Client/RunTree/config or fetch mocks are involved.
let dir: string;
let home: string;
let cwd: string;
let server: Server;
let api: string;
type Payload = Record<string, any>;
let requests: { method: string; path: string; key?: string; body: Payload }[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), "codex-config-wire-"));
  home = join(dir, "home");
  cwd = join(dir, "project");
  await fs.mkdir(join(home, ".codex"), { recursive: true });
  await fs.mkdir(join(cwd, ".codex"), { recursive: true });
  requests = [];
  server = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.endsWith("/info")) {
      res.end(JSON.stringify({ batch_ingest_config: { use_multipart_endpoint: false } }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({
      method: req.method!,
      path: req.url!,
      key: typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : undefined,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  api = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await fs.rm(dir, { recursive: true, force: true });
});

function childEnvironment(env: Record<string, string> = {}) {
  return {
    PATH: process.env.PATH ?? "",
    ...(process.env.SystemRoot === undefined ? {} : { SystemRoot: process.env.SystemRoot }),
    HOME: home,
    USERPROFILE: home,
    TEMP: dir,
    TMP: dir,
    TMPDIR: dir,
    ...env,
  };
}

async function directoryContainsFiles(directory: string): Promise<boolean> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (!entries) return false;
  for (const entry of entries) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && (await directoryContainsFiles(join(directory, entry.name))))
      return true;
  }
  return false;
}

async function runHookProcess(event: Record<string, unknown>, env: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../dist/index.mjs", import.meta.url))],
    {
      cwd: dir, // Discovery must use the payload cwd, not the process/plugin cwd.
      env: childEnvironment(env),
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(JSON.stringify({ session_id: "thread", turn_id: "turn", cwd, ...event }));
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  return { code, stdout, stderr };
}

async function hook(event: Record<string, unknown>, env: Record<string, string> = {}) {
  const result = await runHookProcess(event, env);
  expect(result).toEqual({ code: 0, stdout: "", stderr: "" });
}

async function upload(env: Record<string, string> = {}) {
  const timestamp = new Date().toISOString();
  const event = (type: string, payload: Record<string, unknown>) => ({
    timestamp,
    type,
    payload,
  });
  const transcript_path = join(cwd, "rollout.jsonl");
  await fs.writeFile(
    transcript_path,
    [
      event("session_meta", {
        id: "thread",
        source: "cli",
        model_provider: "test",
        cli_version: "0.153.4",
      }),
      event("event_msg", { type: "task_started", turn_id: "turn" }),
      event("turn_context", { turn_id: "turn", model: "test-model" }),
      event("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "PRIVATE_BODY ACME-123" }],
      }),
      event("response_item", {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "PRIVATE_BODY ACME-456" }],
      }),
      event("event_msg", { type: "turn_complete", turn_id: "turn" }),
    ]
      .map((line) => JSON.stringify(line))
      .join("\n"),
  );
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
  await hook({ hook_event_name: "Stop", transcript_path }, env);
  const runs = () =>
    requests.filter(({ method }) => method === "POST").flatMap(({ body }) => body.post ?? [body]);
  await vi.waitFor(
    () => {
      expect(runs().length).toBeGreaterThanOrEqual(2);
      expect(
        requests.some(({ method, path }) => method === "PATCH" && /\/runs\/[^/]+$/.test(path)),
      ).toBe(true);
      return expect(
        directoryContainsFiles(join(home, ".codex/langsmith_engine_v1/background-worker")),
      ).resolves.toBe(false);
    },
    { timeout: 5000, interval: 25 },
  );
  return runs();
}

it("saves PostToolUse output without its transcript while the worker is locked", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({
      enabled: true,
      defaultMuted: false,
      redact: true,
      redact_extra_rules: [{ pattern: "SENSITIVE", replace: "SENSITIVE-REDACTED" }],
      api_url: `${api}/primary`,
      api_key: "primary-key",
      project: "primary-project",
      replicas: [],
    }),
  );
  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work" },
    { TRACE_TO_LANGSMITH: "true" },
  );
  const config = await getConfig({ home, cwd, env: { HOME: home, TRACE_TO_LANGSMITH: "true" } });
  const context = createCodexTracingSession(config, "thread", cwd, home);
  expect(context).toBeDefined();
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const workerDirectory = join(
    context!.storageRoot,
    "background-worker",
    "integrations",
    "openai-codex",
    "sessions",
    hash("thread"),
    "accounts",
    hash(context!.accountFingerprint),
  );
  const lock = await tryAcquireFileLock(join(workerDirectory, "worker"));
  if (!lock) throw new Error("Could not hold the test worker lock");
  const transcript = join(cwd, "missing.jsonl");
  const sessionDirectory = join(home, ".codex", "sessions", "2026", "10", "10");
  await fs.mkdir(sessionDirectory, { recursive: true });
  await fs.writeFile(
    join(sessionDirectory, "rollout-thread.jsonl"),
    JSON.stringify({ type: "session_meta", payload: { id: "thread", cwd } }),
  );
  const clockFile = join(dir, "test-clock.cjs");
  const oldEnvironment = {
    NODE_OPTIONS: `--require="${clockFile}"`,
    CODEX_TEST_NOW: String(Date.now() - 3 * 60 * 60 * 1000),
  };
  await fs.writeFile(
    clockFile,
    "const value = Number(process.env.CODEX_TEST_NOW); if (Number.isSafeInteger(value)) Date.now = () => value;\n",
  );
  const tool = {
    transcript_path: transcript,
    tool_use_id: "call-1",
    tool_name: "Bash",
    tool_input: { cmd: "SENSITIVE" },
  };
  const completion = {
    ...tool,
    hook_event_name: "PostToolUse" as const,
    tool_response: { stdout: "SENSITIVE" },
  };
  const toolRunId = stableRunId("thread", transcript, "turn", "tool:call-1");
  let startedAt: number;
  let endedAt: number;
  try {
    await hook({ ...tool, hook_event_name: "PreToolUse" }, oldEnvironment);
    startedAt = (await readCapturedTools(transcript, "turn"))[0]!.startedAt;
    await hook({ ...tool, hook_event_name: "PreToolUse" }, oldEnvironment);
    await expect(readCapturedTools(transcript, "turn")).resolves.toMatchObject([
      { startedAt, input: { cmd: "SENSITIVE-REDACTED" } },
    ]);
    await hook(completion, oldEnvironment);
    endedAt = (await readCapturedTools(transcript, "turn"))[0]!.endedAt!;
    await hook(completion, oldEnvironment);
    await expect(readCapturedTools(transcript, "turn")).resolves.toMatchObject([
      {
        startedAt,
        endedAt,
        input: { cmd: "SENSITIVE-REDACTED" },
        output: { stdout: "SENSITIVE-REDACTED" },
      },
    ]);
    const startScope = {
      integration: "openai-codex",
      sessionId: "thread",
      turnId: "turn",
      eventId: `${toolRunId}${TOOL_START_EVENT_SUFFIX}`,
    };
    const completionScope = {
      integration: "openai-codex",
      sessionId: "thread",
      turnId: "turn",
      eventId: `${toolRunId}${TOOL_COMPLETE_EVENT_SUFFIX}`,
    };
    const reconstructionStore = createCaptureStore(join(context!.storageRoot, "reconstruction-v1"));
    await expect(context!.captureStore.read(startScope)).resolves.toMatchObject({
      normalizedPayload: {
        redactedFields: ["inputs"],
        run: { inputs: { input: { cmd: "SENSITIVE-REDACTED" } } },
      },
    });
    await expect(reconstructionStore.read(completionScope)).resolves.toMatchObject({
      normalizedPayload: {
        sourceSnapshots: [
          {
            submission: {
              redactedFields: ["outputs"],
              patch: { values: { outputs: { output: { stdout: "SENSITIVE-REDACTED" } } } },
            },
          },
        ],
      },
    });
    expect(await fs.stat(transcript).catch(() => undefined)).toBeUndefined();
    expect(requests).toEqual([]);
    expect(
      JSON.parse(await fs.readFile(join(workerDirectory, "wake.pending"), "utf8")),
    ).toMatchObject({
      version: 1,
    });
  } finally {
    await lock.release();
  }
  await hook(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "wrong-account-thread",
      turn_id: "new-turn",
      cwd,
      prompt: "work",
    },
    {
      TRACE_TO_LANGSMITH: "true",
      LANGSMITH_API_KEY: "wrong-account-key",
      LANGSMITH_ENDPOINT: `${api}/wrong-account`,
      LANGSMITH_PROJECT: "wrong-account-project",
    },
  );
  expect(requests).toEqual([]);
  await hook(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "new-thread",
      turn_id: "new-turn",
      cwd,
      prompt: "work",
    },
    { TRACE_TO_LANGSMITH: "true" },
  );
  await vi.waitFor(
    () => {
      expect(requests.some(({ method }) => method === "POST")).toBe(true);
      expect(requests.some(({ method }) => method === "PATCH")).toBe(true);
      return expect(
        directoryContainsFiles(join(home, ".codex/langsmith_engine_v1/background-worker")),
      ).resolves.toBe(false);
    },
    { timeout: 5000, interval: 25 },
  );
  expect(requests.map(({ method }) => method).filter((method) => method !== "GET")).toEqual([
    "POST",
    "PATCH",
  ]);
  expect(
    requests.every(({ key, path }) => key === "primary-key" && path.startsWith("/primary/")),
  ).toBe(true);
  const postedRuns = requests
    .filter(({ method }) => method === "POST")
    .flatMap(({ body }) => body.post ?? [body]);
  expect(postedRuns).toHaveLength(1);
  expect(postedRuns[0]).toMatchObject({
    id: toolRunId,
    parent_run_id: stableRunId("thread", transcript, "turn", "root"),
    session_name: "primary-project",
    inputs: { input: { cmd: "SENSITIVE-REDACTED" } },
  });
  const wire = JSON.stringify(requests.filter(({ method }) => method !== "GET"));
  expect(wire.split("SENSITIVE-REDACTED").length - 1).toBe(2);
  expect(wire).not.toContain("SENSITIVE-REDACTED-REDACTED");
  const startScope = {
    integration: "openai-codex",
    sessionId: "thread",
    turnId: "turn",
    eventId: `${toolRunId}${TOOL_START_EVENT_SUFFIX}`,
  };
  const completionScope = {
    integration: "openai-codex",
    sessionId: "thread",
    turnId: "turn",
    eventId: `${toolRunId}${TOOL_COMPLETE_EVENT_SUFFIX}`,
  };
  const reconstructionStore = createCaptureStore(join(context!.storageRoot, "reconstruction-v1"));
  await expect(
    context!.captureStore.readOutcome(startScope, context!.destinations[0]!.id),
  ).resolves.toMatchObject({ status: "settled", receipt: { outcome: "delivered" } });
  await expect(
    reconstructionStore.readOutcome(completionScope, context!.accountFingerprint),
  ).resolves.toMatchObject({ status: "settled", receipt: { outcome: "delivered" } });
  const writeCount = requests.length;
  await hook(
    {
      hook_event_name: "UserPromptSubmit",
      session_id: "new-thread",
      turn_id: "next-turn",
      cwd,
      prompt: "work",
    },
    { TRACE_TO_LANGSMITH: "true" },
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  expect(requests).toHaveLength(writeCount);
});

it("refuses direct Stop uploads when shared writer configuration is unavailable", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({
      enabled: true,
      defaultMuted: false,
      api_url: `${api}/fallback`,
      project: "fallback-project",
      replicas: [],
      redact: false,
    }),
  );
  const timestamp = new Date().toISOString();
  const event = (type: string, payload: Record<string, unknown>) => ({ timestamp, type, payload });
  const transcript = join(cwd, "rollout.jsonl");
  await fs.writeFile(
    transcript,
    [
      event("session_meta", { id: "thread", source: "cli", model_provider: "test" }),
      event("event_msg", { type: "task_started", turn_id: "turn" }),
      event("turn_context", { turn_id: "turn", model: "test-model" }),
      event("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "synthetic user prompt" }],
      }),
      event("response_item", {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "synthetic response" }],
      }),
      event("event_msg", { type: "turn_complete", turn_id: "turn" }),
    ]
      .map((line) => JSON.stringify(line))
      .join("\n"),
  );
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" });
  const result = await runHookProcess(
    { hook_event_name: "Stop", transcript_path: transcript },
    { LANGCHAIN_API_KEY: "synthetic-fallback-key", LANGCHAIN_ENDPOINT: api },
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  expect(result).toMatchObject({ code: 0, stdout: "" });
  expect(result.stderr).toContain("Shared Codex tracing is unavailable; refusing direct upload");
  expect(requests).toEqual([]);
});

it("deduplicates an unchanged Stop and saves transcript changes as dependent patches", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({
      enabled: true,
      defaultMuted: false,
      redact: false,
      api_url: `${api}/primary`,
      api_key: "primary-key",
      project: "primary-project",
      replicas: [],
    }),
  );
  await upload({ TRACE_TO_LANGSMITH: "true" });
  const transcript = join(cwd, "rollout.jsonl");
  const writes = () => requests.filter(({ method }) => method === "POST" || method === "PATCH");
  const initialCount = writes().length;
  await hook({ hook_event_name: "Stop", transcript_path: transcript });
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  expect(writes()).toHaveLength(initialCount);

  const original = await fs.readFile(transcript, "utf8");
  expect(original).toContain("PRIVATE_BODY ACME-456");
  await fs.writeFile(transcript, original.replace("PRIVATE_BODY ACME-456", "updated response"));
  const beforeRevision = writes().length;
  await hook({ hook_event_name: "Stop", transcript_path: transcript });
  await vi.waitFor(
    () =>
      expect(
        directoryContainsFiles(join(home, ".codex/langsmith_engine_v1/background-worker")),
      ).resolves.toBe(false),
    { timeout: 5000, interval: 25 },
  );
  const revisionWrites = writes().slice(beforeRevision);
  expect(revisionWrites.filter(({ method }) => method === "POST")).toHaveLength(0);
  expect(revisionWrites.filter(({ method }) => method === "PATCH").length).toBeGreaterThan(0);
  expect(JSON.stringify(revisionWrites)).toContain("updated response");

  const beforeRevert = writes().length;
  await fs.writeFile(transcript, original);
  await hook({ hook_event_name: "Stop", transcript_path: transcript });
  await vi.waitFor(
    () =>
      expect(
        directoryContainsFiles(join(home, ".codex/langsmith_engine_v1/background-worker")),
      ).resolves.toBe(false),
    { timeout: 5000, interval: 25 },
  );
  const revertWrites = writes().slice(beforeRevert);
  expect(revertWrites.filter(({ method }) => method === "POST")).toHaveLength(0);
  expect(JSON.stringify(revertWrites)).toContain("PRIVATE_BODY ACME-456");

  const config = await getConfig({ home, cwd, env: childEnvironment() });
  const context = createCodexTracingSession(config, "thread", cwd, home);
  expect(context).toBeDefined();
  const captures = await context!.captureStore.enumerate("openai-codex", "thread");
  const snapshots = captures
    .map(({ record }) => record)
    .filter((record) => record.eventKind === "run-post" || record.eventKind === "run-patch");
  const patches = snapshots.filter((record) => record.eventKind === "run-patch");
  expect(patches.length).toBeGreaterThan(0);
  for (const record of patches) {
    const previous = snapshots
      .filter((candidate) => candidate.runId === record.runId && candidate.eventId < record.eventId)
      .toSorted((left, right) => right.eventId.localeCompare(left.eventId))[0];
    expect(previous).toBeDefined();
    expect(record.dependencies).toContainEqual({
      integration: "openai-codex",
      sessionId: "thread",
      turnId: "turn",
      eventId: previous!.eventId,
    });
    await expect(
      context!.captureStore.readOutcome(
        {
          integration: "openai-codex",
          sessionId: "thread",
          turnId: record.turnId,
          eventId: record.eventId,
        },
        context!.destinations[0]!.id,
      ),
    ).resolves.toMatchObject({ status: "settled", receipt: { outcome: "delivered" } });
  }
});

it.each([
  { muted: false, redact: true },
  { muted: false, redact: false },
  { muted: true, redact: false },
])(
  "root replicas route destination/auth/project and preserve privacy: %j",
  async ({ muted, redact }) => {
    await fs.writeFile(
      join(home, ".codex/langsmith.json"),
      JSON.stringify({
        metadata: { user: "kept", overlap: "user", nested: { user: true } },
        replicas: [{ api_url: `${api}/wrong`, project: "wrong" }],
      }),
    );
    await fs.writeFile(
      join(cwd, "langsmith-plugins.json"),
      JSON.stringify({
        enabled: true,
        defaultMuted: muted,
        redact,
        api_url: `${api}/primary`,
        api_key: "primary-key",
        project: "primary-project",
        replicas: [{ api_url: `${api}/replica`, api_key: "replica-key", project: "root-project" }],
        metadata: {
          root: "kept",
          overlap: "root",
          nested: { root: true },
          secret: "ACME-789",
          ls_tool_name: "PRIVATE_COLLISION",
        },
        redact_extra_rules: [{ pattern: "ACME-[0-9]+", replace: "[custom-redacted]" }],
        parent_headers: { "langsmith-trace": 123 }, // Invalid extension must not disable common.
      }),
    );
    await fs.writeFile(
      join(cwd, ".codex/langsmith.json"),
      JSON.stringify({
        metadata: { harness: "kept", overlap: "harness" },
      }),
    );
    const runs = await upload({
      LANGSMITH_CODEX_METADATA: JSON.stringify({ env: "kept", overlap: "env" }),
    });
    for (const request of requests) {
      expect(request.path).toMatch(/^\/replica\/runs/);
      expect(request.key).toBe("replica-key");
    }
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const run of runs) {
      expect(run.session_name).toBe("root-project");
      if (muted) {
        expect(run.extra.metadata).toMatchObject({
          ls_tracing_mode: "metadata",
          thread_id: "thread",
        });
        for (const key of [
          "user",
          "root",
          "harness",
          "env",
          "overlap",
          "nested",
          "secret",
          "ls_tool_name",
        ])
          expect(run.extra.metadata).not.toHaveProperty(key);
        expect(JSON.stringify(run)).not.toContain("PRIVATE_");
        expect(JSON.stringify(run)).not.toContain("ACME-");
      } else {
        expect(run.extra.metadata).toMatchObject({
          user: "kept",
          root: "kept",
          harness: "kept",
          env: "kept",
          overlap: "env",
          nested: { root: true },
          secret: redact ? "[custom-redacted]" : "ACME-789",
          ls_tool_name: "PRIVATE_COLLISION",
        });
        expect(JSON.stringify(run)).toContain("PRIVATE_BODY");
        if (redact) expect(JSON.stringify(run)).not.toContain("ACME-");
        else expect(JSON.stringify(run)).toContain("ACME-");
      }
    }
  },
);

it.each([{ replicas: [] }, { replicas: [{}] }])(
  "file replicas %j replace lower arrays and retain inherited client defaults",
  async ({ replicas }) => {
    await fs.writeFile(
      join(home, ".codex/langsmith.json"),
      JSON.stringify({
        replicas: [{ api_url: `${api}/wrong`, project: "wrong" }],
      }),
    );
    await fs.writeFile(
      join(cwd, "langsmith-plugins.json"),
      JSON.stringify({
        enabled: true,
        api_url: `${api}/primary`,
        api_key: "primary-key",
        project: "primary-project",
        replicas,
      }),
    );
    // SDK-only discovery must not defeat an explicit file [] (or [{}]).
    const runs = await upload({
      LANGCHAIN_RUNS_ENDPOINTS: JSON.stringify({ [`${api}/wrong`]: "wrong-key" }),
    });
    for (const request of requests) {
      expect(request.path).toMatch(/^\/primary\/runs/);
      expect(request.key).toBe("primary-key");
    }
    for (const run of runs) expect(run.session_name).toBe("primary-project");
  },
);

it.each([false, true])(
  "home-root-only config reaches actual hooks and SDK, muted=%s",
  async (defaultMuted) => {
    // The obsolete home file must neither disable tracing nor supply metadata.
    await fs.writeFile(
      join(home, "langsmith-plugins.json"),
      JSON.stringify({ enabled: false, defaultMuted: !defaultMuted, metadata: { old: true } }),
    );
    await fs.writeFile(
      join(home, ".langsmith-plugins.json"),
      JSON.stringify({
        enabled: true,
        defaultMuted,
        api_url: `${api}/home`,
        api_key: "home-key",
        project: "home-project",
        replicas: [],
        redact: false,
        metadata: { home: "kept" },
      }),
    );
    const runs = await upload();
    for (const request of requests) {
      expect(request.path).toMatch(/^\/home\/runs/);
      expect(request.key).toBe("home-key");
    }
    for (const run of runs) {
      expect(run.session_name).toBe("home-project");
      expect(run.extra.metadata).not.toHaveProperty("old");
      if (defaultMuted) {
        expect(run.extra.metadata.ls_tracing_mode).toBe("metadata");
        expect(run.extra.metadata).not.toHaveProperty("home");
        expect(JSON.stringify(run)).not.toContain("PRIVATE_BODY");
      } else expect(run.extra.metadata.home).toBe("kept");
    }
  },
);

it.each([false, true])(
  "environment mute %s beats opposite project file in actual hooks",
  async (muted) => {
    await fs.writeFile(
      join(home, ".langsmith-plugins.json"),
      JSON.stringify({
        api_url: `${api}/home`,
        api_key: "home-key",
        project: "home-project",
        replicas: [],
        metadata: { home: true },
        redact: false,
      }),
    );
    await fs.writeFile(
      join(cwd, ".codex/langsmith.json"),
      JSON.stringify({ enabled: false, defaultMuted: !muted }),
    );
    const runs = await upload({
      TRACE_TO_LANGSMITH: " YeS ",
      LANGSMITH_CODEX_DEFAULT_MUTED: String(muted),
      LANGSMITH_CODEX_ENDPOINT: `${api}/env`,
      LANGSMITH_CODEX_API_KEY: "env-key",
      LANGSMITH_CODEX_PROJECT: "env-project",
      LANGSMITH_CODEX_METADATA: '{"env":true}',
    });
    for (const request of requests) {
      expect(request.path).toMatch(/^\/env\/runs/);
      expect(request.key).toBe("env-key");
    }
    for (const run of runs) {
      expect(run.session_name).toBe("env-project");
      if (muted) {
        expect(run.extra.metadata.ls_tracing_mode).toBe("metadata");
        expect(JSON.stringify(run)).not.toContain("PRIVATE_BODY");
      } else expect(run.extra.metadata).toMatchObject({ home: true, env: true });
    }
  },
);

it("master env false suppresses actual hooks despite enabled file", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({ enabled: true, api_url: api, api_key: "local-key", replicas: [] }),
  );
  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work" },
    { TRACE_TO_LANGSMITH: "false" },
  );
  await hook(
    { hook_event_name: "Stop", transcript_path: join(cwd, "not-needed.jsonl") },
    { TRACE_TO_LANGSMITH: "false" },
  );
  expect(requests).toEqual([]);
  const policy = JSON.parse(
    await fs.readFile(join(home, ".codex/langsmith-state.privacy.json"), "utf8"),
  );
  expect(policy.threads.thread.turns.turn).toBe("off");
});

it("malformed project config cannot hide independent env switches or home credentials in actual hooks", async () => {
  await fs.writeFile(
    join(home, ".langsmith-plugins.json"),
    JSON.stringify({
      api_url: `${api}/home`,
      api_key: "home-key",
      project: "home-project",
      replicas: [],
      metadata: { home: true },
    }),
  );
  await fs.writeFile(join(cwd, ".codex/langsmith.json"), "{");
  const runs = await upload({ TRACE_TO_LANGSMITH: "true", LANGSMITH_CODEX_DEFAULT_MUTED: "false" });
  for (const request of requests) {
    expect(request.path).toMatch(/^\/home\/runs/);
    expect(request.key).toBe("home-key");
  }
  expect(JSON.stringify(runs)).toContain("PRIVATE_BODY");
  for (const run of runs) expect(run.extra.metadata.home).toBe(true);
});

it("obsolete nonhidden home config cannot enable actual hooks or SDK uploads", async () => {
  await fs.writeFile(
    join(home, "langsmith-plugins.json"),
    JSON.stringify({ enabled: true, api_url: api, api_key: "old-key", replicas: [] }),
  );
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" });
  await hook({ hook_event_name: "Stop", transcript_path: join(cwd, "not-needed.jsonl") });
  expect(requests).toEqual([]);
  const policy = JSON.parse(
    await fs.readFile(join(home, ".codex/langsmith-state.privacy.json"), "utf8"),
  );
  expect(policy.threads.thread.turns.turn).toBe("off");
});
