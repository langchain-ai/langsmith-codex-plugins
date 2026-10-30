import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "./utils/convert.js";
import { vol } from "memfs";
import type { RunTree } from "langsmith";

import * as path from "node:path";
import { mockClient } from "./utils/mock_client.js";
import { engineStorageRoot } from "../src/tracing-engine.js";
import { homeDirectory } from "../src/utils/home.js";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree.js";

// Build-time injected plugin version (see vitest.config.ts / tsdown.config.ts).
declare const __LS_INTEGRATION_VERSION__: string;
const INTEGRATION_VERSION = __LS_INTEGRATION_VERSION__;

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
afterEach(() => vi.unstubAllEnvs());

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
                      args: { input: expect.stringContaining("Add File") },
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
                  content: [
                    {
                      type: "image",
                      source_type: "base64",
                      mime_type: "image/png",
                      data: expect.any(String),
                    },
                    { type: "text", text: expect.stringContaining("What's this file about?") },
                  ],
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
                      type: "image",
                      source_type: "base64",
                      mime_type: "image/png",
                      data: expect.any(String),
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

it("keeps subagent activity out of the spawn tool's outputs", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete: false, subagentProtocol: "v2" }));

  seedFullLaunchEvidence();
  await convertToRunTree(
    {
      transcript_path: "/home/codex-user/.codex/sessions/2026/04/23/rollout-subagents.jsonl",
      turn_id: "019dbc03-4aa2-72a0-8190-c747168c8f1d",
    },
    { client, projectName: "codex" },
  );

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const spawns = Object.values(tree.data).filter((run) => run.name === "spawn_agent");

  expect(spawns).not.toHaveLength(0);
  for (const spawn of spawns) expect(spawn.outputs).not.toHaveProperty("agent_thread_id");
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

  expect(turnIds).toEqual([EDITING_TURN]);
});

it("fails the conversion when shared capture fails", async () => {
  vol.fromJSON(await preloadTestFiles({ makeTurnIncomplete: false }));
  seedFullLaunchEvidence();

  await expect(
    convertToRunTree(
      { transcript_path: EDITING_FILE, turn_id: EDITING_TURN },
      {
        captureRun: async () => {
          throw new Error("shared capture failed");
        },
      },
    ),
  ).rejects.toThrow("shared capture failed");
});

it("traces a backlog turn when the whole history is replayed", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadResumedThread());

  seedFullLaunchEvidence();
  await convertToRunTree(
    { transcript_path: EDITING_FILE, turn_id: EDITING_TURN },
    { client, replayHistory: true },
  );
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const turnIds = Object.values(tree.data)
    .filter((run) => run.name === "openai.codex")
    .map((run) => run.extra?.metadata?.turn_id);

  expect(turnIds).toEqual([EARLIER_TURN, EDITING_TURN]);
});

it("traces a turn once when the rollout repeats it", async () => {
  const files = await preloadTestFiles({ makeTurnIncomplete: false });
  files[EDITING_FILE] += files[EDITING_FILE];
  vol.fromJSON(files);
  seedFullLaunchEvidence();
  const roots: string[] = [];

  await convertToRunTree(
    { transcript_path: EDITING_FILE, turn_id: EDITING_TURN },
    {
      captureRun: async (run) => {
        if (run.name === "openai.codex") roots.push(run.id);
      },
    },
  );

  expect(roots).toHaveLength(1);
});

const CURRENT_CODEX_FILE = "/home/codex-user/.codex/sessions/2026/10/16/rollout-codex-0162.jsonl";
const CURRENT_CODEX_TURN = "01a142f4-b6d5-7770-ad03-44e116aea04b";

async function traceCurrentCodexExec(
  reshape: (item: Record<string, unknown>) => Record<string, unknown> = (item) => item,
  timestamp?: string,
) {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const source = path.join(__dirname, "sessions/2026/10/16/rollout-codex-0162.jsonl");
  const lines = (await fs.readFile(source, "utf-8"))
    .trim()
    .split("\n")
    .map((line) => {
      const event = JSON.parse(line);
      if (event.payload.item?.id === "call_s2") {
        event.payload.item = reshape(event.payload.item);
        event.timestamp = timestamp ?? event.timestamp;
      }
      return JSON.stringify(event);
    });
  lines.push(
    JSON.stringify({
      timestamp: "2026-10-16T04:24:58.400Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "done" }],
      },
    }),
    JSON.stringify({
      timestamp: "2026-10-16T04:24:58.500Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: CURRENT_CODEX_TURN },
    }),
  );
  vol.fromJSON({ [CURRENT_CODEX_FILE]: lines.join("\n") + "\n" });
  seedFullLaunchEvidence();
  const runs: RunTree[] = [];

  await convertToRunTree(
    { transcript_path: CURRENT_CODEX_FILE, turn_id: CURRENT_CODEX_TURN },
    { captureRun: async (run) => void runs.push(run) },
  );

  return runs.find((run) => run.name === "exec_command");
}

