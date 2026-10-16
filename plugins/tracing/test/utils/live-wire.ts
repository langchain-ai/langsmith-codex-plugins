import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { withFileLock } from "@langchain/plugins-base/storage";
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
export const outputLine = (callId: string, rows: string[]) =>
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
    await sleep(300);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function workspace(name: string, rows: string[]) {
    const [session, turn] = ids(rows);
    const home = join(dir, name, "home");
    const cwd = join(dir, name, "project");
    await fs.mkdir(join(home, ".codex"), { recursive: true });
    await fs.mkdir(cwd, { recursive: true });
    const settings = { enabled: true, api_url: api, api_key: name, project: "live", replicas: [] };
    await fs.writeFile(join(cwd, "langsmith-plugins.json"), JSON.stringify(settings));
    const transcript = join(cwd, "rollout.jsonl");
    const marker = `${transcript}.langsmith`;
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
    const write = (end = rows.length, tail = "") =>
      fs.writeFile(transcript, rows.slice(0, end).join("\n") + "\n" + tail);
    const toolHook = (callId: string) =>
      hook({ hook_event_name: "PostToolUse", tool_use_id: callId });
    const arriving = async (callId: string, first: number, tail = "") => {
      await write(first, tail);
      const hooked = toolHook(callId);
      await sleep(400);
      await write(Math.max(first, outputLine(callId, rows)) + 1);
      await hooked;
    };
    const tool = async (callId: string) => {
      await write(outputLine(callId, rows) + 1);
      await toolHook(callId);
    };
    const stop = () => hook({ hook_event_name: "Stop" });
    const locked = <T>(action: () => Promise<T>) => withFileLock(marker, action);
    const settle = async () => {
      await hook({}, ["--engine-worker", session, cwd]);
      for (
        let quiet = 0, count = -1;
        quiet < 8;
        quiet = received.length === count ? quiet + 1 : 0
      ) {
        count = received.length;
        await sleep(250);
      }
    };
    await write(4);
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "work" });
    return { hook, write, tool, toolHook, arriving, stop, locked, settle, transcript, marker };
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
