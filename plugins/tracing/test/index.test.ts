import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const traceId = "019ffb8d-53c0-7cb2-bc81-f9d27dd0c250";
  const parentRunId = "019ffb8d-6b3f-7d1b-8af0-75237d8bcfda";
  const dottedOrder = `20260813T133849375587Z${traceId}.20260813T133950000000Z${parentRunId}`;

  return {
    traceId,
    parentRunId,
    dottedOrder,
    getConfig: vi.fn(async () => ({
      enabled: true,
      project: "codex",
      redact: true,
      parent_headers: {
        "langsmith-trace": dottedOrder,
        baggage: "langsmith-project=parent-project",
      },
    })),
    readStdin: vi.fn(async () => ({
      session_id: "session-id",
      turn_id: "turn-id",
      transcript_path: "/tmp/rollout.jsonl",
      hook_event_name: "Stop" as const,
    })),
    convertToRunTree: vi.fn(async (_input: unknown, _options: unknown) => undefined),
  };
});

vi.mock("../src/config.js", () => ({ getConfig: mocks.getConfig }));
vi.mock("../src/trace.js", () => ({ convertToRunTree: mocks.convertToRunTree }));
vi.mock("../src/utils/stdin.js", () => ({ readStdin: mocks.readStdin }));

it("passes distributed parent context to trace conversion", async () => {
  await import("../src/index.js");

  await vi.waitFor(() => expect(mocks.convertToRunTree).toHaveBeenCalledOnce());

  const options = mocks.convertToRunTree.mock.calls[0][1] as { parentRunTree?: unknown };
  expect(options.parentRunTree).toMatchObject({
    id: mocks.parentRunId,
    trace_id: mocks.traceId,
    dotted_order: mocks.dottedOrder,
    project_name: "parent-project",
  });
});