it("ends a current Codex tool at its completion event", async () => {
  const finishedAt = "2026-10-16T04:24:58.000Z";
  const exec = await traceCurrentCodexExec(undefined, finishedAt);

  expect(exec?.end_time).toBe(Date.parse(finishedAt));
});

it("keeps a current Codex exec's details in its outputs", async () => {
  const exec = await traceCurrentCodexExec();

  expect(Object.keys(exec?.outputs ?? {}).sort()).toEqual([
    "aggregated_output",
    "command",
    "cwd",
    "duration",
    "exit_code",
    "messages",
    "parsed_cmd",
    "process_id",
    "source",
    "status",
  ]);
});

it.each([
  { case: "a failed exec", item: {}, error: "bad\n" },
  {
    case: "a passing exec",
    item: { status: "completed", aggregated_output: "ok\n", exit_code: 0 },
    error: undefined,
  },
  {
    case: "a declined exec",
    item: { status: "declined", aggregated_output: "rejected by user", exit_code: -1 },
    error: "rejected by user",
  },
  {
    case: "a failed patch",
    item: { type: "FileChange", changes: {}, status: "failed", stdout: "", stderr: "no match" },
    error: "no match",
  },
  {
    case: "an MCP tool that reports an error",
    item: {
      type: "McpToolCall",
      server: "t",
      tool: "bad",
      arguments: {},
      status: "failed",
      result: {
        content: [
          { type: "image", data: "", mimeType: "image/png" },
          { type: "text", text: "bad input" },
        ],
        isError: true,
      },
    },
    error: "bad input",
  },
  {
    case: "an MCP call that errors",
    item: {
      type: "McpToolCall",
      server: "t",
      tool: "boom",
      arguments: {},
      status: "failed",
      error: { message: "Mcp error: -32000: boom" },
    },
    error: "Mcp error: -32000: boom",
  },
  {
    case: "a failed MCP call with no text",
    item: {
      type: "McpToolCall",
      server: "t",
      tool: "quiet",
      arguments: {},
      status: "failed",
      result: { content: [], isError: true },
    },
    error: "Tool failed",
  },
  {
    case: "a failed dynamic tool with no text",
    item: {
      type: "DynamicToolCall",
      tool: "lookup",
      arguments: {},
      status: "failed",
      content_items: [],
      success: false,
    },
    error: "Tool failed",
  },
])("traces the error of $case on a current Codex transcript", async ({ item, error }) => {
  const exec = await traceCurrentCodexExec((original) =>
    "type" in item ? { id: original.id, ...item } : { ...original, ...item },
  );

  expect(exec?.error).toBe(error);
});

const SCAFFOLDING_FILE = "/home/codex-user/.codex/sessions/2026/10/24/rollout-scaffolding.jsonl";
const SCAFFOLDING_TURN = "019900aa-tttt-0112";
const EXEC_PROGRAM = 'text(await tools.exec_command({cmd:"ls"}));';

