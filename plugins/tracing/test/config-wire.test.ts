import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

// Exercise the installed bundle, real file discovery, and real SDK. Only the
// destination is local; no Client/RunTree/config or fetch mocks are involved.
let dir: string;
let home: string;
let cwd: string;
let server: Server;
let api: string;
type Payload = Record<string, any>;
let requests: { path: string; key?: string; body: Payload }[];

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

async function hook(event: Record<string, unknown>, env: Record<string, string> = {}) {
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key),
    ),
  );
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../dist/index.mjs", import.meta.url))],
    {
      cwd: dir, // Discovery must use the payload cwd, not the process/plugin cwd.
      env: { ...cleanEnv, HOME: home, ...env },
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
  expect({ code, stdout, stderr }).toEqual({ code: 0, stdout: "", stderr: "" });
}

async function upload(env: Record<string, string> = {}) {
  const event = (type: string, payload: Record<string, unknown>) => ({
    timestamp: "2026-04-23T00:00:01.000Z",
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
  expect(requests.length).toBeGreaterThan(0);
  return requests.flatMap(({ body }) => body.post ?? [body]);
}

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
