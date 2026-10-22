import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { v5 as uuidV5 } from "uuid";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withFileLock } from "@langchain/plugins-base/storage";
import { rolloutText } from "./utils/rollout.js";

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
const LAUNCH_NOTE_SUFFIX = "wake.launching";
const CLAIMS_SUFFIX = ".claims";
const UPLOADER_LOCK_DIRECTORY = /^worker-[0-9a-f]{64}\.claims$/u;

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
  for (const pid of await workerPids(join(home, ".codex", "langsmith_engine"))) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
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
  if (args[0] === "--engine-worker") await (failStatus ? uploadersStarted() : uploadersFinished());
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
  await fs.writeFile(transcript_path, rolloutText(id, turns));
  return transcript_path;
}

async function upload(env: Record<string, string> = {}) {
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env);
  await hook({ hook_event_name: "Stop", transcript_path }, env);
  await hook({}, env, ["--engine-worker", "thread", cwd]);
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

async function savedEvents(): Promise<Payload[]> {
  const found: Payload[] = [];
  const walk = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/[\\/](?:turns|jobs)[\\/]/u.test(path) && /^[0-9a-f]{64}\.json$/u.test(entry.name)) {
        found.push(JSON.parse(await fs.readFile(path, "utf8")));
      }
    }
  };
  await walk(join(home, ".codex", "langsmith_engine"));
  return found;
}

async function savedRunEvents(): Promise<Payload[]> {
  return (await savedEvents()).filter(({ eventId }) => String(eventId).startsWith("codex-run:"));
}

async function uploaderLockPath(
  directory = join(home, ".codex", "langsmith_engine"),
): Promise<string> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (UPLOADER_LOCK_DIRECTORY.test(entry.name)) return path.slice(0, -CLAIMS_SUFFIX.length);
    const found = await uploaderLockPath(path).catch(() => undefined);
    if (found) return found;
  }
  throw new Error("No uploader lock found");
}

async function stopLaunchedUploaders(): Promise<void> {
  for (const pid of await launchedPids(join(home, ".codex", "langsmith_engine"))) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  await uploadersFinished();
}

it("keeps the traced runs under the Codex state folder when the upload fails", async () => {
  failStatus = 500;
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  const ids = (index: number) =>
    uuidV5(`langsmith-codex:thread:turn:${index}`, "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  const expected = [`codex-run:${ids(0)}`, `codex-run:${ids(1)}`];
  const savedIds = async () => (await savedRunEvents()).map(({ eventId }) => eventId);
  await vi.waitFor(async () => expect(await savedIds()).toEqual(expect.arrayContaining(expected)), {
    timeout: 30_000,
  });
  await stopLaunchedUploaders();
  await withFileLock(await uploaderLockPath(), () =>
    hook({}, reachable(), ["--engine-worker", "thread", cwd], "left saved work for a later run"),
  );

  const runEvents = await savedRunEvents();
  expect(runEvents.map(({ eventId }) => eventId)).toEqual(expect.arrayContaining(expected));
  for (const { turnEvidence } of runEvents) {
    expect(turnEvidence.rootRunId).toBe(ids(0));
    expect(turnEvidence.childRunIds).not.toContain(ids(0));
    expect(turnEvidence.childRunIds).toContain(ids(1));
  }
}, 60_000);

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
  await hook({}, env, ["--engine-worker", "thread", cwd]);

  const runs = requests.flatMap(
    ({ body, path }) => body.post ?? (path.endsWith("/runs") ? [body] : []),
  );
  expect(runs.length).toBeGreaterThan(0);
  expect(JSON.stringify(runs)).not.toContain("PRIVATE_BODY");
});

async function uploadersFinished(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while ((await launchedPids(join(home, ".codex", "langsmith_engine"))).some(isAlive)) {
    if (Date.now() > deadline) throw new Error("A launched uploader never exited");
    await sleep(50);
  }
}

