import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as path from "node:path";

import { convertToRunTree } from "../src/trace.js";
import { mockClient } from "./utils/mock_client.js";
import { getAssumedTreeFromCalls } from "./utils/tree.js";

// Fixture transcripts live in memfs; validator.json is read via the real fs.
vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});
vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

beforeEach(() => vol.reset());
afterEach(() => vi.unstubAllEnvs());

// ── Fixture identities ──────────────────────────────────────────────────────
const PARENT_THREAD = "0199aaaa-1111-2222-3333-parentthread0";
const PARENT_TURN = "0199aaaa-tttt-0001";
const SUB_THREAD = "0199bbbb-4444-5555-6666-subthread0001";
const SUB_TURN = "0199bbbb-tttt-0002";

const CWD = "/Users/dev/langsmith-codex-plugins";
const GIT = {
  commit_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  branch: "main",
  repository_url: "https://github.com/langchain-ai/langsmith-codex-plugins.git",
};
const CLI_VERSION = "0.123.0";

// Build-time injected plugin version (see vitest.config.ts / tsdown.config.ts).
declare const __LS_INTEGRATION_VERSION__: string;
const INTEGRATION_VERSION = __LS_INTEGRATION_VERSION__;

let clock = Date.parse("2026-06-01T12:00:00.000Z");
function ts(): string {
  clock += 1000;
  return new Date(clock).toISOString();
}

function line(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ timestamp: ts(), type, payload });
}

const TOKEN_INFO = {
  total_token_usage: {
    input_tokens: 100,
    output_tokens: 20,
    total_tokens: 120,
    cached_input_tokens: 0,
    reasoning_output_tokens: 0,
  },
  last_token_usage: {
    input_tokens: 100,
    output_tokens: 20,
    total_tokens: 120,
    cached_input_tokens: 0,
    reasoning_output_tokens: 0,
  },
  model_context_window: 200000,
};

// Root turn that runs one plain tool (exec_command) and spawns one subagent.
function parentTranscript(): string {
  return [
    line("session_meta", {
      id: PARENT_THREAD,
      timestamp: ts(),
      cwd: CWD,
      originator: "codex-tui",
      cli_version: CLI_VERSION,
      source: "cli",
      model_provider: "openai",
      git: GIT,
      base_instructions: { text: "You are Codex." },
    }),
    line("event_msg", { type: "task_started", turn_id: PARENT_TURN }),
    line("turn_context", {
      turn_id: PARENT_TURN,
      cwd: CWD,
      approval_policy: "on-request",
      sandbox_policy: { type: "workspace-write", network_access: false },
      model: "gpt-5.4",
      summary: "none",
    }),
    line("response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Run a subagent" }],
    }),
    line("response_item", {
      type: "function_call",
      name: "exec_command",
      call_id: "call_exec_1",
      arguments: JSON.stringify({ cmd: "pwd" }),
    }),
    line("response_item", {
      type: "function_call_output",
      call_id: "call_exec_1",
      output: "/Users/dev",
    }),
    // Live schema: spawn_agent's output carries the child id as `agent_id`
    // (no collab_* event) — the real discovery trigger.
    line("response_item", {
      type: "function_call",
      name: "spawn_agent",
      call_id: "call_spawn_1",
      arguments: JSON.stringify({ agent_type: "explorer", message: "do research" }),
    }),
    line("response_item", {
      type: "function_call_output",
      call_id: "call_spawn_1",
      output: JSON.stringify({ agent_id: SUB_THREAD, nickname: "Harvey" }),
    }),
    line("response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "All done" }],
    }),
    line("event_msg", { type: "token_count", info: TOKEN_INFO }),
    line("event_msg", { type: "task_complete", turn_id: PARENT_TURN }),
  ].join("\n");
}

// Separate subagent rollout (its own session/hook). source.subagent.thread_spawn
// carries parent_thread_id, matching real Codex serialization (role null).
function subagentTranscript(): string {
  return [
    line("session_meta", {
      id: SUB_THREAD,
      timestamp: ts(),
      cwd: CWD,
      originator: "codex-tui",
      cli_version: CLI_VERSION,
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: PARENT_THREAD,
            depth: 1,
            agent_path: null,
            agent_nickname: "Harvey",
            agent_role: null,
          },
        },
      },
      agent_nickname: "Harvey",
      agent_role: null,
      model_provider: "openai",
      git: GIT,
      base_instructions: { text: "You are a Codex subagent." },
    }),
    line("event_msg", { type: "task_started", turn_id: SUB_TURN }),
    line("turn_context", {
      turn_id: SUB_TURN,
      cwd: CWD,
      approval_policy: "on-request",
      sandbox_policy: { type: "workspace-write", network_access: false },
      model: "gpt-5.4",
      summary: "none",
    }),
    line("response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "do research" }],
    }),
    line("response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "research done" }],
    }),
    line("event_msg", { type: "token_count", info: TOKEN_INFO }),
    line("event_msg", { type: "task_complete", turn_id: SUB_TURN }),
  ].join("\n");
}

