import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { vol } from "memfs";

import * as path from "node:path";
import { mockClient } from "./utils/mock_client.js";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree.js";

async function preloadTestFiles(options: { makeTurnIncomplete: boolean }) {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

  const sourceDir = path.join(__dirname, "sessions/2026/04/23");
  const targetDir = path.join("/home/codex-user/.codex/sessions/2026/04/23");

  const fileDir = await fs.readdir(sourceDir);

  const testFiles: Record<string, string> = {};

  for (const file of fileDir) {
    if (!file.endsWith(".jsonl")) continue;

    let content = await fs.readFile(path.join(sourceDir, file), "utf-8");

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
                thread_id: "019dbc00-a3c9-7681-8e0c-73139815b4f2",
                ls_integration: "openai-codex",
                ls_agent_type: "root",
                ls_message_format: "anthropic",
                usage_metadata: expect.objectContaining({
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
                usage_metadata: expect.objectContaining({
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
                usage_metadata: expect.objectContaining({
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
                  thread_id: "019dbc03-79de-7d53-8196-3167d9a32762",
                  ls_agent_type: "root",
                  usage_metadata: expect.objectContaining({
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
                  thread_id: "019dbc03-79ee-7ee0-b40b-26920c74c524",
                  ls_agent_type: "root",
                  usage_metadata: expect.objectContaining({
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
