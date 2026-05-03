import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToRunTree } from "../src/trace.js";
import { vol } from "memfs";

import * as path from "node:path";
import { Client } from "langsmith";
import { mockClient } from "./utils/mock_client.js";
import { asTree, getAssumedTreeFromCalls } from "./utils/tree.js";

const Run = (props: Record<string, unknown>) => null;

async function preloadTestFiles() {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");

  const sourceDir = path.join(__dirname, "sessions/2026/04/23");
  const targetDir = path.join("/home/codex-user/.codex/sessions/2026/04/23");

  const fileDir = await fs.readdir(sourceDir);

  const testFiles: Record<string, string> = {};

  for (const file of fileDir) {
    if (!file.endsWith(".jsonl")) continue;
    testFiles[path.join(targetDir, file)] = await fs.readFile(path.join(sourceDir, file), "utf-8");
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

it("editing", async () => {
  const { client, callSpy } = mockClient();

  vol.fromJSON(await preloadTestFiles());

  await convertToRunTree(
    path.join("/home/codex-user/.codex/sessions/2026/04/23/rollout-editing.jsonl"),
    { client, projectName: "codex" },
  );

  await client.awaitPendingTraceBatches();

  // Sidecar file is created
  expect(vol.toJSON()).toMatchObject({
    "/home/codex-user/.codex/sessions/2026/04/23/rollout-editing.jsonl.langsmith":
      expect.stringContaining("019dbc00-ede4-77c2-9e7a-b6876efeab9b"),
  });

  // Assert on trace output
  await expect(getAssumedTreeFromCalls(callSpy.mock.calls, client)).resolves.toMatchObject(
    asTree((run) => {
      run`openai.codex:0`(
        { run_type: "chain" },
        run`openai.codex.turn:1`({
          run_type: "llm",
          inputs: {
            messages: expect.arrayContaining([
              {
                role: "user",
                content: expect.arrayContaining([
                  { type: "text", text: "Create a sample app that does cowsay" },
                ]),
              },
            ]),
          },
          outputs: {
            messages: [
              {
                role: "ai",
                content: expect.arrayContaining([
                  {
                    type: "text",
                    text: "I’m going to inspect the repo structure first so I can add a minimal sample app in the right stack instead of guessing.",
                  },
                ]),
              },
            ],
          },
        }),
        run`exec_command:2`({ run_type: "tool" }),
        run`exec_command:3`({ run_type: "tool" }),
        run`exec_command:4`({ run_type: "tool" }),
        run`openai.codex.turn:5`({ run_type: "llm" }),
        run`exec_command:6`({ run_type: "tool" }),
        run`exec_command:7`({ run_type: "tool" }),
        run`openai.codex.turn:8`({ run_type: "llm" }),
        run`apply_patch:9`({ run_type: "tool" }),
        run`openai.codex.turn:10`({ run_type: "llm" }),
        run`exec_command:11`({ run_type: "tool" }),
        run`exec_command:12`({ run_type: "tool" }),
        run`openai.codex.turn:13`({ run_type: "llm" }),
      );
    }),
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
  await expect(getAssumedTreeFromCalls(callSpy.mock.calls, client)).resolves.toMatchObject(
    asTree((run) => {
      // TODO
    }),
  );
});

it("subagents", async () => {
  const { client, callSpy } = mockClient();
  vol.fromJSON(await preloadTestFiles());

  await convertToRunTree(
    path.join("/home/codex-user/.codex/sessions/2026/04/23/rollout-subagents.jsonl"),
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
      // TODO
    }),
  );
});