type RunType = "root" | "llm" | "tool" | "subagent";

// Real emission path: parent + child co-located under a sessions/ tree. Only the
// PARENT is traced; the child must be DISCOVERED via spawn_agent and recursed into.
const BASE_DIR = "/home/codex-user/.codex/sessions/2026/06/01";

function classify(run: { run_type?: string; parent_run_id?: string | null }): RunType | undefined {
  if (run.run_type === "llm") return "llm";
  if (run.run_type === "tool") return "tool";
  if (run.run_type === "chain") return run.parent_run_id ? "subagent" : "root";
  return undefined;
}

async function buildRuns() {
  const { client, callSpy } = mockClient();

  vol.fromJSON({
    [path.join(BASE_DIR, `rollout-parent-${PARENT_THREAD}.jsonl`)]: parentTranscript(),
    [path.join(BASE_DIR, `rollout-sub-${SUB_THREAD}.jsonl`)]: subagentTranscript(),
  });

  await convertToRunTree(
    {
      transcript_path: path.join(BASE_DIR, `rollout-parent-${PARENT_THREAD}.jsonl`),
      turn_id: PARENT_TURN,
    },
    { client, projectName: "codex" },
  );
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

  const byType: Record<RunType, Array<Record<string, unknown>>> = {
    root: [],
    llm: [],
    tool: [],
    subagent: [],
  };
  for (const run of Object.values(tree.data) as Array<{
    run_type?: string;
    parent_run_id?: string | null;
    extra?: { metadata?: Record<string, unknown> };
  }>) {
    const type = classify(run);
    if (type != null) byType[type].push(run.extra?.metadata ?? {});
  }

  return byType;
}

