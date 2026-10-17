import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { createRepositoryAttributor } from "@langchain/plugins-base/git";
import { buildCodingAgentMetadata } from "@langchain/plugins-base/metadata";
import type { RunTree } from "langsmith";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TracingMode } from "../src/models/tracing-policy.js";
import { convertToRunTree } from "./utils/convert.js";
import { defaultPrivacyPath } from "../src/tracing-policy.js";

const THREAD = "0199cccc-1111-2222-3333-attribution01";
const TURN = "0199cccc-tttt-0001";
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "codex-attribution-"));
  vi.stubEnv("HOME", dir);
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

async function repository(name: string, author: string): Promise<string> {
  const root = path.join(dir, name);
  await mkdir(root, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", author);
  git("remote", "add", "origin", `https://github.com/acme/${name}.git`);
  await writeFile(path.join(root, "a.txt"), "x");
  git("add", ".");
  git("-c", "user.email=e2e@example.com", "commit", "-q", "-m", "init");
  return root;
}

function transcript(cwd: string, other: string, patched: string): string {
  const line = (type: string, payload: Record<string, unknown>) =>
    JSON.stringify({ timestamp: "2026-06-01T12:00:01.000Z", type, payload });
  const call = (call_id: string, name: string, args: Record<string, unknown>) => [
    line("response_item", {
      type: "function_call",
      name,
      call_id,
      arguments: JSON.stringify(args),
    }),
    line("response_item", { type: "function_call_output", call_id, output: "ok" }),
  ];
  return [
    line("session_meta", { id: THREAD, cwd, cli_version: "0.123.0", source: "cli" }),
    line("event_msg", { type: "task_started", turn_id: TURN }),
    line("turn_context", { turn_id: TURN, cwd, model: "gpt-5.4" }),
    line("response_item", { type: "message", role: "user", content: [] }),
    ...call("call_other", "exec_command", { cmd: "ls", workdir: other }),
    line("response_item", {
      type: "custom_tool_call",
      name: "apply_patch",
      call_id: "call_patch",
      input: `*** Begin Patch\n*** Update File: ${path.relative(cwd, path.join(patched, "a.txt"))}\n@@\n-x\n+y\n*** End Patch`,
    }),
    line("response_item", { type: "custom_tool_call_output", call_id: "call_patch", output: "ok" }),
    ...call("call_plain", "exec_command", { cmd: "pwd" }),
    line("response_item", { type: "message", role: "assistant", content: [] }),
    line("event_msg", { type: "task_complete", turn_id: TURN }),
  ].join("\n");
}

async function convert(privacyMode?: TracingMode) {
  const [session, other, patched] = await Promise.all([
    repository("session-repo", "Session Author"),
    repository("other-repo", "Other Author"),
    repository("patched-repo", "Patched Author"),
  ]);
  const transcript_path = path.join(dir, "rollout.jsonl");
  await writeFile(transcript_path, transcript(session, other, patched));
  const threads = { [THREAD]: { turns: { [TURN]: "full" } } };
  await mkdir(path.dirname(defaultPrivacyPath()), { recursive: true });
  await writeFile(defaultPrivacyPath(), JSON.stringify({ version: 1, threads }));
  const runs: RunTree[] = [];
  const attributor = createRepositoryAttributor({
    githubLoginMarkerPath: path.join(dir, "langsmith_gh_login.json"),
  });
  const calls = [vi.spyOn(attributor, "toolMetadata"), vi.spyOn(attributor, "turnMetadata")];
  const uploaded = new Map<RunTree, Record<string, unknown>>();
  await convertToRunTree(
    { transcript_path, turn_id: TURN },
    {
      captureRun: async (run, _mode, options) => {
        runs.push(run);
        uploaded.set(run, buildCodingAgentMetadata(options));
      },
      attributor,
      ...(privacyMode === undefined ? {} : { privacyMode }),
    },
  );
  const metadata = (find: (run: RunTree) => boolean) => uploaded.get(runs.find(find)!);
  return { runs, metadata, calls };
}

it("labels each tool with the repository its path landed in and the turn with the session's", async () => {
  const { runs, metadata } = await convert();
  const byName = (name: string, arg: string) =>
    metadata((run) => run.name === name && JSON.stringify(run.inputs).includes(arg));

  expect(metadata((run) => run.name === "openai.codex")).toMatchObject({
    repository_name: "acme/session-repo",
    ls_attribution_identifier: "Session Author",
  });
  expect(byName("exec_command", "workdir")).toMatchObject({
    repository_name: "acme/other-repo",
    ls_attribution_identifier: "Other Author",
  });
  expect(byName("apply_patch", "Update File")).toMatchObject({
    repository_name: "acme/patched-repo",
    ls_attribution_identifier: "Patched Author",
  });
  expect(byName("exec_command", "pwd")).toMatchObject({
    repository_name: "acme/session-repo",
    ls_attribution_identifier: "Session Author",
  });
  expect(runs.length).toBeGreaterThan(4);
});

it("leaves repository and author off a metadata-only turn without running git for it", async () => {
  const { runs, calls } = await convert("metadata");
  expect(runs.length).toBeGreaterThan(0);
  for (const call of calls) expect(call).not.toHaveBeenCalled();
  for (const run of runs) {
    expect(run.extra?.metadata).not.toHaveProperty("repository_name");
    expect(run.extra?.metadata).not.toHaveProperty("ls_attribution_identifier");
  }
});