async function uploadersStarted(): Promise<void> {
  const storage = join(home, ".codex", "langsmith_engine");
  const deadline = Date.now() + 60_000;
  for (;;) {
    const claimed = new Set(await workerPids(storage));
    const launched = await launchedPids(storage, LAUNCH_NOTE_SUFFIX);
    if (launched.every((pid) => claimed.has(pid) || !isAlive(pid))) return;
    if (Date.now() > deadline) throw new Error("A launched uploader never claimed its lock");
    await sleep(20);
  }
}

async function launchedPids(directory: string, suffix = ""): Promise<number[]> {
  const pids: number[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      pids.push(...(await launchedPids(path, suffix)));
      continue;
    }
    if (!entry.name.endsWith(suffix)) continue;
    try {
      const { pid } = JSON.parse(await fs.readFile(path, "utf8"));
      if (typeof pid === "number" && pid !== process.pid) pids.push(pid);
    } catch {}
  }
  return pids;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function workerPids(directory: string): Promise<number[]> {
  const pids: number[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (!entry.isDirectory()) continue;
    if (!/^worker-[0-9a-f]{64}\.claims$/u.test(entry.name)) {
      pids.push(...(await workerPids(path)));
      continue;
    }
    for (const claim of await fs.readdir(path)) {
      const { pid } = JSON.parse(await fs.readFile(join(path, claim), "utf8").catch(() => "{}"));
      if (typeof pid === "number") pids.push(pid);
    }
  }
  return pids;
}

async function claimedWorkerPid(directory: string): Promise<number | undefined> {
  for (const deadline = Date.now() + 10_000; Date.now() < deadline; await sleep(2)) {
    const pid = await runningWorkerPid(directory).catch(() => undefined);
    if (pid !== undefined) return pid;
  }
  return undefined;
}

async function runningWorkerPid(directory: string): Promise<number | undefined> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (!entry.isDirectory()) continue;
    if (!/^worker-[0-9a-f]{64}\.claims$/u.test(entry.name)) {
      const found = await runningWorkerPid(path);
      if (found) return found;
      continue;
    }
    for (const claim of await fs.readdir(path)) {
      const { pid } = JSON.parse(await fs.readFile(join(path, claim), "utf8"));
      if (typeof pid === "number") return pid;
    }
  }
  return undefined;
}

it("does not upload a turn again on a later Stop once it was delivered", async () => {
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await hook({}, reachable(), ["--engine-worker", "thread", cwd]);
  const delivered = requests.length;
  expect(delivered).toBeGreaterThan(0);

  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  await hook({}, reachable(), ["--engine-worker", "thread", cwd]);

  expect(requests).toHaveLength(delivered);
});

it("tells the next hook once when an upload was refused and dropped, and that the API key was rejected", async () => {
  failStatus = 401;
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ hook_event_name: "Stop", transcript_path }, reachable());
  const warning = join(home, ".codex", "langsmith_warning.txt");
  await vi.waitFor(() => fs.access(warning), { timeout: 20_000, interval: 200 });

  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "next" },
    reachable(),
    [],
    "dropped it",
    expect.stringContaining("LangSmith API key was rejected"),
  );
  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "later" },
    reachable(),
  );
}, 60_000);