async function traceScaffoldedTurn(extraItems: (string | Record<string, unknown>)[] = []) {
  const user = (...texts: string[]) => ({
    type: "message",
    role: "user",
    content: texts.map((text) => ({ type: "input_text", text })),
  });
  const items = [
    { type: "event_msg", payload: { type: "task_started", turn_id: SCAFFOLDING_TURN } },
    {
      type: "response_item",
      payload: user("<environment_context>\n  <cwd>/w</cwd>\n</environment_context>"),
    },
    {
      type: "response_item",
      payload: { type: "additional_tools", role: "developer", tools: [{ name: "exec" }] },
    },
    { type: "turn_context", payload: { turn_id: SCAFFOLDING_TURN, cwd: "/w", model: "m" } },
    {
      type: "response_item",
      payload: user("<environment_context><shell>zsh</shell></environment_context>"),
    },
    {
      type: "response_item",
      payload: user("Fix the bug", "<skill>\n<name>fixer</name>\n# Fixer\n</skill>"),
    },
    {
      type: "response_item",
      payload: user("<external_codex_apps_open_page>/a</external_codex_apps_open_page>"),
    },
    ...extraItems.map((item) => ({
      type: "response_item",
      payload: typeof item === "string" ? user(item) : item,
    })),
    {
      type: "response_item",
      payload: { type: "custom_tool_call", call_id: "c1", name: "exec", input: EXEC_PROGRAM },
    },
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "c1",
        output: [
          {
            type: "input_text",
            text: JSON.stringify({
              chunk_id: "c0",
              wall_time_seconds: 0.1,
              exit_code: 0,
              original_token_count: 2,
              output: "a\nb\n",
            }),
          },
        ],
      },
    },
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "ok" }],
      },
    },
    { type: "event_msg", payload: { type: "task_complete", turn_id: SCAFFOLDING_TURN } },
  ];
  const session = {
    timestamp: "2026-10-24T00:00:00.000Z",
    type: "session_meta",
    payload: {
      id: "019900aa-0000-7000-8000-scaffolding",
      timestamp: "2026-10-24T00:00:00.000Z",
      cwd: "/w",
      originator: "codex_exec",
      cli_version: "0.160.0",
      source: "exec",
    },
  };
  const lines = [
    session,
    ...items.map((item, i) => ({
      timestamp: `2026-10-24T00:00:${String(i + 1).padStart(2, "0")}.000Z`,
      ...item,
    })),
  ];
  vol.fromJSON({ [SCAFFOLDING_FILE]: lines.map((line) => JSON.stringify(line)).join("\n") + "\n" });
  seedFullLaunchEvidence();
  const runs: RunTree[] = [];

  await convertToRunTree(
    { transcript_path: SCAFFOLDING_FILE, turn_id: SCAFFOLDING_TURN },
    { captureRun: async (run) => void runs.push(run) },
  );

  return runs;
}

it("keeps Codex scaffolding out of the user message and model inputs", async () => {
  const runs = await traceScaffoldedTurn();
  const turn = runs.find((run) => run.name === "openai.codex");

  expect(turn?.inputs).toEqual({
    messages: [{ role: "user", content: [{ type: "text", text: "Fix the bug" }] }],
  });
  expect(JSON.stringify(runs.map((run) => run.inputs))).not.toMatch(
    /environment_context|<skill>|external_codex|additional_tools/,
  );
});

const BAD_REPLY =
  "<send_user_message_question_reply>\nnot json\n</send_user_message_question_reply>";

it.each([
  {
    what: "a question reply as the question and answer",
    text: '<send_user_message_question_reply>\n[{"answer":"yes, staging","question":"Deploy where?","questionItemId":"q1"}]\n</send_user_message_question_reply>',
    shown: "> Deploy where?\n\nyes, staging",
  },
  {
    what: "a hook prompt as its text",
    text: '<hook_prompt hook_run_id="h1">run lint &amp; test</hook_prompt>',
    shown: "run lint & test",
  },
  {
    what: "a realtime handoff as its input",
    text: "<realtime_delegation>\n  <input>Book the room &amp; desk</input>\n</realtime_delegation>",
    shown: "Book the room & desk",
  },
  { what: "a question reply it cannot read as it arrived", text: BAD_REPLY, shown: BAD_REPLY },
])("shows $what, since Codex counts it as the user's", async ({ text, shown }) => {
  const runs = await traceScaffoldedTurn([text]);
  const model = runs.find((run) => run.run_type === "llm");
  const texts = model?.inputs.messages.flatMap((message: { content: { text?: string }[] }) =>
    message.content.map((part) => part.text),
  );

  expect(texts).toContain(shown);
});

it("uploads an exec program as an object and keeps its output's line breaks", async () => {
  const runs = await traceScaffoldedTurn();
  const exec = runs.find((run) => run.name === "exec");

  expect(exec?.inputs).toEqual({ input: { input: EXEC_PROGRAM } });
  expect(exec?.outputs?.messages[0].content).toEqual([{ type: "text", text: "a\nb\n" }]);
});

