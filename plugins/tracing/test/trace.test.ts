import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { vol } from "memfs";

import * as path from "node:path";
import { mockClient } from "./utils/mock_client.js";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree.js";

function withoutEventRuns(tree: {
  nodes: string[];
  edges: Array<[string, string]>;
  data: Record<string, unknown>;
}) {
  const isEventNode = (id: string) => id.startsWith("event.");
  return {
    nodes: tree.nodes.filter((id) => !isEventNode(id)),
    edges: tree.edges.filter(([source, target]) => !isEventNode(source) && !isEventNode(target)),
    data: Object.fromEntries(Object.entries(tree.data).filter(([id]) => !isEventNode(id))),
  };
}

function renumberRuns(tree: {
  nodes: string[];
  edges: Array<[string, string]>;
  data: Record<string, unknown>;
}) {
  const counts = new Map<string, number>();
  const idMap = new Map<string, string>();
  const nextId = (id: string) => {
    const name = id.split(":")[0];
    const nextCount = counts.get(name) ?? 0;
    counts.set(name, nextCount + 1);
    const normalized = `${name}:${nextCount}`;
    idMap.set(id, normalized);
    return normalized;
  };

  const nodes = tree.nodes.map(nextId);
  const edges = tree.edges.map(([source, target]) => [
    idMap.get(source) ?? nextId(source),
    idMap.get(target) ?? nextId(target),
  ]) as Array<[string, string]>;

  const data = Object.fromEntries(
    Object.entries(tree.data).map(([id, value]) => [idMap.get(id) ?? nextId(id), value]),
  );

  return { nodes, edges, data };
}

async function preloadTestFiles() {
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
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  expect(renumberRuns(withoutEventRuns(tree))).toMatchObject(
    renumberRuns(
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
            }),
          },
        }),
      );
      }),
    ),
  );
});

it("attachments", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadTestFiles());

  await convertToRunTree(
    path.join("/home/codex-user/.codex/sessions/2026/04/23/rollout-attachments.jsonl"),
    { client, projectName: "codex" },
  );
  // Sidecar file is created
  expect(vol.toJSON()).toMatchObject({
    "/home/codex-user/.codex/sessions/2026/04/23/rollout-attachments.jsonl.langsmith":
      expect.stringContaining("019dbc02-53d1-7fc2-8e82-a5419b451d7a"),
  });

  await client.awaitPendingTraceBatches();

  // Assert on trace output
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  expect(renumberRuns(withoutEventRuns(tree))).toMatchObject(
    renumberRuns(
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
            }),
          },
        }),
      );
      }),
    ),
  );
});

it("subagents", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadTestFiles());

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
  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  expect(renumberRuns(withoutEventRuns(tree))).toMatchObject(
    renumberRuns(
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
          },
        }),
      );
      }),
    ),
  );
});

it("skill events", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath = "/home/codex-user/.codex/sessions/2026/06/11/rollout-skill-events.jsonl";
  const lines = [
    {
      timestamp: "2026-06-11T06:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "thread-skill",
        timestamp: "2026-06-11T06:00:00.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.100Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-skill" },
    },
    {
      timestamp: "2026-06-11T06:00:00.150Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.200Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "run skill" }],
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.300Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Invoking skill." }],
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.350Z",
      type: "response_item",
      payload: {
        type: "function_call",
        namespace: "skill",
        name: "search_scene_example",
        arguments: JSON.stringify({ scene: "form" }),
        call_id: "call_skill_1",
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.430Z",
      type: "event_msg",
      payload: {
        type: "list_skills_response",
        skills: [{ name: "search_scene_example", description: "scene best-practice examples" }],
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.450Z",
      type: "event_msg",
      payload: {
        type: "dynamic_tool_call_response",
        call_id: "call_skill_1",
        turn_id: "turn-skill",
        namespace: "skill",
        tool: "search_scene_example",
        arguments: { scene: "form" },
        content_items: [{ type: "text", text: "matched" }],
        success: true,
        duration: "100ms",
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.500Z",
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call_skill_1",
        output: { text: "matched" },
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.570Z",
      type: "event_msg",
      payload: {
        type: "skills_update_available",
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.650Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          total_token_usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        },
      },
    },
    {
      timestamp: "2026-06-11T06:00:00.700Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-skill" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const skillCallRun = runs.find(
    (run) => run.run_type === "tool" && run.name === "skill.search_scene_example",
  );
  expect(skillCallRun).toMatchObject({
    inputs: { input: { scene: "form" } },
    outputs: {
      namespace: "skill",
      tool: "search_scene_example",
      skill_description: "scene best-practice examples",
      skill: {
        name: "search_scene_example",
        description: "scene best-practice examples",
      },
      content: [{ type: "text", text: "matched" }],
      success: true,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
        }),
      ]),
    },
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "skill",
        ls_tool_category: "skill",
      }),
    },
  });

  const listSkillsRun = runs.find((run) => run.run_type === "tool" && run.name === "skill.list_skills");
  expect(listSkillsRun).toMatchObject({
    outputs: expect.objectContaining({
      skills: [{ name: "search_scene_example", description: "scene best-practice examples" }],
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "skill",
        ls_tool_category: "skill",
      }),
    },
  });

  const updateAvailableRun = runs.find(
    (run) => run.run_type === "tool" && run.name === "skill.skills_update_available",
  );
  expect(updateAvailableRun).toMatchObject({
    outputs: expect.objectContaining({
      update_available: true,
    }),
  });
});

