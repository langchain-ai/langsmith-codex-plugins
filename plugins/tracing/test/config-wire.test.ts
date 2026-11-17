import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rolloutText } from "./utils/rollout.js";
import { settleTracer, stopTracer } from "./utils/live-wire.js";

// Exercise the installed bundle, real file discovery, and real SDK. Only the
// destination is local; no Client/RunTree/config or fetch mocks are involved.
let dir: string;
let home: string;
let cwd: string;
let server: Server;
let api: string;
type Payload = Record<string, any>;
let requests: { path: string; key?: string; auth?: string; body: Payload }[];
let failStatus: number;

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), "codex-config-wire-"));
  home = join(dir, "home");
  cwd = join(dir, "project");
  await fs.mkdir(join(home, ".codex"), { recursive: true });
  await fs.mkdir(join(cwd, ".codex"), { recursive: true });
  requests = [];
  failStatus = 0;
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
      auth: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });
    if (failStatus) res.statusCode = failStatus;
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  api = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await stopTracer(home);
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

async function hook(
  event: Record<string, unknown>,
  env: Record<string, string> = {},
  args: string[] = [],
  expectedStderr: unknown = "",
  expectedStdout: unknown = "",
) {
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key),
    ),
  );
  const binary = process.env.CODEX_TEST_BINARY;
  const child = spawn(
    binary ?? process.execPath,
    binary ? args : [fileURLToPath(new URL("../dist/index.mjs", import.meta.url)), ...args],
    {
      cwd: dir, // Discovery must use the payload cwd, not the process/plugin cwd.
      env: {
        ...cleanEnv,
        HOME: home,
        ...env,
      },
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
  child.stdin.end(
    args.length
      ? undefined
      : JSON.stringify({ session_id: "thread", turn_id: "turn", cwd, ...event }),
  );
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  expect({ code, stdout }).toEqual({ code: 0, stdout: expectedStdout });
  if (typeof expectedStderr !== "string") expect(stderr).toEqual(expectedStderr);
  else if (expectedStderr) expect(stderr).toContain(expectedStderr);
  else expect(stderr).toBe("");
}

async function writeRollout(
  id = "thread",
  file = "rollout.jsonl",
  turns = ["turn"],
  directory = cwd,
): Promise<string> {
  const transcript_path = join(directory, file);
  await fs.writeFile(transcript_path, `${rolloutText(id, turns)}\n`);
  return transcript_path;
}

async function upload(env: Record<string, string> = {}) {
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
  await hook({ hook_event_name: "Stop", transcript_path }, env);
  await settleTracer(home, () => requests.length);
  expect(requests.length).toBeGreaterThan(0);
  return requests.flatMap(({ body, path }) => body.post ?? (path.endsWith("/runs") ? [body] : []));
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
  expect(await fs.readdir(join(home, ".codex"))).not.toContain("langsmith_plugins_base");
  const policy = JSON.parse(
    await fs.readFile(join(home, ".codex/langsmith_state_privacy.json"), "utf8"),
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
    await fs.readFile(join(home, ".codex/langsmith_state_privacy.json"), "utf8"),
  );
  expect(policy.threads.thread.turns.turn).toBe("off");
});

const reachable = () => ({
  TRACE_TO_LANGSMITH: "true",
  LANGSMITH_API_KEY: "wire-key",
  LANGSMITH_ENDPOINT: api,
});

it("attaches the turn to the parent trace named by the parent headers", async () => {
  const parent = "019dbc02-0000-7000-8000-000000000001";
  const runs = await upload({
    ...reachable(),
    LANGSMITH_CODEX_PARENT_HEADERS: JSON.stringify({
      "langsmith-trace": `20250101T000000000000Z${parent}`,
      baggage: "langsmith-project=wire-parent-project",
    }),
  });
  const root = runs.find((run) => run.name === "openai.codex");
  expect(root).toMatchObject({ parent_run_id: parent, trace_id: parent });
  expect(root?.session_name).toBe("wire-parent-project");
});

it("keeps a turn queued as metadata-only muted even if the preference changes before the worker runs", async () => {
  const transcript_path = await writeRollout();
  const env = { ...reachable(), LANGSMITH_CODEX_DEFAULT_MUTED: "true" };
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
  const policyPath = join(home, ".codex/langsmith_state_privacy.json");
  await hook({ hook_event_name: "Stop", transcript_path }, env);
  const policy = JSON.parse(await fs.readFile(policyPath, "utf8"));
  policy.threads.thread.turns.turn = "full";
  await fs.writeFile(policyPath, JSON.stringify(policy));
  await settleTracer(home, () => requests.length);

  const runs = requests.flatMap(
    ({ body, path }) => body.post ?? (path.endsWith("/runs") ? [body] : []),
  );
  expect(runs.length).toBeGreaterThan(0);
  expect(JSON.stringify(runs)).not.toContain("PRIVATE_BODY");
});