it.skipIf(process.env.CODEX_TEST_BINARY)(
  "uploads with the CLI login and says once per cooldown that the token expired",
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
            entries.filter(([kind, line]) => kind === "warn" && line?.includes("token expired")),
          ).toHaveLength(count);
        },
        { timeout: 20_000, interval: 100 },
      );
      return entries;
    };
    const env = {
      TRACE_TO_LANGSMITH: "true",
      LANGSMITH_CODEX_LOGIN_BROWSER: "false",
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
    const notice = expect.stringContaining("LangSmith token expired. Run `langsmith auth login`");
    const dropped = join(home, ".codex", "langsmith_warning.txt");
    await login("synthetic-expired");
    await hook(prompt("turn"), env);
    await hook({ hook_event_name: "Stop", transcript_path: await writeRollout() }, env);
    await renewals(1);
    await vi.waitFor(() => fs.access(dropped), { timeout: 20_000, interval: 100 });

    expect(requests[0]).toMatchObject({ auth: "Bearer synthetic-expired", key: undefined });
    const loginDropped = expect.stringMatching(/dropped it\. Run `langsmith auth login`/);
    await hook(
      prompt("key", "key-thread"),
      { ...env, LANGSMITH_API_KEY: "wire-key" },
      [],
      loginDropped,
    );
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
  const exported = { TRACE_TO_LANGSMITH: "true", LANGCHAIN_API_KEY: "sdk-key" };
  const elsewhere = { TRACE_TO_LANGSMITH: "true", LANGSMITH_ENDPOINT: "https://other.example" };
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  await hook(prompt("off"), { ...exported, TRACE_TO_LANGSMITH: "false" });
  await hook(
    prompt("one"),
    exported,
    [],
    "",
    expect.stringContaining("LANGCHAIN_API_KEY is overriding"),
  );
  await hook(prompt("two"), exported);
  await hook(
    prompt("three"),
    { ...elsewhere, LANGSMITH_CODEX_NOTICE_COOLDOWN: "0" },
    [],
    "",
    expect.stringContaining("login is for"),
  );
  await fs.rm(join(home, ".langsmith", "config.json"));
  await hook(
    prompt("no-login"),
    { ...exported, LANGSMITH_CODEX_NOTICE_COOLDOWN: "0" },
    [],
    "",
    expect.stringContaining("LangSmith isn't signed in"),
  );
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

it("still uploads to a replica with its own key and says once why the CLI login can't be used", async () => {
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );
  await fs.writeFile(
    join(cwd, "langsmith-plugins.json"),
    JSON.stringify({ replicas: [{ api_url: api, api_key: "replica-key", project: "replica" }] }),
  );
  const env = { TRACE_TO_LANGSMITH: "true", LANGCHAIN_API_KEY: "sdk-key" };
  const reason = expect.stringContaining("LANGCHAIN_API_KEY is overriding");
  const transcript_path = await writeRollout();
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" }, env, [], "", reason);
  await hook({ hook_event_name: "Stop", transcript_path }, env);
  await hook({}, env, ["--engine-worker", "thread", cwd]);
  await hook({ hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "next" }, env);

  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(({ key, auth }) => key === "replica-key" && auth === undefined)).toBe(true);
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
    await uploadersFinished();

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
    await uploadersFinished();

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
  const warning = join(home, ".codex", "langsmith_warning.txt");
  await vi.waitFor(() => fs.access(warning), { timeout: 20_000, interval: 200 });
  await fs.mkdir(join(home, ".langsmith"));
  await fs.writeFile(
    join(home, ".langsmith", "config.json"),
    JSON.stringify({ profiles: { default: { api_url: api, oauth: { access_token: "t" } } } }),
  );

  await hook(
    { hook_event_name: "UserPromptSubmit", prompt: "work", turn_id: "next" },
    { TRACE_TO_LANGSMITH: "true", LANGSMITH_ENDPOINT: api },
    [],
    "dropped it",
  );
}, 60_000);

const stateFiles = async () => [
  ...(await fs.readdir(join(home, ".codex"))).filter(
    (n) => n.endsWith("warning.txt") || n.includes("job-context"),
  ),
  ...Object.keys(
    JSON.parse(
      await fs.readFile(join(home, ".codex", "langsmith_state.json"), "utf8").catch(() => "{}"),
    ),
  ),
];