it("keeps every field of a tool result that is not Codex's shell output", async () => {
  const result = JSON.stringify({ output: "report", warnings: ["stale"] });
  const runs = await traceScaffoldedTurn([
    { type: "function_call", call_id: "f1", name: "report", arguments: "{}" },
    { type: "function_call_output", call_id: "f1", output: result },
  ]);
  const tool = runs.find((run) => run.name === "report");

  expect(tool?.outputs?.messages[0].content).toEqual([{ type: "text", text: result }]);
});

it("shows a failed shell command's exit code under its output", async () => {
  const runs = await traceScaffoldedTurn([
    { type: "function_call", call_id: "f1", name: "shell", arguments: "{}" },
    {
      type: "function_call_output",
      call_id: "f1",
      output: JSON.stringify({ output: "no such file\n", metadata: { exit_code: 2 } }),
    },
  ]);
  const tool = runs.find((run) => run.name === "shell");

  expect(tool?.outputs?.messages[0].content).toEqual([
    { type: "text", text: "no such file\n\nExit code: 2" },
  ]);
});

it("shows Codex's hosted tools and agent messages as conversation", async () => {
  const runs = await traceScaffoldedTurn([
    { type: "local_shell_call", call_id: "ls1", status: "completed", action: { command: ["ls"] } },
    {
      type: "function_call_output",
      call_id: "ls1",
      output: JSON.stringify({ output: "a.txt\n", metadata: { exit_code: 0 } }),
    },
    { type: "web_search_call", id: "ws1", status: "completed", action: { query: "codex" } },
    {
      type: "image_generation_call",
      id: "ig1",
      status: "completed",
      revised_prompt: "a cat",
      result: "",
    },
    { type: "tool_search_call", call_id: "ts1", execution: "client", arguments: { query: "gh" } },
    {
      type: "tool_search_output",
      call_id: "ts1",
      status: "completed",
      execution: "client",
      tools: [{ name: "get_issue" }],
    },
    {
      type: "agent_message",
      author: "/root/worker",
      recipient: "/root",
      content: [{ type: "input_text", text: "3 files" }],
    },
    {
      type: "agent_message",
      author: "/root/worker",
      recipient: "/root",
      content: [{ type: "encrypted_content", encrypted_content: "gAAAA" }],
    },
  ]);
  const turn = runs.find((run) => run.name === "openai.codex");
  const call = (name: string, id: string, args: unknown) => ({ type: "tool_call", name, id, args });

  expect(turn?.outputs?.messages.slice(0, 5)).toEqual([
    { role: "ai", content: [call("local_shell_call", "ls1", { command: ["ls"] })] },
    { role: "tool", content: [{ type: "text", text: "a.txt\n" }], tool_call_id: "ls1" },
    {
      role: "ai",
      content: [
        call("web_search_call", "ws1", { query: "codex" }),
        call("image_generation_call", "ig1", { revised_prompt: "a cat" }),
        call("tool_search_call", "ts1", { query: "gh" }),
      ],
    },
    {
      role: "tool",
      content: [{ type: "text", text: '[\n  {\n    "name": "get_issue"\n  }\n]' }],
      tool_call_id: "ts1",
    },
    { role: "user", content: [{ type: "text", text: "3 files" }] },
  ]);
});

const BARE_FILE = "/home/codex-user/.codex/sessions/2026/10/27/rollout-bare.jsonl";
const BARE_TURN = "019900bb-tttt-0112";
const SHELL_COMMAND =
  "<user_shell_command>\n<command>\nls\n</command>\n<result>\nExit code: 0\nOutput:\na.txt\n</result>\n</user_shell_command>";
const REVIEW_RESULT =
  "<user_action>\n  <context>User initiated a review task.</context>\n  <action>review</action>\n  <results>\n  None.\n  </results>\n</user_action>";

const asked = (text: string) => ({
  messages: [{ role: "user", content: [{ type: "text", text }] }],
});
const said = (role: string, type: string, text: string) => ({
  type: "message",
  role,
  content: [{ type, text }],
});