it("does not upload a turn again on a later Stop once it was delivered", async () => {
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await settleTracer(home, () => requests.length);
  const delivered = requests.length;
  expect(delivered).toBeGreaterThan(0);

  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await settleTracer(home, () => requests.length);

  expect(requests).toHaveLength(delivered);
});

it("tells the next hook once that the API key was rejected", async () => {
  failStatus = 401;
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await settleTracer(home, () => requests.length);

  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "next" },
    reachable(),
    [],
    "",
    expect.stringContaining("LangSmith API key was rejected"),
  );
  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "later" },
    reachable(),
  );
}, 60_000);

it.skipIf(process.env.CODEX_TEST_BINARY)(
  "uploads with the CLI login and says once per cooldown that the login expired",
  async () => {
    failStatus = 401;
    const log = join(dir, "spawned.log");
    const preload = join(dir, "stub-spawn.mjs");
    await fs.writeFile(
      preload,
      `import childProcess from "node:child_process";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const spawn = childProcess.spawn;
const record = (entry) => appendFileSync(${JSON.stringify(log)}, JSON.stringify(entry) + "\\n");
childProcess.spawn = (command, args, options) => {
  if (!/(^|[\\\\/])(osascript|notify-send|powershell\\.exe|langsmith)$/.test(command)) return spawn(command, args, options);
  record([command, ...args]);
  return spawn(process.execPath, ["-e", ""], options);
};
syncBuiltinESMExports();
const warn = console.warn;
console.warn = (...parts) => { record(["warn", ...parts]); warn(...parts); };
`,
    );
    const bin = join(dir, "bin");
    await fs.mkdir(bin);
    await fs.writeFile(join(bin, "langsmith"), "#!/bin/sh\n", { mode: 0o755 });
    await fs.mkdir(join(home, ".langsmith"));
    const login = (access_token: string) =>
      fs.writeFile(
        join(home, ".langsmith", "config.json"),
        JSON.stringify({
          current_profile: "work",
          profiles: { work: { api_url: api, oauth: { access_token } } },
        }),
      );
    const renewals = async (count: number) => {
      let entries: string[][] = [];
      await vi.waitFor(
        async () => {
          entries = (await fs.readFile(log, "utf8").catch(() => ""))
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line));
          expect(
            entries.filter(([kind, line]) => kind === "warn" && line?.includes("login expired")),
          ).toHaveLength(count);
        },
        { timeout: 20_000, interval: 100 },
      );
      return entries;
    };
    const env = {
      TRACE_TO_LANGSMITH: "true",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${pathToFileURL(preload).href}`,
      PATH: `${bin}:/usr/bin:/bin`,
      DISPLAY: ":0",
    };
    const prompt = (turn_id: string, session_id = "thread") => ({
      hook_event_name: "UserPromptSubmit",
      prompt: "work",
      turn_id,
      session_id,
    });
    const notice = expect.stringContaining(
      "Your LangSmith login expired so this session isn't being traced.",
    );
    await login("synthetic-expired");
    await hook(prompt("turn"), env);
    await hook({ hook_event_name: "Stop", transcript_path: await writeRollout() }, env);
    await renewals(1);
    await settleTracer(home, () => requests.length);

    expect(requests[0]).toMatchObject({ auth: "Bearer synthetic-expired", key: undefined });
    await hook(prompt("key", "key-thread"), { ...env, LANGSMITH_CODEX_API_KEY: "wire-key" });
    await hook(prompt("next"), env, [], "", notice);
    await hook(prompt("other", "other-thread"), env);
    const spawned = await renewals(1);

    expect(spawned.filter(([kind]) => kind !== "warn")).toEqual([]);
  },
  60_000,
);

it("says once per cooldown why an existing CLI login can't be used while tracing is on", async () => {
  const prompt = (turn_id: string) => ({
    hook_event_name: "UserPromptSubmit",
    prompt: "work",
    turn_id,
  });
  const elsewhere = { TRACE_TO_LANGSMITH: "true", LANGSMITH_ENDPOINT: "https://other.example" };
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  await hook(prompt("off"), { ...elsewhere, TRACE_TO_LANGSMITH: "false" });
  await hook(prompt("one"), elsewhere, [], "", expect.stringContaining("login is for"));
  await hook(prompt("two"), elsewhere);
});

it("says once per cooldown that LangSmith isn't signed in after the CLI login is removed", async () => {
  const login = join(home, ".langsmith", "config.json");
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    login,
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  const env = { TRACE_TO_LANGSMITH: "true" };
  const prompt = (turn_id: string) => ({
    hook_event_name: "UserPromptSubmit",
    prompt: "work",
    turn_id,
  });
  await hook(prompt("signed-in"), env);
  await fs.rm(login);
  await hook(prompt("signed-out"), env, [], "", expect.stringContaining("langsmith auth login"));
  await hook(prompt("again"), env);
});

it("uploads nothing and says once per cooldown when every replica is refused for the login", async () => {
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({ replicas: [{ api_url: "https://other.example", project: "copy" }] }),
  );
  const env = { TRACE_TO_LANGSMITH: "true" };
  const prompt = (turn_id: string) => ({
    hook_event_name: "UserPromptSubmit",
    prompt: "work",
    turn_id,
  });
  const skipped = expect.stringContaining(
    "LangSmith replicas on https://other.example need their own API key",
  );
  await hook(prompt("one"), env, [], "", skipped);
  await hook({ hook_event_name: "Stop", transcript_path: await writeRollout() }, env);
  const transcript_path = await writeRollout("thread", "rollout.jsonl", ["turn", "two"]);
  await hook(prompt("two"), env);
  await hook({ hook_event_name: "Stop", transcript_path, turn_id: "two" }, env);
  expect(requests).toEqual([]);
});

it("uploads with the CLI login even when a generic LangSmith key is exported", async () => {
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  await upload({
    TRACE_TO_LANGSMITH: "true",
    LANGSMITH_API_KEY: "generic-key",
    LANGCHAIN_API_KEY: "generic-key",
  });

  expect(requests.every(({ key, auth }) => key === undefined && auth === "Bearer t")).toBe(true);
});

it.each(
  ['""', "   ", '" "'].flatMap((blank) => [
    { blank, settings: { api_key: blank, api_url: "API" } },
    { blank, settings: { replicas: [{ api_url: "API", api_key: blank, project: "copy" }] } },
  ]),
)(
  "never sends the CLI login to a repository's server for blank key $blank in $settings",
  async ({ settings }) => {
    await fs.mkdir(join(home, ".langsmith"));
    await fs.writeFile(
      join(home, ".langsmith", "config.json"),
      JSON.stringify({
        profiles: { default: { api_url: "https://login.example", oauth: { access_token: "t" } } },
      }),
    );
    await fs.writeFile(
      join(cwd, "langsmith-plugins.json"),
      JSON.stringify(settings).replaceAll('"API"', JSON.stringify(api)),
    );
    const env = { TRACE_TO_LANGSMITH: "true", LANGSMITH_CODEX_NOTICE_COOLDOWN: "off" };
    const transcript_path = await writeRollout();
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
    await hook({ hook_event_name: "Stop", transcript_path }, env, [], expect.anything());
    await settleTracer(home, () => requests.length);

    expect(requests.filter(({ auth }) => auth !== undefined)).toEqual([]);
  },
);

it("opens no upload when the only replica key is a quoted blank and there is no login", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({ replicas: [{ api_url: api, api_key: '""', project: "copy" }] }),
  );
  const env = { TRACE_TO_LANGSMITH: "true", LANGSMITH_CODEX_NOTICE_COOLDOWN: "off" };
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
  await hook({ hook_event_name: "Stop", transcript_path: await writeRollout() }, env);

  expect(requests).toEqual([]);
});

it.each([
  { key: '""', sent: undefined },
  { key: "' '", sent: undefined },
  { key: "''''", sent: "''" },
  { key: `'""'`, sent: '""' },
])(
  "sends key $key as the SDK reads it and never falls back to the CLI login",
  async ({ key, sent }) => {
    await fs.mkdir(join(home, ".langsmith"));
    await fs.writeFile(
      join(home, ".langsmith", "config.json"),
      JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
    );
    await fs.writeFile(
      join(cwd, "langsmith-plugins.json"),
      JSON.stringify({ api_key: key, api_url: api }),
    );
    const env = { TRACE_TO_LANGSMITH: "true", LANGSMITH_CODEX_NOTICE_COOLDOWN: "off" };
    const transcript_path = await writeRollout();
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
    await hook({ hook_event_name: "Stop", transcript_path }, env, [], expect.anything());
    await settleTracer(home, () => requests.length);

    expect(requests.filter(({ auth }) => auth !== undefined)).toEqual([]);
    expect(new Set(requests.map(({ key: header }) => header))).toEqual(
      new Set(sent === undefined ? [] : [sent]),
    );
  },
);

it("stays quiet about signing in when a replica with its own key can still upload", async () => {
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({ replicas: [{ api_url: api, api_key: "replica-key", project: "copy" }] }),
  );
  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work" },
    { TRACE_TO_LANGSMITH: "true" },
  );
});

it("drops the rejected-key notice once the CLI login replaces the key", async () => {
  failStatus = 401;
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await settleTracer(home, () => requests.length);
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );

  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "next" },
    { TRACE_TO_LANGSMITH: "true", LANGSMITH_ENDPOINT: api },
  );
}, 60_000);
