import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { vol } from "memfs";

import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mockClient } from "./utils/mock_client.js";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree.js";

// Build-time injected plugin version (see vitest.config.ts / tsdown.config.ts).
declare const __LS_INTEGRATION_VERSION__: string;
const INTEGRATION_VERSION = __LS_INTEGRATION_VERSION__;
const execFileAsync = promisify(execFile);
const temporaryGitDirectories: string[] = [];

async function createGitRepository(author: string | undefined, remote: string, parent?: string) {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const root = parent
    ? path.join(parent, "child")
    : await fs.mkdtemp(path.join(os.tmpdir(), "codex-trace-git-"));
  temporaryGitDirectories.push(root);
  await fs.mkdir(root, { recursive: true });
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  if (author) await execFileAsync("git", ["config", "user.name", author], { cwd: root });
  await execFileAsync("git", ["remote", "add", "origin", remote], { cwd: root });
  await fs.writeFile(path.join(root, "file.txt"), "test\n");
  await execFileAsync("git", ["add", "file.txt"], { cwd: root });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Commit Author",
      "-c",
      "user.email=codex-test@example.com",
      "commit",
      "-qm",
      "test",
    ],
    { cwd: root },
  );
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
  vol.mkdirSync(root, { recursive: true });
  return { root, commit: stdout.trim(), remote: remote.replace(/\.git$/, "") };
}

async function writeAttributionRollout(options: {
  sessionCwd: string;
  sessionMetaCwd?: string;
  sessionGit?: Record<string, string>;
  sessionIdentifier?: string;
  calls: { id: string; name: string; args?: Record<string, unknown>; input?: string }[];
  completionOrder?: string[];
  evidence?: Record<string, Record<string, unknown>>;
}) {
  const sessionId = "attribution-thread";
  const turnId = "attribution-turn";
  const events: Record<string, unknown>[] = [];
  let timestamp = Date.parse("2026-10-07T12:00:00.000Z");
  const add = (type: string, payload: Record<string, unknown>) => {
    events.push({ timestamp: new Date(timestamp++).toISOString(), type, payload });
  };

  add("session_meta", {
    id: sessionId,
    timestamp: new Date(timestamp++).toISOString(),
    cwd: options.sessionMetaCwd ?? options.sessionCwd,
    originator: "codex-test",
    cli_version: "0.160.0",
    source: "cli",
    model_provider: "openai",
    git: options.sessionGit,
    ls_attribution_identifier: options.sessionIdentifier,
  });
  add("event_msg", { type: "task_started", turn_id: turnId });
  add("turn_context", { cwd: options.sessionCwd, model: "gpt-test" });
  add("response_item", {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "Inspect these repositories" }],
  });
  for (const call of options.calls) {
    add(
      "response_item",
      call.input == null
        ? {
            type: "function_call",
            name: call.name,
            arguments: JSON.stringify(call.args ?? {}),
            call_id: call.id,
          }
        : { type: "custom_tool_call", name: call.name, input: call.input, call_id: call.id },
    );
  }
  for (const id of options.completionOrder ?? options.calls.map((call) => call.id)) {
    const evidence = options.evidence?.[id];
    if (typeof evidence?.cwd === "string") {
      add("event_msg", {
        type: "exec_command_end",
        call_id: id,
        turn_id: turnId,
        command: ["/bin/zsh", "-lc", "pwd"],
        cwd: evidence.cwd,
        parsed_cmd: [],
        stdout: "",
        stderr: "",
        exit_code: 0,
        duration: { secs: 0, nanos: 0 },
        formatted_output: "",
        status: "completed",
      });
    }
    if (evidence?.changes) {
      add("event_msg", {
        type: "patch_apply_end",
        call_id: id,
        turn_id: turnId,
        changes: evidence.changes,
        status: "completed",
      });
    }
  }
  for (const call of options.calls) {
    add("response_item", { type: "function_call_output", call_id: call.id, output: "done" });
  }
  add("response_item", {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: "Done" }],
  });
  add("event_msg", { type: "turn_complete", turn_id: turnId });

  vol.fromJSON({
    [EDITING_FILE]: events.map((event) => JSON.stringify(event)).join("\n") + "\n",
  });
  seedFullLaunchEvidence();
  return { sessionId, turnId };
}