it("leaves no job context or warning behind after 20 delivered turns", async () => {
  const turns: string[] = [];
  for (let index = 0; index < 20; index++) {
    turns.push(`turn-${index}`);
    const transcript_path = await writeRollout("thread", "rollout.jsonl", turns);
    const turn_id = turns.at(-1)!;
    await hook({ turn_id, hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
    await hook({ turn_id, hook_event_name: "Stop", transcript_path }, reachable());
    await hook({}, reachable(), ["--engine-worker", "thread", cwd]);
  }
  expect(requests.length).toBeGreaterThanOrEqual(20);
  expect(await stateFiles()).toEqual([]);
}, 120_000);

async function strandSession(projectDirectory: string, threadId: string): Promise<void> {
  failStatus = 500;
  const transcript_path = await writeRollout(
    threadId,
    "stranded.jsonl",
    ["turn"],
    projectDirectory,
  );
  const event = { session_id: threadId, cwd: projectDirectory };
  await hook({ ...event, hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ ...event, hook_event_name: "Stop", transcript_path }, reachable());
  const pid = await claimedWorkerPid(join(home, ".codex", "langsmith_engine"));
  process.kill(pid!, "SIGKILL");
  const longAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const age = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await age(path);
      else await fs.utimes(path, longAgo, longAgo);
    }
  };
  await age(join(home, ".codex", "langsmith_engine"));
  failStatus = 0;
  requests = [];
}

async function recoverWithRedaction(
  strandedSettings: object,
  laterSettings: object,
  recovered: boolean,
) {
  const projectA = join(dir, "project-a");
  await fs.mkdir(join(projectA, ".codex"), { recursive: true });
  await fs.writeFile(join(projectA, "langsmith-plugins.json"), JSON.stringify(strandedSettings));
  await fs.writeFile(join(cwd, "langsmith-plugins.json"), JSON.stringify(laterSettings));
  await strandSession(projectA, "thread");

  const later = await writeRollout("later-thread", "later.jsonl");
  const event = { session_id: "later-thread" };
  await hook({ ...event, hook_event_name: "UserPromptSubmit", prompt: "work" }, reachable());
  await hook({ ...event, hook_event_name: "Stop", transcript_path: later }, reachable());
  await hook({}, reachable(), ["--engine-worker", "later-thread", cwd]);

  const byThread = (id: string) =>
    JSON.stringify(
      requests
        .flatMap(({ body, path }) => body.post ?? (path.endsWith("/runs") ? [body] : []))
        .filter((run) => run.extra?.metadata?.thread_id === id),
    );
  if (recovered) {
    await vi.waitFor(() => expect(byThread("thread")).toContain("openai.codex"), {
      timeout: 20_000,
      interval: 200,
    });
  } else {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { own: byThread("later-thread"), stranded: byThread("thread") };
}

const redactPrivate = {
  redact: true,
  redact_extra_rules: [{ pattern: "PRIVATE_BODY", replace: "[A-REDACTED]" }],
};

it("uploads work stranded by another session once a later hook runs, rebuilt as its own session would", async () => {
  const { own, stranded } = await recoverWithRedaction(
    { ...redactPrivate, metadata: { owner: "a" } },
    { ...redactPrivate, metadata: { owner: "b" } },
    true,
  );
  expect(stranded).toContain('"owner":"a"');
  expect(own).toContain('"owner":"b"');
}, 90_000);

it("never uploads another session's stranded work with this session's weaker redaction", async () => {
  const { own, stranded } = await recoverWithRedaction(redactPrivate, { redact: false }, false);
  expect(own).toContain("PRIVATE_BODY");
  expect(stranded).not.toContain("PRIVATE_BODY");
}, 60_000);

it("uploads another session's stranded work redacted when both sessions redact the same way", async () => {
  const { stranded } = await recoverWithRedaction(redactPrivate, redactPrivate, true);
  expect(stranded).toContain("A-REDACTED");
  expect(stranded).not.toContain("PRIVATE_BODY");
}, 60_000);

it("does upload the stranded work in clear when neither session redacts, proving the check can fail", async () => {
  const { stranded } = await recoverWithRedaction({ redact: false }, { redact: false }, true);
  expect(stranded).toContain("PRIVATE_BODY");
}, 60_000);
