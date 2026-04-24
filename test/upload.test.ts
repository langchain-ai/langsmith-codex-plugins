import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RunConfig = {
  name: string;
  run_type: string;
  start_time: number;
  end_time: number;
};

const createdRunConfigs: RunConfig[] = [];

class FakeRunTree {
  constructor(private readonly config: RunConfig) {
    createdRunConfigs.push(config);
  }

  createChild(config: RunConfig) {
    return new FakeRunTree(config);
  }

  async postRun() {}
}

vi.mock("langsmith/run_trees", () => ({
  RunTree: FakeRunTree,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    appendFile: vi.fn().mockResolvedValue(undefined),
  };
});

describe("convertToRunTree", () => {
  let tempDir: string | undefined;

  beforeEach(() => {
    createdRunConfigs.length = 0;
    vi.resetModules();
  });

  afterEach(async () => {
    if (tempDir != null) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("uses each output slice timing for child llm runs", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ls-codex-"));

    const rolloutFile = path.join(
      tempDir,
      "2026",
      "04",
      "24",
      "rollout-000-thread.jsonl",
    );
    await fs.mkdir(path.dirname(rolloutFile), { recursive: true });

    const functionCallAt = "2026-04-24T10:00:03.000Z";
    const functionOutputAt = "2026-04-24T10:00:04.000Z";
    const finalMessageAt = "2026-04-24T10:00:05.000Z";

    await fs.writeFile(
      rolloutFile,
      [
        JSON.stringify({
          timestamp: "2026-04-24T10:00:00.000Z",
          type: "session_meta",
          payload: {
            id: "thread",
            timestamp: "2026-04-24T10:00:00.000Z",
            cwd: tempDir,
            originator: "codex-tui",
            cli_version: "0.123.0",
            source: "cli",
            model_provider: "openai",
            base_instructions: { text: "You are helpful." },
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:01.000Z",
          type: "event_msg",
          payload: {
            type: "task_started",
            turn_id: "turn-1",
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:01.100Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "<environment_context />",
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:01.200Z",
          type: "turn_context",
          payload: {
            turn_id: "turn-1",
            cwd: tempDir,
            approval_policy: "never",
            sandbox_policy: "workspace-write",
            model: "gpt-5.4",
            summary: "none",
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:02.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Run the formatter",
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: functionCallAt,
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            arguments: "{\"cmd\":\"pnpm fmt\"}",
            call_id: "call-1",
          },
        }),
        JSON.stringify({
          timestamp: functionOutputAt,
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call-1",
            output: "formatted",
          },
        }),
        JSON.stringify({
          timestamp: finalMessageAt,
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "Formatting is complete.",
              },
            ],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:05.100Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              total_token_usage: {
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
                cached_input_tokens: 0,
                reasoning_output_tokens: 0,
              },
              last_token_usage: {
                input_tokens: 10,
                output_tokens: 5,
                total_tokens: 15,
                cached_input_tokens: 0,
                reasoning_output_tokens: 0,
              },
              model_context_window: 128000,
            },
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:05.200Z",
          type: "event_msg",
          payload: {
            type: "task_complete",
            turn_id: "turn-1",
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const { convertToRunTree, flush } = await import("../src/upload.ts");

    await convertToRunTree(rolloutFile);
    await flush();

    const llmRuns = createdRunConfigs.filter((run) => run.run_type === "llm");
    expect(llmRuns).toHaveLength(2);

    expect(llmRuns[0]).toMatchObject({
      start_time: Date.parse(functionCallAt),
      end_time: Date.parse(functionOutputAt),
    });
    expect(llmRuns[1]).toMatchObject({
      start_time: Date.parse(finalMessageAt),
      end_time: Date.parse(finalMessageAt),
    });
  });

  it("skips turns whose ids are already recorded in the uploaded sidecar", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ls-codex-"));

    const rolloutFile = path.join(
      tempDir,
      "2026",
      "04",
      "24",
      "rollout-000-thread.jsonl",
    );
    await fs.mkdir(path.dirname(rolloutFile), { recursive: true });

    await fs.writeFile(
      rolloutFile,
      [
        JSON.stringify({
          timestamp: "2026-04-24T10:00:00.000Z",
          type: "session_meta",
          payload: {
            id: "thread",
            timestamp: "2026-04-24T10:00:00.000Z",
            cwd: tempDir,
            originator: "codex-tui",
            cli_version: "0.123.0",
            source: "cli",
            model_provider: "openai",
            base_instructions: { text: "You are helpful." },
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:01.000Z",
          type: "event_msg",
          payload: { type: "task_started", turn_id: "turn-1" },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:02.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "hi" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:03.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "hello" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:04.000Z",
          type: "event_msg",
          payload: { type: "task_complete", turn_id: "turn-1" },
        }),
      ].join("\n"),
      "utf8",
    );

    // Simulate a previous hook invocation having already uploaded turn-1.
    await fs.writeFile(`${rolloutFile}.ls-uploaded`, "turn-1\n", "utf8");

    const { convertToRunTree, flush } = await import("../src/upload.ts");

    await convertToRunTree(rolloutFile);
    await flush();

    expect(createdRunConfigs).toHaveLength(0);
  });

  it("records completed turn ids in the uploaded sidecar after posting", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ls-codex-"));

    const rolloutFile = path.join(
      tempDir,
      "2026",
      "04",
      "24",
      "rollout-000-thread.jsonl",
    );
    await fs.mkdir(path.dirname(rolloutFile), { recursive: true });

    await fs.writeFile(
      rolloutFile,
      [
        JSON.stringify({
          timestamp: "2026-04-24T10:00:00.000Z",
          type: "session_meta",
          payload: {
            id: "thread",
            timestamp: "2026-04-24T10:00:00.000Z",
            cwd: tempDir,
            originator: "codex-tui",
            cli_version: "0.123.0",
            source: "cli",
            model_provider: "openai",
            base_instructions: { text: "You are helpful." },
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:01.000Z",
          type: "event_msg",
          payload: { type: "task_started", turn_id: "turn-1" },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:03.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "hello" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-24T10:00:04.000Z",
          type: "event_msg",
          payload: { type: "task_complete", turn_id: "turn-1" },
        }),
      ].join("\n"),
      "utf8",
    );

    const { convertToRunTree, flush } = await import("../src/upload.ts");

    await convertToRunTree(rolloutFile);
    await flush();

    expect(fs.appendFile).toHaveBeenCalledWith(
      `${rolloutFile}.ls-uploaded`,
      "turn-1\n",
      "utf-8",
    );
  });
});