it("injected and hook skills are reported", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath =
    "/home/codex-user/.codex/sessions/2026/06/11/rollout-injected-hook-skills.jsonl";
  const lines = [
    {
      timestamp: "2026-06-11T07:17:41.000Z",
      type: "session_meta",
      payload: {
        id: "thread-skill-injected",
        timestamp: "2026-06-11T07:17:41.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.010Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-skill-injected" },
    },
    {
      timestamp: "2026-06-11T07:17:41.020Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.030Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "$mc-strict-literal" }],
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.040Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "<skill>\n<name>mc-strict-literal</name>\n---\ndescription: strict literal mode\n---\n</skill>",
          },
        ],
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.050Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "running stop hook" }],
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.060Z",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "node /tmp/.codex/skills/lsp-syntax-check/scripts/lsp-hook.js",
        }),
        call_id: "call_hook_1",
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.070Z",
      type: "event_msg",
      payload: {
        type: "exec_command_end",
        call_id: "call_hook_1",
        turn_id: "turn-skill-injected",
        command: ["/bin/zsh", "-lc", "node /tmp/.codex/skills/lsp-syntax-check/scripts/lsp-hook.js"],
        cwd: "/tmp",
        parsed_cmd: [{ type: "exec", cmd: "node /tmp/.codex/skills/lsp-syntax-check/scripts/lsp-hook.js" }],
        stdout: "ok",
        stderr: "",
        aggregated_output: "ok",
        exit_code: 0,
        duration: "50ms",
        formatted_output: "ok",
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.080Z",
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call_hook_1",
        output: "ok",
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.090Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
          total_token_usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
        },
      },
    },
    {
      timestamp: "2026-06-11T07:17:41.100Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-skill-injected" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const requested = runs.find(
    (run) => run.run_type === "tool" && run.name === "skill.mc-strict-literal.requested",
  );
  expect(requested).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "mc-strict-literal",
      source: "user_trigger",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_category: "skill",
        ls_tool_namespace: "skill",
      }),
    },
  });

  const loaded = runs.find((run) => run.run_type === "tool" && run.name === "skill.mc-strict-literal.loaded");
  expect(loaded).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "mc-strict-literal",
      skill_description: "strict literal mode",
      source: "user_skill_block",
    }),
  });

  const hook = runs.find((run) => run.run_type === "tool" && run.name === "skill.lsp-syntax-check.hook");
  expect(hook).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "lsp-syntax-check",
      skill_event_kind: "hook_execution",
      hook_script: "skills/lsp-syntax-check/scripts/lsp-hook.js",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_category: "skill",
        ls_tool_namespace: "skill",
      }),
    },
  });
});

it("hook skill is reported from exec_command call when exec_command_end is missing", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath =
    "/home/codex-user/.codex/sessions/2026/06/11/rollout-hook-skill-fallback.jsonl";
  const lines = [
    {
      timestamp: "2026-06-11T08:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "thread-hook-fallback",
        timestamp: "2026-06-11T08:00:00.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-11T08:00:00.010Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-hook-fallback" },
    },
    {
      timestamp: "2026-06-11T08:00:00.020Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-11T08:00:00.030Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "running stop hook" }],
      },
    },
    {
      timestamp: "2026-06-11T08:00:00.040Z",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "node /tmp/.codex/skills/lsp-syntax-check/scripts/lsp-hook.js",
        }),
        call_id: "call_hook_fallback_1",
      },
    },
    {
      timestamp: "2026-06-11T08:00:00.050Z",
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call_hook_fallback_1",
        output: "ok",
      },
    },
    {
      timestamp: "2026-06-11T08:00:00.060Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-hook-fallback" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const hook = runs.find((run) => run.run_type === "tool" && run.name === "skill.lsp-syntax-check.hook");
  expect(hook).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "lsp-syntax-check",
      skill_event_kind: "hook_invocation",
      hook_script: "skills/lsp-syntax-check/scripts/lsp-hook.js",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_category: "skill",
        ls_tool_namespace: "skill",
      }),
    },
  });
});

it("plain text skill mention is reported", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath =
    "/home/codex-user/.codex/sessions/2026/06/11/rollout-skill-mentioned.jsonl";
  const lines = [
    {
      timestamp: "2026-06-11T09:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "thread-skill-mentioned",
        timestamp: "2026-06-11T09:00:00.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-11T09:00:00.010Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-skill-mentioned" },
    },
    {
      timestamp: "2026-06-11T09:00:00.020Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-11T09:00:00.030Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "这个skill没执行" }],
      },
    },
    {
      timestamp: "2026-06-11T09:00:00.040Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-skill-mentioned" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const mentioned = runs.find(
    (run) => run.run_type === "tool" && run.name === "skill.skill.mentioned",
  );
  expect(mentioned).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "skill",
      source: "text_mention",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_category: "skill",
        ls_tool_namespace: "skill",
      }),
    },
  });
});

