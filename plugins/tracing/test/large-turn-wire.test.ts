import { expect, it, vi } from "vitest";
import { liveWire } from "./utils/live-wire.js";
import { largeRollout } from "./utils/large-rollout.js";

const wire = liveWire();

it("delivers a full-content turn once, closes its root, and preserves reported usage", async () => {
  const toolCount = 100;
  const live = await wire.workspace("large", largeRollout(toolCount));
  await live.write();
  await live.stop();
  await live.settle();
  // Preparing durable captures can outlast a quiet HTTP interval.
  await vi.waitFor(
    () => {
      const runs = [...wire.trace("large").runs.values()];
      expect(runs.filter(({ run_type }) => run_type === "tool")).toHaveLength(toolCount);
      expect(runs.find(({ name }) => name === "openai.codex")?.end_time).toBeDefined();
    },
    { timeout: 90_000, interval: 250 },
  );

  const trace = wire.trace("large");
  const runs = [...trace.runs.values()];
  const tools = runs.filter(({ run_type }) => run_type === "tool");
  const root = runs.find(({ name }) => name === "openai.codex")!;
  expect(tools).toHaveLength(toolCount);
  expect([...trace.posts.values()].every((count) => count === 1)).toBe(true);
  expect(root.end_time).toBeDefined();
  expect(JSON.stringify(root.inputs)).toContain("PRIVATE_BODY ACME-123");
  expect(JSON.stringify(tools[0].inputs)).toContain("echo synthetic-");
  expect(JSON.stringify(tools.map(({ outputs }) => outputs))).toContain("synthetic-result-99");
  expect(root.extra.metadata.ls_raw_aggregated_usage).toMatchObject({
    input_tokens: 100,
    output_tokens: 40,
    total_tokens: 140,
  });
  const generations = runs.filter(({ run_type }) => run_type === "llm");
  expect(
    generations.reduce(
      (sum, run) => sum + (run.extra.metadata.usage_metadata?.total_tokens ?? 0),
      0,
    ),
  ).toBe(140);
}, 120_000);