describe("coding-agent-v1 contract", () => {
  // The live failure: the subagent rollout was never emitted. Tracing the PARENT
  // alone must DISCOVER the child (via spawn_agent) and post it under the root thread.
  it("discovers and emits the subagent from the parent trace alone", async () => {
    const byType = await buildRuns();
    expect(byType.subagent.length, "subagent runs discovered").toBeGreaterThanOrEqual(1);
    for (const meta of byType.subagent) {
      expect(meta.thread_id).toBe(PARENT_THREAD);
      expect(meta.ls_subagent_id).toBe(SUB_THREAD);
      expect(meta.ls_subagent_type).toBe("Harvey");
    }
  });

  // LLM/tool spans come from the inter-event timeline, not a single instant.
  it("assigns non-zero durations from gapped timestamps", async () => {
    const { client, callSpy } = mockClient();
    vol.fromJSON({
      [path.join(BASE_DIR, `rollout-parent-${PARENT_THREAD}.jsonl`)]: parentTranscript(),
      [path.join(BASE_DIR, `rollout-sub-${SUB_THREAD}.jsonl`)]: subagentTranscript(),
    });
    await convertToRunTree(
      {
        transcript_path: path.join(BASE_DIR, `rollout-parent-${PARENT_THREAD}.jsonl`),
        turn_id: PARENT_TURN,
      },
      { client, projectName: "codex" },
    );
    await client.awaitPendingTraceBatches();
    const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);

    const toMs = (v: unknown) => (typeof v === "number" ? v : Date.parse(String(v)));
    const runs = Object.values(tree.data) as Array<{
      run_type?: string;
      start_time?: unknown;
      end_time?: unknown;
    }>;
    const dur = (r: { start_time?: unknown; end_time?: unknown }) =>
      toMs(r.end_time) - toMs(r.start_time);

    const llm = runs.find((r) => r.run_type === "llm");
    const tool = runs.find((r) => r.run_type === "tool");
    expect(dur(llm!), "llm duration").toBeGreaterThan(0);
    expect(dur(tool!), "tool duration").toBeGreaterThan(0);
  });

  it("emits the required contract keys on every run type", async () => {
    const realFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const validator = JSON.parse(
      await realFs.readFile(path.join(__dirname, "fixtures", "validator.json"), "utf-8"),
    ) as {
      keys: Array<{
        key: string;
        appliesTo: RunType[];
        type: "string" | "integer";
        allowedValues: string[] | null;
        requirement: "always" | "where_known" | "contextual";
      }>;
    };

    const byType = await buildRuns();

    // Sanity: the fixture exercises all four run types.
    expect(byType.root.length, "root runs").toBeGreaterThanOrEqual(1);
    expect(byType.llm.length, "llm runs").toBeGreaterThanOrEqual(1);
    expect(byType.tool.length, "tool runs").toBeGreaterThanOrEqual(1);
    expect(byType.subagent.length, "subagent runs").toBeGreaterThanOrEqual(1);

    const checkKey = (
      meta: Record<string, unknown>,
      def: (typeof validator.keys)[number],
      label: string,
    ) => {
      const value = meta[def.key];
      expect(value, `${label}: ${def.key} present`).toBeDefined();
      if (def.type === "integer") {
        expect(Number.isInteger(value), `${label}: ${def.key} integer`).toBe(true);
      } else {
        expect(typeof value, `${label}: ${def.key} string`).toBe("string");
      }
      if (def.allowedValues != null) {
        expect(def.allowedValues, `${label}: ${def.key} allowed`).toContain(value);
      }
    };

    // The fixture provides every where_known value, so all must be present.
    const requiredDefs = validator.keys.filter(
      (k) => k.requirement === "always" || k.requirement === "where_known",
    );

    for (const type of ["root", "llm", "tool", "subagent"] as const) {
      for (const [idx, meta] of byType[type].entries()) {
        const label = `${type}[${idx}]`;
        for (const def of requiredDefs) {
          if (!def.appliesTo.includes(type)) continue;
          checkKey(meta, def, label);
        }
      }
    }
  });

  it("scopes contextual keys to their run types", async () => {
    const byType = await buildRuns();

    // approval_policy — root only (never llm/tool/subagent).
    for (const meta of byType.root) expect(meta.approval_policy).toBe("on-request");
    for (const type of ["llm", "tool", "subagent"] as const) {
      for (const meta of byType[type]) {
        expect(meta.approval_policy, `${type} approval_policy`).toBeUndefined();
      }
    }

    // ls_subagent_* — subagent only. type falls back from null role to nickname.
    for (const meta of byType.subagent) {
      expect(meta.ls_subagent_id).toBe(SUB_THREAD);
      expect(meta.ls_subagent_type).toBe("Harvey");
    }
    for (const type of ["root", "llm", "tool"] as const) {
      for (const meta of byType[type]) {
        expect(meta.ls_subagent_id, `${type} ls_subagent_id`).toBeUndefined();
        expect(meta.ls_subagent_type, `${type} ls_subagent_type`).toBeUndefined();
      }
    }

    // ls_tool_name — tool runs only, and only when run name differs from native.
    for (const type of ["root", "llm", "subagent"] as const) {
      for (const meta of byType[type]) {
        expect(meta.ls_tool_name, `${type} ls_tool_name`).toBeUndefined();
      }
    }
    for (const meta of byType.tool) {
      if (meta.ls_tool_name !== undefined) expect(typeof meta.ls_tool_name).toBe("string");
    }
  });

  it("maps the frozen literal values and turn markers", async () => {
    const byType = await buildRuns();
    const root = byType.root[0];

    expect(root.ls_agent_kind).toBe("coding_agent");
    expect(root.ls_integration).toBe("openai-codex");
    expect(root.ls_agent_runtime).toBe("Codex");
    expect(root.ls_trace_schema_version).toBe("coding-agent-v1");

    expect(root.ls_integration_version).toBe(INTEGRATION_VERSION);
    expect(root.ls_agent_runtime_version).toBe(CLI_VERSION);

    expect(root.thread_id).toBe(PARENT_THREAD);
    expect(root.turn_id).toBe(PARENT_TURN);
    expect(root.turn_number).toBe(1);

    expect(root.repository_url).toBe("https://github.com/langchain-ai/langsmith-codex-plugins");
    expect(root.repository_provider).toBe("github");
    expect(root.repository_name).toBe("langsmith-codex-plugins");
    expect(root.git_branch).toBe("main");
    expect(root.git_commit_sha).toBe(GIT.commit_hash);
    expect(root.cwd).toBe(CWD);
    expect(root.sandbox_type).toBe("workspace-write");

    // Compat alias; never surfaces ls_subagent_type on the root.
    expect(root.ls_agent_type).toBe("root");
    expect(root.ls_subagent_type).toBeUndefined();
    expect(root.codex_cli_version).toBe(CLI_VERSION);

    // Independently-traced subagent groups under the ROOT thread_id, not its own.
    const sub = byType.subagent[0];
    expect(sub.thread_id).toBe(PARENT_THREAD);
    expect(sub.thread_id).not.toBe(SUB_THREAD);
    expect(sub.ls_subagent_id).toBe(SUB_THREAD);
    expect(sub.turn_id).toBe(SUB_TURN);
    expect(sub.turn_number).toBe(1);
    expect(sub.ls_agent_type).toBe("subagent");

    // Every run shares the root thread_id; turn markers are per-turn.
    for (const meta of [...byType.llm, ...byType.tool]) {
      expect(meta.thread_id).toBe(PARENT_THREAD);
    }
    const parentChildren = [...byType.llm, ...byType.tool].filter((m) => m.turn_id === PARENT_TURN);
    expect(parentChildren.length).toBeGreaterThanOrEqual(3);
    for (const meta of parentChildren) expect(meta.turn_number).toBe(1);

    // Subagent-owned llm/tool runs carry the subagent's own turn marker.
    const subChildren = [...byType.llm, ...byType.tool].filter((m) => m.turn_id === SUB_TURN);
    expect(subChildren.length).toBeGreaterThanOrEqual(1);
    for (const meta of subChildren) {
      expect(meta.turn_id).toBe(SUB_TURN);
      expect(meta.turn_number).toBe(1);
    }
  });
});