it("skill read via exec_command is reported", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath =
    "/home/codex-user/.codex/sessions/2026/06/11/rollout-skill-read.jsonl";
  const lines = [
    {
      timestamp: "2026-06-11T10:00:00.000Z",
      type: "session_meta",
      payload: {
        id: "thread-skill-read",
        timestamp: "2026-06-11T10:00:00.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-11T10:00:00.010Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-skill-read" },
    },
    {
      timestamp: "2026-06-11T10:00:00.020Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-11T10:00:00.030Z",
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "cd /repo && sed -n '1,220p' .agents/skills/mc-strict-literal/SKILL.md",
        }),
        call_id: "call_skill_read_1",
      },
    },
    {
      timestamp: "2026-06-11T10:00:00.040Z",
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call_skill_read_1",
        output: "---\nname: mc-strict-literal\n---",
      },
    },
    {
      timestamp: "2026-06-11T10:00:00.050Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-skill-read" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const read = runs.find((run) => run.run_type === "tool" && run.name === "skill.mc-strict-literal.read");
  expect(read).toMatchObject({
    outputs: expect.objectContaining({
      skill_name: "mc-strict-literal",
      skill_event_kind: "skill_read",
      skill_path: ".agents/skills/mc-strict-literal/SKILL.md",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_category: "skill",
        ls_tool_namespace: "skill",
      }),
    },
  });
});

it("event and web search logs are reported as tool runs", async () => {
  const { client, callSpy } = mockClient();

  const rolloutPath =
    "/home/codex-user/.codex/sessions/2026/06/12/rollout-event-web-search.jsonl";
  const lines = [
    {
      timestamp: "2026-06-12T06:17:56.000Z",
      type: "session_meta",
      payload: {
        id: "thread-event-web-search",
        timestamp: "2026-06-12T06:17:56.000Z",
        cwd: "/tmp",
        originator: "codex",
        cli_version: "0.125.0",
        source: "test",
        model_provider: "openai",
        base_instructions: { text: "You are test assistant." },
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.010Z",
      type: "event_msg",
      payload: { type: "task_started", turn_id: "turn-event-web-search" },
    },
    {
      timestamp: "2026-06-12T06:17:56.020Z",
      type: "turn_context",
      payload: {
        cwd: "/tmp",
        approval_policy: "never",
        sandbox_policy: "workspace-write",
        model: "gpt-5.4",
        summary: [],
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.030Z",
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "探索日志",
        images: [],
        local_images: [],
        text_elements: [],
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.040Z",
      type: "event_msg",
      payload: {
        type: "agent_message",
        message: "开始扫描",
        phase: "commentary",
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.050Z",
      type: "response_item",
      payload: {
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          queries: ["OpenAI Codex tracing"],
        },
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.060Z",
      type: "compacted",
      payload: {
        message: "compacted summary",
        replacement_history: [],
      },
    },
    {
      timestamp: "2026-06-12T06:17:56.070Z",
      type: "event_msg",
      payload: { type: "task_complete", turn_id: "turn-event-web-search" },
    },
  ];

  vol.fromJSON({ [rolloutPath]: lines.map((line) => JSON.stringify(line)).join("\n") });

  await convertToRunTree(rolloutPath, { client, projectName: "codex" });
  await client.awaitPendingTraceBatches();

  const tree = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(tree.data);

  const userMessage = runs.find((run) => run.run_type === "tool" && run.name === "event.user_message");
  expect(userMessage).toMatchObject({
    outputs: expect.objectContaining({
      source: "event_msg.user_message",
      message: "探索日志",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "event",
      }),
    },
  });

  const agentMessage = runs.find((run) => run.run_type === "tool" && run.name === "event.agent_message");
  expect(agentMessage).toMatchObject({
    outputs: expect.objectContaining({
      source: "event_msg.agent_message",
      message: "开始扫描",
      phase: "commentary",
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "event",
      }),
    },
  });

  const webSearch = runs.find((run) => run.run_type === "tool" && run.name === "web.search_call");
  expect(webSearch).toMatchObject({
    inputs: {
      input: {
        type: "search",
        queries: ["OpenAI Codex tracing"],
      },
    },
    outputs: expect.objectContaining({
      source: "response_item.web_search_call",
      status: "completed",
      action: {
        type: "search",
        queries: ["OpenAI Codex tracing"],
      },
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "web",
      }),
    },
  });

  const compacted = runs.find((run) => run.run_type === "tool" && run.name === "event.compacted");
  expect(compacted).toMatchObject({
    outputs: expect.objectContaining({
      source: "compacted",
      message: "compacted summary",
      replacement_history: [],
    }),
    extra: {
      metadata: expect.objectContaining({
        ls_tool_namespace: "event",
      }),
    },
  });
});