it.each([
  {
    what: "a shell command the user ran",
    items: [said("user", "input_text", SHELL_COMMAND)],
    runs: [[asked("ls\n\nExit code: 0\nOutput:\na.txt"), { messages: [] }]],
  },
  {
    what: "a review",
    items: [
      said("user", "input_text", REVIEW_RESULT),
      said("assistant", "output_text", "No findings."),
    ],
    runs: [
      [
        asked("/review"),
        { messages: [{ role: "ai", content: [{ type: "text", text: "No findings." }] }] },
      ],
    ],
  },
  {
    what: "a prompt stopped while the model was thinking",
    items: [
      said("user", "input_text", "Plan it"),
      { type: "reasoning", summary: [], encrypted_content: "gAAAA" },
    ],
    runs: [[asked("Plan it"), { messages: [] }]],
  },
  {
    what: "a task another agent sent",
    items: [
      { turn_context: { turn_id: BARE_TURN, cwd: "/w", model: "m" } },
      {
        type: "agent_message",
        author: "/root",
        recipient: "/root/worker",
        content: [
          { type: "input_text", text: "Count files" },
          { type: "encrypted_content", encrypted_content: "gAAAA" },
        ],
      },
    ],
    runs: [[asked("Count files"), { messages: [] }]],
  },
  {
    what: "a turn that failed before any message",
    items: [{ event_msg: { type: "turn_aborted", turn_id: BARE_TURN, reason: "interrupted" } }],
    runs: [[{ messages: [] }, { messages: [] }]],
  },
  {
    what: "a turn that only started a subagent",
    items: [{ event_msg: { type: "sub_agent_activity", kind: "started", agent_thread_id: "a1" } }],
    runs: [[{ messages: [] }, { messages: [] }]],
  },
  {
    what: "a turn that only set Codex up",
    items: [said("developer", "input_text", "<permissions instructions>")],
    runs: [],
  },
])("traces $what without a model call", async (turn) => {
  const lines = [
    {
      type: "session_meta",
      payload: {
        id: "019900bb-0000-7000-8000-bare",
        cwd: "/w",
        cli_version: "0.164.0",
        source: "cli",
      },
    },
    { type: "event_msg", payload: { type: "task_started", turn_id: BARE_TURN } },
    ...turn.items.map((payload) =>
      "turn_context" in payload
        ? { type: "turn_context", payload: payload.turn_context }
        : "event_msg" in payload
          ? { type: "event_msg", payload: payload.event_msg }
          : { type: "response_item", payload },
    ),
    { type: "event_msg", payload: { type: "task_complete", turn_id: BARE_TURN } },
  ].map((line, i) => JSON.stringify({ timestamp: `2026-10-27T00:00:0${i}.000Z`, ...line }));
  vol.fromJSON({ [BARE_FILE]: lines.join("\n") + "\n" });
  seedFullLaunchEvidence();
  const runs: RunTree[] = [];

  await convertToRunTree(
    { transcript_path: BARE_FILE, turn_id: BARE_TURN },
    { captureRun: async (run) => void runs.push(run) },
  );

  expect(runs.map((run) => [run.inputs, run.outputs])).toEqual(turn.runs);
});

it("reports a later turn's own usage, not the session's running total", async () => {
  const usage = (input: number, output: number) => ({
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    cached_input_tokens: 0,
    reasoning_output_tokens: 0,
  });
  const turn = (id: string, text: string, total: ReturnType<typeof usage>) => [
    { type: "event_msg", payload: { type: "task_started", turn_id: id } },
    { type: "turn_context", payload: { turn_id: id, cwd: "/w", model: "m" } },
    {
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    },
    {
      type: "response_item",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text }] },
    },
    {
      type: "event_msg",
      payload: {
        type: "token_count",
        info: { total_token_usage: total, last_token_usage: total, model_context_window: 1 },
      },
    },
    { type: "event_msg", payload: { type: "task_complete", turn_id: id } },
  ];
  const lines = [
    {
      type: "session_meta",
      payload: { id: "019900bb-0000-7000-8000-bare", cwd: "/w", cli_version: "0.164.0" },
    },
    ...turn("turn-1", "first", usage(100, 10)),
    ...turn(BARE_TURN, "second", usage(250, 30)),
  ].map((line, i) => JSON.stringify({ timestamp: `2026-10-27T00:00:${10 + i}.000Z`, ...line }));
  vol.fromJSON({ [BARE_FILE]: lines.join("\n") + "\n" });
  seedFullLaunchEvidence();
  const runs: RunTree[] = [];

  await convertToRunTree(
    { transcript_path: BARE_FILE, turn_id: BARE_TURN },
    { captureRun: async (run) => void runs.push(run) },
  );

  expect(runs[0].metadata?.ls_raw_aggregated_usage).toMatchObject({
    input_tokens: 150,
    output_tokens: 20,
    total_tokens: 170,
  });
});

