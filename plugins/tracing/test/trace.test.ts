import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "./utils/convert.js";
import { vol } from "memfs";
import type { RunTree } from "langsmith";

import * as path from "node:path";
import { mockClient } from "./utils/mock_client.js";
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

async function traceScaffoldedTurn(extraUserTexts: string[] = []) {
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
    ...extraUserTexts.map((text) => ({ type: "response_item", payload: user(text) })),
    {
      type: "response_item",
      payload: { type: "custom_tool_call", call_id: "c1", name: "exec", input: EXEC_PROGRAM },
    },
    {
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "c1",
        output: [{ type: "input_text", text: "a\nb\n" }],
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
    /environment_context|<skill>|external_codex/,
  );
});

it("keeps a question reply and a hook prompt, which Codex counts as the user's", async () => {
  const reply =
    '<send_user_message_question_reply>\n[{"answer":"yes"}]\n</send_user_message_question_reply>';
  const hook = '<hook_prompt hook_run_id="h1">use staging</hook_prompt>';
  const runs = await traceScaffoldedTurn([reply, hook]);
  const model = runs.find((run) => run.run_type === "llm");

  expect(JSON.stringify(model?.inputs)).toContain("send_user_message_question_reply");
  expect(JSON.stringify(model?.inputs)).toContain("use staging");
});

it("uploads an exec program as an object and keeps its output's line breaks", async () => {
  const runs = await traceScaffoldedTurn();
  const exec = runs.find((run) => run.name === "exec");

  expect(exec?.inputs).toEqual({ input: { input: EXEC_PROGRAM } });
  expect(exec?.outputs?.messages[0].content).toEqual([{ type: "text", text: "a\nb\n" }]);
});