async function preloadTestFiles(options: {
  makeTurnIncomplete: boolean;
  subagentProtocol?: "legacy" | "v2";
}) {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

  const sourceDir = path.join(__dirname, "sessions/2026/04/23");
  const targetDir = path.join("/home/codex-user/.codex/sessions/2026/04/23");

  const fileDir = await fs.readdir(sourceDir);

  const testFiles: Record<string, string> = {};

  for (const file of fileDir) {
    if (!file.endsWith(".jsonl")) continue;

    let content = await fs.readFile(path.join(sourceDir, file), "utf-8");

    if (options.subagentProtocol === "v2" && file === "rollout-subagents.jsonl") {
      const children = new Map([
        [
          "call_8OH6877kwWsCioAo0t5q4SD1",
          { threadId: "019dbc03-79de-7d53-8196-3167d9a32762", path: "/root/harvey" },
        ],
        [
          "call_YLhnEvlSUFUUdFauf7zFNkV6",
          { threadId: "019dbc03-79ee-7ee0-b40b-26920c74c524", path: "/root/leibniz" },
        ],
      ]);
      const lines = content
        .trim()
        .split("\n")
        .flatMap((line) => {
          const event = JSON.parse(line);
          const child = children.get(event.payload.call_id);
          if (event.payload.type !== "function_call_output" || child == null) return [event];

          event.payload.output = JSON.stringify({ task_name: child.path });
          return [
            event,
            {
              timestamp: event.timestamp,
              ordinal: 1,
              type: "event_msg",
              payload: {
                type: "item_completed",
                thread_id: "019dbc02-cc63-7893-9d13-9b24a7db0ace",
                turn_id: "019dbc03-4aa2-72a0-8190-c747168c8f1d",
                item: {
                  type: "SubAgentActivity",
                  id: event.payload.call_id,
                  kind: "started",
                  agent_thread_id: child.threadId,
                  agent_path: child.path,
                },
              },
            },
          ];
        });
      content = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
    }

    if (
      options.subagentProtocol === "v2" &&
      file.startsWith("rollout-subagents-") &&
      file !== "rollout-subagents.jsonl"
    ) {
      const lines = content
        .trim()
        .split("\n")
        .map((line) => {
          const event = JSON.parse(line);
          if (event.type === "session_meta") {
            event.payload.source = "cli";
            event.payload.thread_source = "subagent";
            event.payload.parent_thread_id = "019dbc02-cc63-7893-9d13-9b24a7db0ace";
          }
          return JSON.stringify(event);
        });
      content = lines.join("\n") + "\n";
    }

    if (options.makeTurnIncomplete) {
      // Remove the last line to simulate an incomplete turn
      const lines = content.trim().split("\n");
      lines.pop();
      content = lines.join("\n") + "\n";
    }

    testFiles[path.join(targetDir, file)] = content;
  }

  return testFiles;
}

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

beforeEach(() => vol.reset());
afterEach(async () => {
  vi.unstubAllEnvs();
  if (temporaryGitDirectories.length === 0) return;
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  await Promise.all(
    temporaryGitDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

it.each([{ makeTurnIncomplete: true }, { makeTurnIncomplete: false }])(
  "editing %s",
  async ({ makeTurnIncomplete }) => {
    const { client, callSpy } = mockClient();

    vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete }));

    seedFullLaunchEvidence();
    await convertToRunTree(
      {
        transcript_path: path.join(
          "/home/codex-user/.codex/sessions/2026/04/23/rollout-editing.jsonl",
        ),
        turn_id: "019dbc00-ede4-77c2-9e7a-b6876efeab9b",
      },
      { client, projectName: "codex" },
    );

    await client.awaitPendingTraceBatches();

    // Sidecar file is created
    expect.soft(vol.toJSON()).toMatchObject({
      "/home/codex-user/.codex/sessions/2026/04/23/rollout-editing.jsonl.langsmith":
        expect.stringContaining("019dbc00-ede4-77c2-9e7a-b6876efeab9b"),
    });

    // Assert on trace output
    await expect.soft(getAssumedTreeFromCalls(callSpy.mock.calls, client)).resolves.toMatchObject(
      asTree((run) => {
        run`openai.codex:0`(
          {
            run_type: "chain",
            inputs: {
              messages: expect.arrayContaining([
                {
                  role: "user",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Create a sample app that does cowsay"),
                    },
                  ]),
                },
              ]),
            },
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Created a minimal Node sample app"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                codex_cli_version: "0.123.0",
                turn_id: "019dbc00-ede4-77c2-9e7a-b6876efeab9b",
                turn_number: 1,
                thread_id: "019dbc00-a3c9-7681-8e0c-73139815b4f2",
                ls_integration: "openai-codex",
                ls_agent_purpose: "coding",
                ls_agent_runtime: "Codex",
                ls_agent_runtime_version: "0.123.0",
                ls_trace_schema_version: "coding-agent-v1",
                ls_integration_version: INTEGRATION_VERSION,
                ls_agent_type: "root",
                approval_policy: "on-request",
                cwd: "/Users/duongtat/Work/ls-codex-sample",
                sandbox_type: "workspace-write",
                ls_message_format: "anthropic",
                ls_raw_aggregated_usage: expect.objectContaining({
                  input_tokens: 71213,
                  output_tokens: 1627,
                  total_tokens: 72840,
                  input_token_details: expect.objectContaining({
                    cache_read: 57088,
                    cache_creation: 337,
                  }),
                }),
              }),
            },
          },
          run`openai.codex.turn:1`({
            run_type: "llm",
            inputs: {
              messages: expect.arrayContaining([
                {
                  role: "user",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Create a sample app that does cowsay"),
                    },
                  ]),
                },
              ]),
            },
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("inspect the repo structure"),
                    },
                    expect.objectContaining({
                      type: "tool_call",
                      name: "exec_command",
                      args: expect.objectContaining({ cmd: "pwd" }),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                ls_model_type: "chat",
                ls_provider: "openai",
                ls_model_name: "gpt-5.4",
                ls_invocation_params: expect.objectContaining({
                  model: "gpt-5.4",
                  current_date: "2026-04-23",
                }),
                usage_metadata: expect.objectContaining({
                  input_tokens: 13226,
                  output_tokens: 209,
                  total_tokens: 13435,
                }),
              }),
            },
          }),
          run`exec_command:2`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("/Users/duongtat/Work/ls-codex-sample"),
                    },
                  ]),
                }),
              ]),
              status: "completed",
              aggregated_output: "/Users/duongtat/Work/ls-codex-sample\n",
              exit_code: 0,
              command: ["/bin/zsh", "-lc", "pwd"],
            },
          }),
          run`exec_command:3`({
            run_type: "tool",
            error: "Exit code: 1",
            outputs: {
              status: "failed",
              parsed_cmd: [{ type: "list_files", cmd: "rg --files" }],
            },
          }),
          run`exec_command:4`({
            run_type: "tool",
            outputs: {
              status: "completed",
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("total 0"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:5`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("workspace is empty"),
                    },
                    expect.objectContaining({
                      type: "tool_call",
                      name: "exec_command",
                      args: expect.objectContaining({ cmd: "node --version" }),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 13635,
                  output_tokens: 378,
                  total_tokens: 14013,
                }),
              }),
            },
          }),
          run`exec_command:6`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("v22.14.0"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`exec_command:7`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("10.9.2"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:8`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("adding the app files"),
                    },
                    expect.objectContaining({
                      type: "tool_call",
                      name: "apply_patch",
                      args: expect.stringContaining("Add File"),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14116,
                  output_tokens: 751,
                  total_tokens: 14867,
                }),
              }),
            },
          }),
          run`apply_patch:9`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Success. Updated the following files"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:10`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    expect.objectContaining({
                      type: "tool_call",
                      name: "exec_command",
                      args: expect.objectContaining({
                        cmd: expect.stringContaining("node index.js"),
                      }),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14960,
                  output_tokens: 124,
                  total_tokens: 15084,
                }),
              }),
            },
          }),
          run`exec_command:11`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("< Sample app works >"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`exec_command:12`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Hello from npm"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:13`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Verified both"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 15276,
                  output_tokens: 165,
                  total_tokens: 15441,
                }),
              }),
            },
          }),
        );
      }),
    );
  },
);