const HOOK_FILE = "/home/codex-user/.codex/sessions/2026/10/28/rollout-hooks.jsonl";
const HOOK_SESSION = "019a0000-0000-7000-8000-hooks0000000";
const firingsFile = (session: string, turn: string) =>
  path.join(engineStorageRoot(homeDirectory()), `hook-firings-${session}-${turn}.jsonl`);
const HOOK_START = Date.parse("2026-10-28T00:00:00.000Z");
const item = (payload: object) => ({ type: "response_item", payload });
const say = (role: string, text: string) =>
  item({ type: "message", role, content: [{ type: "input_text", text }] });
const ctx = (text: string | string[], created?: number) =>
  item({
    type: "message",
    role: "developer",
    content: [text].flat().map((part) => ({ type: "input_text", text: part })),
    internal_chat_message_metadata_passthrough: {
      content_item_kinds: ["hooks.additional_context"],
      create_time: created,
    },
  });
const call = (call_id: string, created?: number) =>
  item({
    type: "custom_tool_call",
    status: "completed",
    call_id,
    name: `tool_${call_id}`,
    input: "text(1);\n",
    internal_chat_message_metadata_passthrough: { create_time: created },
  });
const out = (call_id: string) =>
  item({ type: "custom_tool_call_output", call_id, output: [{ type: "input_text", text: "ok" }] });
const event = (payload: object) => ({ type: "event_msg", payload });
const done = (id: string) =>
  event({ type: "item_completed", item: { type: "CommandExecution", id } });
const start = (turn_id: string) => [
  event({ type: "task_started", turn_id }),
  { type: "turn_context", payload: { turn_id, cwd: "/w", model: "m" } },
];
const end = event({ type: "task_complete" });
const fire = (event: string, tool_use_id?: string, turn_id: string | null = null) => ({
  firing: { event, tool_use_id, turn_id },
});
const pre = (id: string) => fire("PreToolUse", id);
const begin = (call_id: string) => event({ type: "exec_command_begin", call_id });
const usage = event({ type: "token_count", info: { last_token_usage: { input_tokens: 5 } } });
const fn = (call_id: string) =>
  item({ type: "function_call", name: call_id, arguments: "{", call_id });
const fnOut = (call_id: string) => item({ type: "function_call_output", call_id, output: "ok" });
const post = (id: string) => fire("PostToolUse", id);
const at = (second: number) => HOOK_START / 1000 + second;

async function placeHooks(rollout: string, firings: string, captureHookOutputs: boolean) {
  vol.reset();
  const session_id = JSON.parse(rollout.split("\n")[0]).payload.id;
  vol.fromJSON({ [HOOK_FILE]: rollout, [firingsFile(session_id, "recorded")]: firings });
  seedFullLaunchEvidence();
  const runs: RunTree[] = [];
  let count = 0;
  await convertToRunTree(
    { transcript_path: HOOK_FILE, turn_id: null, session_id },
    {
      replayHistory: true,
      captureHookOutputs,
      captureRun: async (run) => void runs.push(run),
      nextRunId: () => `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}`,
      toolRunId: (callId) => `tool:${callId}`,
    },
  );
  const roots = runs.filter(({ run_type }) => run_type === "chain");
  const placed = runs.flatMap((run) =>
    (["inputs", "outputs"] as const).flatMap((field) =>
      (run[field]?.hooks ?? []).map(({ name, output }: { name: string; output: string }) => {
        const where = roots.includes(run) ? `turn ${roots.indexOf(run) + 1}` : run.name;
        return `${output.replace(/exec-[\w-]+/, "exec")}: ${name} on ${where} ${field}`;
      }),
    ),
  );
  const modelCalls = runs
    .filter(({ run_type }) => run_type === "llm")
    .map(({ id, inputs, outputs, extra }) => [id, inputs, outputs, extra?.metadata]);
  const tools = runs.filter(({ run_type }) => run_type === "tool").map(({ name }) => name);
  return { placed, modelCalls, tools, runs, ids: runs.map(({ id }) => id) };
}

