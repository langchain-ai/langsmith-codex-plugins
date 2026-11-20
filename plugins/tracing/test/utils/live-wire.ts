import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect } from "vitest";

export type Run = Record<string, any>;
export type Batch = { key: string; post: Run[]; patch?: Run[] };
const INVALID_BATCH = "Unprocessable entity: invalid batch JSON: batch schema error patch.";
const ALREADY_RECEIVED =
  "Run update payload already received. Duplicate run update requests for the same run are not supported.";

export const read = async (name: string) =>
  (await fs.readFile(new URL(`../sessions/2026/${name}`, import.meta.url), "utf8"))
    .trim()
    .split("\n");
export const ids = (rows: string[]) =>
  [JSON.parse(rows[0]).payload.id, JSON.parse(rows[1]).payload.turn_id] as [string, string];
const outputLine = (callId: string, rows: string[]) =>
  rows.findIndex((line) => {
    const { payload } = JSON.parse(line);
    return payload.call_id === callId && String(payload.type).endsWith("call_output");
  });

export function liveWire() {
  const received: Batch[] = [];
  const updated = new Set<string>();
  const ingest = ({ key, post = [], patch = [] }: Batch): [number, string?] => {
    const missing = patch.findIndex((run) => run.end_time === undefined);
    if (missing >= 0) return [422, `${INVALID_BATCH}${missing}: end_time is required`];
    const fresh = patch.filter(
      (run, i) => !updated.has(key + run.id) && patch.findIndex(({ id }) => id === run.id) === i,
    );
    if (patch.length > 0 && fresh.length === 0 && post.length === 0) return [409, ALREADY_RECEIVED];
    for (const run of fresh) updated.add(key + run.id);
    received.push({ key, post, patch: fresh });
    return [200];
  };
  let dir = "";
  const homes: string[] = [];
  let server: Server;
  let api = "";
  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), "codex-live-tool-"));
    received.length = 0;
    updated.clear();
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
      res.setHeader("content-type", "application/json");
      if (!req.url?.endsWith("/runs/batch")) return res.end("{}");
      const [status, error] = ingest({ key: String(req.headers["x-api-key"]), ...body });
      res.statusCode = status;
      res.end(JSON.stringify(error ? { error } : {}));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    api = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => {
    for (const home of homes.splice(0)) await stopTracer(home);
    await sleep(300);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function workspace(name: string, rows: string[]) {
    const [session, turn] = ids(rows);
    const home = join(dir, name, "home");
    homes.push(home);
    const cwd = join(dir, name, "project");
    await fs.mkdir(join(home, ".codex"), { recursive: true });
    await fs.mkdir(cwd, { recursive: true });
    const settings = { enabled: true, api_url: api, api_key: name, project: "live", replicas: [] };
    await fs.writeFile(join(cwd, "langsmith-plugins.json"), JSON.stringify(settings));
    const transcript = join(cwd, "rollout.jsonl");
    const hook = async (event: Record<string, unknown>, args: string[] = []) => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(LANGCHAIN_|LANGSMITH_|TRACE_TO)/.test(key),
        ),
      );
      const bundle = fileURLToPath(new URL("../../dist/index.mjs", import.meta.url));
      const child = spawn(process.execPath, [bundle, ...args], {
        cwd,
        env: { ...env, HOME: home },
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => (stderr += chunk));
      const input = { session_id: session, turn_id: turn, cwd, transcript_path: transcript };
      child.stdin.end(JSON.stringify({ ...input, ...event }));
      const code = await new Promise((resolve) => child.on("close", resolve));
      expect({ code, stderr: args.length ? "" : stderr }).toEqual({ code: 0, stderr: "" });
    };
    const write = (end = rows.length) =>
      fs.writeFile(transcript, rows.slice(0, end).join("\n") + "\n");
    const toolHook = (callId: string) =>
      hook({ hook_event_name: "PostToolUse", tool_use_id: callId });
    const tool = async (callId: string) => {
      await write(outputLine(callId, rows) + 1);
      await toolHook(callId);
    };
    const stop = () => hook({ hook_event_name: "Stop" });
    const settle = () => settleTracer(home, () => received.length);
    await write(4);
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" });
    return { hook, write, tool, toolHook, stop, settle, transcript };
  }

  function trace(key: string) {
    const runs = new Map<string, Run>();
    const posts = new Map<string, number>();
    for (const batch of received.filter((item) => item.key === key)) {
      for (const run of batch.post) {
        posts.set(run.id, (posts.get(run.id) ?? 0) + 1);
        runs.set(run.id, { ...runs.get(run.id), ...run });
      }
      for (const run of batch.patch ?? []) runs.set(run.id, { ...runs.get(run.id), ...run });
    }
    return { runs, posts };
  }

  const sent = (kind: "post" | "patch", key?: string) =>
    received
      .filter((batch) => key === undefined || batch.key === key)
      .flatMap((batch) => batch[kind] ?? []);
  return { received, workspace, trace, sent, dir: () => dir };
}

const tracerFile = (home: string, name: string) =>
  join(home, ".codex", "langsmith_plugins_base", name);

async function notesRead(home: string): Promise<boolean> {
  const notes = await fs.stat(tracerFile(home, "notes.jsonl")).catch(() => undefined);
  const snapshot = await fs.readFile(tracerFile(home, "snapshot.json"), "utf8").catch(() => "{}");
  const { base = 0, offset = 0 } = JSON.parse(snapshot).notes ?? {};
  return base + offset >= (notes?.size ?? 0);
}

export async function settleTracer(home: string, uploads: () => number): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (let quiet = 0, count = -1; quiet < 4; await sleep(250)) {
    if (Date.now() > deadline) throw new Error("the tracer worker never settled");
    const sent = uploads();
    quiet = (await notesRead(home)) && sent === count ? quiet + 1 : 0;
    count = sent;
  }
}

export async function stopTracer(home: string): Promise<void> {
  const launched = await fs.stat(tracerFile(home, "notes.jsonl")).then(
    () => true,
    () => false,
  );
  let pid: unknown;
  for (const deadline = Date.now() + 5_000; ; await sleep(100)) {
    const lock = await fs.readFile(tracerFile(home, "tracer.lock"), "utf8").catch(() => "{}");
    ({ pid } = JSON.parse(lock));
    if (typeof pid === "number" || !launched || Date.now() > deadline) break;
  }
  if (typeof pid !== "number" || pid === process.pid) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {}
}