it.each([{ makeTurnIncomplete: true }, { makeTurnIncomplete: false }])(
  "attachments %s",
  async ({ makeTurnIncomplete }) => {
    const { client, callSpy } = mockClient();
    vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete }));

    seedFullLaunchEvidence();
    await convertToRunTree(
      {
        transcript_path: path.join(
          "/home/codex-user/.codex/sessions/2026/04/23/rollout-attachments.jsonl",
        ),
        turn_id: "019dbc02-53d1-7fc2-8e82-a5419b451d7a",
      },
      { client, projectName: "codex" },
    );
    // Sidecar file is created
    expect.soft(vol.toJSON()).toMatchObject({
      "/home/codex-user/.codex/sessions/2026/04/23/rollout-attachments.jsonl.langsmith":
        expect.stringContaining("019dbc02-53d1-7fc2-8e82-a5419b451d7a"),
    });

    await client.awaitPendingTraceBatches();

    // Assert on trace output
    await expect.soft(getAssumedTreeFromCalls(callSpy.mock.calls, client)).resolves.toMatchObject(
      asTree((run) => {
        run`openai.codex:0`(
          {
            run_type: "chain",
            inputs: {
              messages: expect.arrayContaining([
                {
                  role: "user",
                  content: expect.arrayContaining([
                    { type: "text", text: expect.stringContaining("<image name=[Image #1]>") },
                    {
                      type: "image_url",
                      image_url: expect.stringContaining("data:image/png;base64,"),
                    },
                    { type: "text", text: expect.stringContaining("What's this file about?") },
                  ]),
                },
              ]),
            },
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("OpenAI Codex CLI start screen"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                codex_cli_version: "0.123.0",
                turn_id: "019dbc02-53d1-7fc2-8e82-a5419b451d7a",
                thread_id: "019dbc02-1a14-7f71-9a7e-9b1109e878f1",
                ls_integration: "openai-codex",
                ls_agent_type: "root",
                ls_message_format: "anthropic",
                ls_raw_aggregated_usage: expect.objectContaining({
                  input_tokens: 14243,
                  output_tokens: 262,
                  total_tokens: 14505,
                  input_token_details: expect.objectContaining({
                    cache_read: 3840,
                    cache_creation: 121,
                  }),
                }),
              }),
            },
          },
          run`openai.codex.turn:1`({
            run_type: "llm",
            inputs: {
              messages: expect.arrayContaining([
                {
                  role: "user",
                  content: expect.arrayContaining([
                    {
                      type: "image_url",
                      image_url: expect.stringContaining("data:image/png;base64,"),
                    },
                    { type: "text", text: expect.stringContaining("What's this file about?") },
                  ]),
                },
              ]),
            },
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("OpenAI Codex CLI start screen"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                ls_model_type: "chat",
                ls_provider: "openai",
                ls_model_name: "gpt-5.4",
                ls_invocation_params: expect.objectContaining({
                  model: "gpt-5.4",
                  current_date: "2026-04-23",
                }),
                usage_metadata: expect.objectContaining({
                  input_tokens: 14243,
                  output_tokens: 262,
                  total_tokens: 14505,
                }),
              }),
            },
          }),
        );
      }),
    );
  },
);