async function expectPlaced(rollout: string, firings: string, expected: string[]) {
  const on = await placeHooks(rollout, firings, true);
  const off = await placeHooks(rollout, firings, false);
  expect(on.placed).toEqual(expected);
  expect(off.placed).toEqual([]);
  const hookTexts = new Set(
    on.runs.flatMap((run) =>
      [...(run.inputs?.hooks ?? []), ...(run.outputs?.hooks ?? [])].flatMap(({ output }) =>
        output.split("\n"),
      ),
    ),
  );
  const shown = (messages: { role: string; content: { text?: string }[] }[]) =>
    messages.flatMap((message) => {
      if (message.role !== "system") return [message];
      const content = message.content.filter(({ text }) => !hookTexts.has(text));
      return content.length === 0 ? [] : [{ ...message, content }];
    });
  expect(on.modelCalls).toEqual(
    off.modelCalls.map(([id, inputs, ...rest]) => [
      id,
      { ...inputs, messages: shown(inputs.messages) },
      ...rest,
    ]),
  );
}

it.each([
  [
    "finds a call made before a hook, and keeps a hook two calls could own on the turn",
    [call("a"), pre("a"), ctx("1"), call("b"), post("a"), post("b"), ctx("2"), out("a"), out("b")],
    ["2: PostToolUse on turn 1 outputs", "1: PreToolUse on tool_a inputs"],
  ],
  [
    "puts hooks from two execs of one call on that call",
    [call("c"), pre("x1"), pre("x2"), ctx("1"), done("x1"), done("x2"), out("c"), usage],
    ["1: PreToolUse on tool_c inputs"],
  ],
  [
    "keeps an exec hook on the turn when several calls were open as it ran",
    [call("c1"), call("c2"), pre("x9"), ctx("1"), done("x9"), out("c1"), out("c2")],
    ["1: PreToolUse on turn 1 inputs"],
  ],
  [
    "puts an exec hook on the one call open when the exec last reported",
    [call("d"), call("e"), pre("x7"), ctx("1"), begin("x7"), out("e"), done("x7"), out("d")],
    ["1: PreToolUse on tool_d inputs"],
  ],
  [
    "names a hook Hook once the model replied or reasoned after its firing",
    [
      fire("SubagentStart", "a"),
      ctx(["child", "started"]),
      call("a"),
      post("a"),
      say("assistant", "hm"),
      ctx("after a reply"),
      out("a"),
      post("a"),
      item({ type: "reasoning", summary: [] }),
      ctx("after reasoning"),
    ],
    [
      "child\nstarted: SubagentStart on turn 1 inputs",
      "after a reply: Hook on turn 1 inputs",
      "after reasoning: Hook on turn 1 inputs",
    ],
  ],
  [
    "names a hook by when Codex made it and the model items before it, not when they were written",
    [pre("w"), call("w", at(3.2)), ctx("1"), post("w"), done("z"), ctx("2", at(4.8)), out("w")],
    ["1: PreToolUse on tool_w inputs", "2: PreToolUse on tool_w inputs"],
  ],
  [
    "keeps a tool hook on the turn when its call never becomes a tool run",
    [fn("x"), post("x"), ctx("1"), pre("x5"), ctx("2"), done("x5"), fnOut("x")],
    ["2: PreToolUse on turn 1 inputs", "1: PostToolUse on turn 1 outputs"],
  ],
  [
    "names a hook by firings of its own turn",
    [
      call("a"),
      out("a"),
      fire("PostToolUse", "a", "turn-1"),
      fire("SessionStart"),
      end,
      ctx("between"),
      ...start("turn-2"),
      say("user", "again"),
      ctx("late"),
    ],
    ["between: SessionStart on turn 2 inputs", "late: Hook on turn 2 inputs"],
  ],
] as [string, object[], string[]][])("%s", async (_, lines, expected) => {
  const { rollout, firings } = hookRollout(lines);
  await expectPlaced(rollout, firings, expected);
});

function hookRollout(lines: object[]) {
  const rows: string[] = [];
  const firings: string[] = [];
  const session = { id: HOOK_SESSION, cwd: "/w", cli_version: "0.163.0" };
  const turn = [...start("turn-1"), say("user", "go"), ...lines, say("assistant", "done"), end];
  for (const line of [{ type: "session_meta", payload: session }, ...turn]) {
    const time = HOOK_START + rows.length * 1000;
    if ("firing" in line)
      firings.push(JSON.stringify({ ...(line.firing as object), time: time - 500 }));
    else rows.push(JSON.stringify({ timestamp: new Date(time).toISOString(), ...line }));
  }
  return { rollout: rows.join("\n") + "\n", firings: firings.toReversed().join("\n") };
}

it("keeps main's tool runs when hook capture is off and adds the skipped ones when on", async () => {
  const { rollout, firings } = hookRollout([call("a"), ctx("1"), call("b"), out("a"), out("b")]);
  expect((await placeHooks(rollout, firings, false)).tools).toEqual(["tool_b"]);
  expect((await placeHooks(rollout, firings, true)).tools).toEqual(["tool_b", "tool_a"]);
});

it("keeps an interrupted turn's hooks and tools on that turn when hook capture is on", async () => {
  const lines = [call("a"), pre("a"), ctx("1"), out("a"), ...start("turn-2"), say("user", "again")];
  const { rollout, firings } = hookRollout(lines);

  expect((await placeHooks(rollout, firings, false)).modelCalls).toHaveLength(1);
  const on = await placeHooks(rollout, firings, true);
  expect(on.placed).toEqual(["1: PreToolUse on tool_a inputs"]);
  expect(on.tools).toEqual(["tool_a"]);
});

it("gives every late run of every turn its own id", async () => {
  const input = 'text(await tools.exec_command({cmd:"cat /h/skills/foo/SKILL.md"}));';
  const read = (call_id: string) =>
    item({ type: "custom_tool_call", status: "completed", call_id, name: "exec", input });
  const lines = [read("s1"), ctx("1"), out("s1"), end, ...start("turn-2"), say("user", "again")];
  const { rollout, firings } = hookRollout([...lines, read("s2"), ctx("2"), out("s2")]);

  const { ids, tools } = await placeHooks(rollout, firings, true);
  expect(tools).toEqual(["exec", "Skill", "exec", "Skill"]);
  expect(new Set(ids).size).toBe(ids.length);
});

it("deletes a turn's hook firings once it posts and keeps another turn's", async () => {
  const { rollout } = hookRollout([end, ...start("turn-2"), say("user", "again")]);
  const files = ["turn-1", "turn-2"].map((turn) => firingsFile(HOOK_SESSION, turn));
  vol.reset();
  vol.fromJSON({ [HOOK_FILE]: rollout, [files[0]]: "", [files[1]]: "" });
  seedFullLaunchEvidence();

  await convertToRunTree(
    { transcript_path: HOOK_FILE, turn_id: "turn-2", session_id: HOOK_SESSION },
    { captureHookOutputs: true, captureRun: async () => undefined },
  );

  expect(files.map((file) => vol.existsSync(file))).toEqual([true, false]);
});

it("shows a real Codex run's hook text only under hooks when hook capture is on", async () => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const source = path.join(__dirname, "sessions/2026/10/28/rollout-hook-firings-seq.jsonl");
  const rollout = await fs.readFile(source, "utf8");
  const firings = await fs.readFile(
    path.join(path.dirname(source), "hook-firings-seq.jsonl"),
    "utf8",
  );
  const outsideHooks = (runs: RunTree[]) =>
    runs.filter((run) =>
      JSON.stringify([
        { ...run.inputs, hooks: [] },
        { ...run.outputs, hooks: [] },
      ]).includes("CTX|"),
    ).length;

  expect(outsideHooks((await placeHooks(rollout, firings, false)).runs)).toBeGreaterThan(0);
  expect(outsideHooks((await placeHooks(rollout, firings, true)).runs)).toBe(0);
});

it("names and places each hook of a real Codex run by the firing it recorded", async () => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const source = path.join(__dirname, "sessions/2026/10/28/rollout-hook-firings-seq.jsonl");

  const rollout = await fs.readFile(source, "utf8");
  const firings = await fs.readFile(
    path.join(path.dirname(source), "hook-firings-seq.jsonl"),
    "utf8",
  );

  expect((await placeHooks(rollout, firings, false)).tools).toEqual([]);
  await expectPlaced(rollout, firings, [
    "CTX|sync|SessionStart|-: SessionStart on turn 1 inputs",
    "CTX|sync|UserPromptSubmit|-: UserPromptSubmit on turn 1 inputs",
    "CTX|bg|PostToolUse|exec: Hook on turn 1 inputs",
    "CTX|bg|PostToolUse|exec: Hook on turn 1 inputs",
    "CTX|sync|PreToolUse|exec: PreToolUse on exec inputs",
    "CTX|sync|PostToolUse|exec: PostToolUse on exec outputs",
    "CTX|sync|PreToolUse|exec: PreToolUse on exec inputs",
    "CTX|sync|PostToolUse|exec: PostToolUse on exec outputs",
  ]);
});