it.each([{ makeTurnIncomplete: true }, { makeTurnIncomplete: false }])(
  "subagents %s",
  async ({ makeTurnIncomplete }) => {
    const { client, callSpy } = mockClient();
    vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete }));

    seedFullLaunchEvidence();
    await convertToRunTree(
      {
        transcript_path: path.join(
          "/home/codex-user/.codex/sessions/2026/04/23/rollout-subagents.jsonl",
        ),
        turn_id: "019dbc03-4aa2-72a0-8190-c747168c8f1d",
      },
      { client, projectName: "codex" },
    );

    // Sidecar file is created
    expect(vol.toJSON()).toMatchObject({
      "/home/codex-user/.codex/sessions/2026/04/23/rollout-subagents.jsonl.langsmith":
        expect.stringContaining("019dbc03-4aa2-72a0-8190-c747168c8f1d"),
    });

    await client.awaitPendingTraceBatches();

    // Assert on trace output
    await expect(getAssumedTreeFromCalls(callSpy.mock.calls, client)).resolves.toMatchObject(
      asTree((run) => {
        run`openai.codex:0`(
          {
            run_type: "chain",
            inputs: {
              messages: expect.arrayContaining([
                {
                  role: "user",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Run 2 subagents"),
                    },
                  ]),
                },
              ]),
            },
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("spring roadmap"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                codex_cli_version: "0.123.0",
                turn_id: "019dbc03-4aa2-72a0-8190-c747168c8f1d",
                thread_id: "019dbc02-cc63-7893-9d13-9b24a7db0ace",
                ls_integration: "openai-codex",
                ls_agent_type: "root",
                ls_message_format: "anthropic",
                ls_raw_aggregated_usage: expect.objectContaining({
                  input_tokens: 84553,
                  output_tokens: 1049,
                  total_tokens: 85602,
                  input_token_details: expect.objectContaining({
                    cache_read: 70656,
                    cache_creation: 457,
                  }),
                }),
              }),
            },
          },
          run`openai.codex.turn:1`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Running two subagents in parallel"),
                    },
                    expect.objectContaining({
                      type: "tool_call",
                      name: "spawn_agent",
                      args: expect.objectContaining({
                        fork_context: true,
                        message: expect.stringContaining("Tell one short original joke"),
                      }),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                ls_model_type: "chat",
                ls_provider: "openai",
                ls_model_name: "gpt-5.4",
                usage_metadata: expect.objectContaining({
                  input_tokens: 13244,
                  output_tokens: 473,
                  total_tokens: 13717,
                }),
              }),
            },
          }),
          run`spawn_agent:2`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Full-history forked agents inherit"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`spawn_agent:3`({ run_type: "tool" }),
          run`openai.codex.turn:4`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("retrying without full-history"),
                    },
                    expect.objectContaining({
                      type: "tool_call",
                      name: "spawn_agent",
                      args: expect.objectContaining({
                        message: expect.stringContaining("current date"),
                      }),
                    }),
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 13809,
                  output_tokens: 150,
                  total_tokens: 13959,
                }),
              }),
            },
          }),
          run`spawn_agent:5`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("019dbc03-79de-7d53-8196-3167d9a32762"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`spawn_agent:6`({ run_type: "tool" }),
          run`openai.codex:7`(
            {
              run_type: "chain",
              inputs: {
                messages: expect.arrayContaining([
                  {
                    role: "user",
                    content: expect.arrayContaining([
                      {
                        type: "text",
                        text: expect.stringContaining("Tell one short original joke"),
                      },
                    ]),
                  },
                ]),
              },
              extra: {
                metadata: expect.objectContaining({
                  turn_id: "019dbc03-79eb-73b1-8c5b-f62bd0095409",
                  // Subagent groups under the root thread_id; keeps its own id.
                  thread_id: "019dbc02-cc63-7893-9d13-9b24a7db0ace",
                  ls_agent_type: "subagent",
                  ls_subagent_id: "019dbc03-79de-7d53-8196-3167d9a32762",
                  ls_subagent_type: "Harvey",
                  ls_raw_aggregated_usage: expect.objectContaining({
                    input_tokens: 10744,
                    output_tokens: 20,
                    total_tokens: 10764,
                  }),
                }),
              },
            },
            run`openai.codex.turn:8`({
              run_type: "llm",
              outputs: {
                messages: expect.arrayContaining([
                  {
                    role: "ai",
                    content: expect.arrayContaining([
                      {
                        type: "text",
                        text: expect.stringContaining("bug tracker"),
                      },
                    ]),
                  },
                ]),
              },
              extra: {
                metadata: expect.objectContaining({
                  ls_model_type: "chat",
                  usage_metadata: expect.objectContaining({
                    input_tokens: 10744,
                    output_tokens: 20,
                    total_tokens: 10764,
                  }),
                }),
              },
            }),
          ),
          run`openai.codex:9`(
            {
              run_type: "chain",
              extra: {
                metadata: expect.objectContaining({
                  turn_id: "019dbc03-79fa-7ee0-ad96-27e641f46607",
                  // Subagent groups under the root thread_id; keeps its own id.
                  thread_id: "019dbc02-cc63-7893-9d13-9b24a7db0ace",
                  ls_agent_type: "subagent",
                  ls_subagent_id: "019dbc03-79ee-7ee0-b40b-26920c74c524",
                  ls_subagent_type: "Leibniz",
                  ls_raw_aggregated_usage: expect.objectContaining({
                    input_tokens: 21693,
                    output_tokens: 132,
                    total_tokens: 21825,
                  }),
                }),
              },
            },
            run`openai.codex.turn:10`({
              run_type: "llm",
              outputs: {
                messages: expect.arrayContaining([
                  {
                    role: "ai",
                    content: expect.arrayContaining([
                      expect.objectContaining({
                        type: "tool_call",
                        name: "exec_command",
                        args: expect.objectContaining({
                          cmd: "date '+%A, %B %-d, %Y'",
                        }),
                      }),
                    ]),
                  },
                ]),
              },
              extra: {
                metadata: expect.objectContaining({
                  usage_metadata: expect.objectContaining({
                    input_tokens: 10759,
                    output_tokens: 119,
                    total_tokens: 10878,
                  }),
                }),
              },
            }),
            run`exec_command:11`({
              run_type: "tool",
              outputs: {
                messages: expect.arrayContaining([
                  expect.objectContaining({
                    role: "tool",
                    content: expect.arrayContaining([
                      {
                        type: "text",
                        text: expect.stringContaining("Thursday, April 23, 2026"),
                      },
                    ]),
                  }),
                ]),
              },
            }),
            run`openai.codex.turn:12`({
              run_type: "llm",
              outputs: {
                messages: expect.arrayContaining([
                  {
                    role: "ai",
                    content: expect.arrayContaining([
                      {
                        type: "text",
                        text: expect.stringContaining("Thursday, April 23, 2026"),
                      },
                    ]),
                  },
                ]),
              },
              extra: {
                metadata: expect.objectContaining({
                  usage_metadata: expect.objectContaining({
                    input_tokens: 10934,
                    output_tokens: 13,
                    total_tokens: 10947,
                  }),
                }),
              },
            }),
          ),
          run`openai.codex.turn:13`({
            run_type: "llm",
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14042,
                  output_tokens: 106,
                  total_tokens: 14148,
                }),
              }),
            },
          }),
          run`wait_agent:14`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("bug tracker"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:15`({
            run_type: "llm",
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14271,
                  output_tokens: 88,
                  total_tokens: 14359,
                }),
              }),
            },
          }),
          run`wait_agent:16`({
            run_type: "tool",
            outputs: {
              messages: expect.arrayContaining([
                expect.objectContaining({
                  role: "tool",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("Thursday, April 23, 2026"),
                    },
                  ]),
                }),
              ]),
            },
          }),
          run`openai.codex.turn:17`({
            run_type: "llm",
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14467,
                  output_tokens: 194,
                  total_tokens: 14661,
                }),
              }),
            },
          }),
          run`close_agent:18`({ run_type: "tool" }),
          run`close_agent:19`({ run_type: "tool" }),
          run`openai.codex.turn:20`({
            run_type: "llm",
            outputs: {
              messages: expect.arrayContaining([
                {
                  role: "ai",
                  content: expect.arrayContaining([
                    {
                      type: "text",
                      text: expect.stringContaining("spring roadmap"),
                    },
                  ]),
                },
              ]),
            },
            extra: {
              metadata: expect.objectContaining({
                usage_metadata: expect.objectContaining({
                  input_tokens: 14720,
                  output_tokens: 38,
                  total_tokens: 14758,
                }),
              }),
            },
          }),
        );
      }),
    );
  },
);

it("discovers subagents from current Codex v2 activity items", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete: false, subagentProtocol: "v2" }));

  seedFullLaunchEvidence();
  await convertToRunTree(
    {
      transcript_path: path.join(
        "/home/codex-user/.codex/sessions/2026/04/23/rollout-subagents.jsonl",
      ),
      turn_id: "019dbc03-4aa2-72a0-8190-c747168c8f1d",
    },
    { client, projectName: "codex" },
  );

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const subagentIds = Object.values(tree.data)
    .filter((run) => run.extra?.metadata?.ls_agent_type === "subagent")
    .map((run) => run.extra?.metadata?.ls_subagent_id)
    .filter((id): id is string => typeof id === "string")
    .sort();

  expect(subagentIds).toEqual([
    "019dbc03-79de-7d53-8196-3167d9a32762",
    "019dbc03-79ee-7ee0-b40b-26920c74c524",
  ]);
});

const EDITING_FILE = path.join("/home/codex-user/.codex/sessions/2026/04/23/rollout-editing.jsonl");
const EDITING_TURN = "019dbc00-ede4-77c2-9e7a-b6876efeab9b";
const EARLIER_TURN = "019dbc00-1111-77c2-9e7a-b6876efeab9b";

// A rollout that already holds a completed turn the plugin never traced, as a
// resumed thread or a fork does, followed by the turn this Stop hook fired for.
async function preloadResumedThread() {
  const files = await preloadTestFiles({ makeTurnIncomplete: false });
  files[EDITING_FILE] =
    files[EDITING_FILE].replaceAll(EDITING_TURN, EARLIER_TURN) + files[EDITING_FILE];
  return files;
}

it("traces only the live turn on the first Stop for a resumed rollout", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadResumedThread());

  seedFullLaunchEvidence();
  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: EDITING_TURN }, { client });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const turnIds = Object.values(tree.data)
    .filter((run) => run.name === "openai.codex")
    .map((run) => run.extra?.metadata?.turn_id);

  // The backlog is not replayed...
  expect.soft(turnIds).toEqual([EDITING_TURN]);
  // ...but it is recorded, so the next Stop is an ordinary one.
  expect(vol.toJSON()[`${EDITING_FILE}.langsmith`]).toBe(`${EARLIER_TURN}\n${EDITING_TURN}\n`);
});

it("still traces a backlog turn once the rollout has a traced history", async () => {
  const { client, callSpy } = mockClient();
  const files = await preloadResumedThread();
  files[`${EDITING_FILE}.langsmith`] = "some-earlier-turn\n";
  vol.fromJSON(files);

  seedFullLaunchEvidence();
  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: EDITING_TURN }, { client });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const turnIds = Object.values(tree.data)
    .filter((run) => run.name === "openai.codex")
    .map((run) => run.extra?.metadata?.turn_id);

  expect(turnIds).toEqual([EARLIER_TURN, EDITING_TURN]);
});

it("fills missing root Git fields and attributes structured tools to their repositories", async () => {
  const repoA = await createGitRepository("Author A", "https://github.com/example/repo-a.git");
  const repoB = await createGitRepository("Author B", "https://github.com/example/repo-b.git");
  const nestedRepo = await createGitRepository(
    "Nested Author",
    "https://github.com/example/nested-repo.git",
    path.join(repoA.root, "workspace"),
  );
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const outsideRepo = await fs.mkdtemp(path.join(os.tmpdir(), "codex-trace-outside-"));
  temporaryGitDirectories.push(outsideRepo);
  vol.mkdirSync(outsideRepo, { recursive: true });
  const { client, callSpy } = mockClient();

  const calls = [
    {
      id: "file-a",
      name: "read_file",
      args: { file_path: path.join(repoA.root, "file.txt"), marker: "file-a" },
    },
    { id: "shell-b", name: "exec", args: { cmd: "pwd", marker: "shell-b" } },
    { id: "patch-a", name: "apply_patch", args: { patch: "patch", marker: "patch-a" } },
    {
      id: "ambiguous",
      name: "read_file",
      args: {
        path: path.join(repoA.root, "file.txt"),
        file_path: path.join(repoB.root, "file.txt"),
        marker: "ambiguous",
      },
    },
    {
      id: "target-over-cwd",
      name: "read_file",
      args: {
        cwd: repoA.root,
        file_path: path.join(repoB.root, "file.txt"),
        marker: "target-over-cwd",
      },
    },
    {
      id: "relative-workdir",
      name: "read_file",
      args: { workdir: "workspace", file_path: "child/file.txt", marker: "relative-workdir" },
    },
    {
      id: "unresolved",
      name: "read_file",
      args: { file_path: path.join(outsideRepo, "file.txt"), marker: "unresolved" },
    },
    { id: "opaque", name: "code", args: { code: "readFile(...) ", marker: "opaque" } },
    { id: "opaque-custom-exec", name: "exec", input: "const result = await runCommand()" },
    { id: "custom-patch", name: "exec", input: "apply the patch" },
    { id: "implicit", name: "unknown_tool", args: { marker: "implicit" } },
  ];
  const { turnId } = await writeAttributionRollout({
    sessionCwd: repoA.root,
    sessionMetaCwd: path.join(repoA.root, "workspace"),
    sessionGit: { branch: "captured-root-branch" },
    sessionIdentifier: "provided-root-user",
    calls,
    evidence: {
      "shell-b": { cwd: repoB.root },
      "patch-a": {
        cwd: repoB.root,
        changes: { [path.join(repoA.root, "changed.txt")]: "added" },
      },
      "custom-patch": { changes: { [path.join(repoB.root, "changed.txt")]: "added" } },
    },
  });

  await convertToRunTree(
    { transcript_path: EDITING_FILE, turn_id: turnId },
    {
      client,
      metadata: {
        repository_url: repoA.remote,
        repository_name: "configured/repo-a",
        ls_attribution_identifier: "provided-root-user",
      },
    },
  );
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);
  const rootRun = runs.find((run) => run.name === "openai.codex");
  const metadataFor = (marker: string) => {
    const run = runs.find(
      (item) =>
        item.run_type === "tool" &&
        (item.inputs?.input as Record<string, unknown> | undefined)?.marker === marker,
    );
    expect(run).toBeDefined();
    return run!.extra?.metadata as Record<string, unknown>;
  };
  const metadataForInput = (input: string) => {
    const run = runs.find((item) => item.run_type === "tool" && item.inputs?.input === input);
    expect(run).toBeDefined();
    return run!.extra?.metadata as Record<string, unknown>;
  };

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: repoA.remote,
    repository_name: "configured/repo-a",
    git_branch: "captured-root-branch",
    git_commit_sha: repoA.commit,
    ls_attribution_identifier: "provided-root-user",
  });
  expect(metadataFor("file-a")).toMatchObject({
    repository_url: repoA.remote,
    ls_attribution_identifier: "Author A",
  });
  expect(metadataFor("shell-b")).toMatchObject({
    repository_url: repoB.remote,
    ls_attribution_identifier: "Author B",
  });
  expect(metadataFor("patch-a")).toMatchObject({
    repository_url: repoA.remote,
    ls_attribution_identifier: "Author A",
  });
  expect(metadataFor("target-over-cwd")).toMatchObject({
    repository_url: repoB.remote,
    ls_attribution_identifier: "Author B",
  });
  expect(metadataFor("relative-workdir")).toMatchObject({
    repository_url: nestedRepo.remote,
    ls_attribution_identifier: "Nested Author",
  });
  for (const marker of ["ambiguous", "unresolved", "opaque"]) {
    expect(metadataFor(marker)).not.toHaveProperty("repository_url");
    expect(metadataFor(marker)).not.toHaveProperty("ls_attribution_identifier");
  }
  expect(metadataForInput("const result = await runCommand()")).not.toHaveProperty(
    "repository_url",
  );
  expect(metadataForInput("const result = await runCommand()")).not.toHaveProperty(
    "ls_attribution_identifier",
  );
  expect(metadataForInput("apply the patch")).toMatchObject({
    repository_url: repoB.remote,
    ls_attribution_identifier: "Author B",
  });
  expect(metadataFor("implicit")).toMatchObject({
    repository_url: repoA.remote,
    ls_attribution_identifier: "Author A",
  });
});

it("keeps the turn repository when the session directory moves elsewhere", async () => {
  const repoA = await createGitRepository("Author A", "https://github.com/example/repo-a.git");
  const repoB = await createGitRepository("Author B", "https://github.com/example/repo-b.git");
  await execFileAsync("git", ["remote", "remove", "origin"], { cwd: repoB.root });
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: repoA.root,
    sessionMetaCwd: repoB.root,
    sessionGit: { branch: "captured-repo-b-branch", commit_hash: repoB.commit },
    calls: [{ id: "implicit", name: "unknown_tool", args: { marker: "implicit" } }],
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const attributedRuns = Object.values(tree.data).filter(
    (run) => run.name === "openai.codex" || run.run_type === "tool",
  );

  expect(attributedRuns).toHaveLength(2);
  for (const run of attributedRuns) {
    expect(run.extra?.metadata).toMatchObject({
      repository_url: repoA.remote,
      git_commit_sha: repoA.commit,
      ls_attribution_identifier: "Author A",
    });
    expect(run.extra?.metadata).not.toHaveProperty("git_branch", "captured-repo-b-branch");
  }
});

it("uses the first unambiguous tool in call order when the turn directory is outside Git", async () => {
  const repoA = await createGitRepository("Author A", "https://github.com/example/repo-a.git");
  const repoB = await createGitRepository("Author B", "https://github.com/example/repo-b.git");
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const outsideRepo = await fs.mkdtemp(path.join(os.tmpdir(), "codex-trace-outside-"));
  temporaryGitDirectories.push(outsideRepo);
  vol.mkdirSync(outsideRepo, { recursive: true });
  const { client, callSpy } = mockClient();
  const calls = [
    { id: "first", name: "read_file", args: { file_path: path.join(repoA.root, "file.txt") } },
    { id: "second", name: "read_file", args: { file_path: path.join(repoB.root, "file.txt") } },
  ];
  const { turnId } = await writeAttributionRollout({
    sessionCwd: outsideRepo,
    sessionGit: { branch: "captured-outside-branch" },
    calls,
    completionOrder: ["second", "first"],
    evidence: { first: { cwd: repoA.root }, second: { cwd: repoB.root } },
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: repoA.remote,
    repository_name: "example/repo-a",
    git_branch: "captured-outside-branch",
    ls_attribution_identifier: "Author A",
  });
});

it("fills a missing root author from an attributed tool when the turn repo has no author", async () => {
  const rootRepo = await createGitRepository(undefined, "https://github.com/example/root.git");
  const toolRepo = await createGitRepository("Tool Author", "https://github.com/example/tool.git");
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: rootRepo.root,
    calls: [
      { id: "tool", name: "read_file", args: { file_path: path.join(toolRepo.root, "file.txt") } },
    ],
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: rootRepo.remote,
    ls_attribution_identifier: "Tool Author",
  });
});

it("keeps same-named repositories on separate GitHub hosts separate", async () => {
  const repo = await createGitRepository(
    "Host A Author",
    "https://github.host-a.example/org/project.git",
  );
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: repo.root,
    sessionGit: {
      repository_url: "https://github.host-b.example/org/project.git",
      branch: "host-b-branch",
    },
    calls: [],
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: "https://github.host-b.example/org/project",
    repository_name: "org/project",
    git_branch: "host-b-branch",
  });
  expect(rootRun?.extra?.metadata).not.toHaveProperty("git_commit_sha");
});

it("keeps the full GitLab namespace in repository identity", async () => {
  const repo = await createGitRepository(
    "GitLab Group A Author",
    "https://gitlab.com/group-a/team/project.git",
  );
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: repo.root,
    sessionGit: {
      repository_url: "https://gitlab.com/group-b/team/project.git",
      branch: "group-b-branch",
    },
    calls: [],
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: "https://gitlab.com/group-b/team/project",
    repository_name: "team/project",
    git_branch: "group-b-branch",
  });
  expect(rootRun?.extra?.metadata).not.toHaveProperty("git_commit_sha");
});

it("keeps repositories on separate ports in repository identity", async () => {
  const repo = await createGitRepository(
    "Port A Author",
    "https://gitlab.example.com:8443/org/project.git",
  );
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: repo.root,
    sessionGit: {
      repository_url: "https://gitlab.example.com:9443/org/project.git",
      branch: "port-b-branch",
    },
    calls: [],
  });

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: "https://gitlab.example.com:9443/org/project",
    git_branch: "port-b-branch",
  });
  expect(rootRun?.extra?.metadata).not.toHaveProperty("git_commit_sha");
});

it("preserves configured root repository metadata without mixing in another repository", async () => {
  const configuredRepo = await createGitRepository(
    "Configured Author",
    "https://github.com/example/configured.git",
  );
  const currentRepo = await createGitRepository(
    "Current Author",
    "https://github.com/example/current.git",
  );
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const outsideRepo = await fs.mkdtemp(path.join(os.tmpdir(), "codex-trace-outside-"));
  temporaryGitDirectories.push(outsideRepo);
  vol.mkdirSync(outsideRepo, { recursive: true });
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({
    sessionCwd: outsideRepo,
    calls: [
      {
        id: "current-repo-tool",
        name: "read_file",
        args: { file_path: path.join(currentRepo.root, "file.txt") },
      },
    ],
  });

  await convertToRunTree(
    { transcript_path: EDITING_FILE, turn_id: turnId },
    {
      client,
      metadata: {
        repository_url: configuredRepo.remote,
        repository_name: "provided/configured",
      },
    },
  );
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({
    repository_url: configuredRepo.remote,
    repository_name: "provided/configured",
    ls_attribution_identifier: "Current Author",
  });
  expect(rootRun?.extra?.metadata).not.toHaveProperty("git_branch");
  expect(rootRun?.extra?.metadata).not.toHaveProperty("git_commit_sha");
});

it("uses the GitHub CLI login when a repository has no configured Git author", async () => {
  const repo = await createGitRepository(undefined, "https://github.com/example/no-author.git");
  const { client, callSpy } = mockClient();
  const { turnId } = await writeAttributionRollout({ sessionCwd: repo.root, calls: [] });
  const ghConfig = path.join(repo.root, "gh-config");
  vol.mkdirSync(ghConfig, { recursive: true });
  vol.writeFileSync(
    path.join(ghConfig, "hosts.yml"),
    "ghe.example.com:\n  user: enterprise-login\ngithub.com:\n  user: github-login\n",
  );
  vi.stubEnv("GH_CONFIG_DIR", ghConfig);

  await convertToRunTree({ transcript_path: EDITING_FILE, turn_id: turnId }, { client });
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const rootRun = Object.values(tree.data).find((run) => run.name === "openai.codex");

  expect(rootRun?.extra?.metadata).toMatchObject({ ls_attribution_identifier: "github-login" });
});
