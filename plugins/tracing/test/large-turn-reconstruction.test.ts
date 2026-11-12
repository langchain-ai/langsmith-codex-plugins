import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { ReconstructionOutput } from "@langchain/plugins-base/tracing/reconstruction";

const engine = vi.hoisted(() => ({ reconstruct: undefined as any }));
vi.mock("@langchain/plugins-base/plugin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langchain/plugins-base/plugin")>()),
  openPluginSession: (options: Record<string, any>) => {
    engine.reconstruct = options.reconstruct;
    return { sessionId: options.sessionId, store: { read: async () => undefined } };
  },
}));

import { createCodexTracingSession } from "../src/tracing-engine.js";
import { contextSourceRef, transcriptSourceRef } from "../src/tracing-engine-locator.js";
import { saveJobContext } from "../src/job-context.js";
import { largeRollout } from "./utils/large-rollout.js";

let home: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

it("stores child receipt evidence linearly while retaining every tool in a large full-content turn", async () => {
  const toolCount = Number(process.env.CODEX_TRACE_BENCHMARK_TOOLS ?? 1000);
  home = await mkdtemp(path.join(tmpdir(), "codex-large-turn-"));
  vi.stubEnv("HOME", home);
  await mkdir(path.join(home, ".codex"));
  await writeFile(
    path.join(home, ".codex", "langsmith_state_privacy.json"),
    JSON.stringify({ version: 1, threads: { "thread-1": { turns: { "turn-1": "full" } } } }),
  );
  const transcript = path.join(home, "rollout.jsonl");
  await writeFile(transcript, largeRollout(toolCount).join("\n"));
  const sourceRef = transcriptSourceRef(transcript);
  const contextRef = contextSourceRef("thread-1", "turn-1", sourceRef, "full");
  await saveJobContext(home, "thread-1", contextRef, {
    cwd: home,
    project: "synthetic",
    metadata: undefined,
    parent_headers: undefined,
  });
  createCodexTracingSession(
    { enabled: true, defaultMuted: false, redact: true, locked: [], api_key: "synthetic" },
    "thread-1",
    home,
    home,
  );

  const started = performance.now();
  const { outputs }: { outputs: ReconstructionOutput[] } = await engine.reconstruct({
    integration: "openai-codex",
    sessionId: "thread-1",
    turnId: "turn-1",
    eventId: "synthetic-reconstruction",
    accountFingerprint: "synthetic",
    sourceRefs: [sourceRef, contextRef],
    privacyMode: "full",
    turnEvidence: { childRunIds: [], closureState: "authoritative" },
  });
  const elapsedMs = performance.now() - started;
  const tools = outputs.filter(({ submission }) => submission.run.run_type === "tool");
  const evidenceIds = outputs.reduce(
    (sum, output) => sum + (output.turnEvidence?.childRunIds.length ?? 0),
    0,
  );
  const mappingBytes = outputs.reduce(
    (sum, { eventId, sourceRef, turnEvidence, submission }) =>
      sum +
      Buffer.byteLength(
        JSON.stringify({ eventId, runId: submission.run.id, sourceRef, turnEvidence }),
      ),
    0,
  );
  if (process.env.CODEX_TRACE_BENCHMARK_TOOLS) {
    console.log(
      JSON.stringify({ toolCount, spans: outputs.length, evidenceIds, mappingBytes, elapsedMs }),
    );
  }
  expect(tools).toHaveLength(toolCount);
  expect(new Set(outputs.map(({ submission }) => submission.run.id)).size).toBe(outputs.length);
  expect(JSON.stringify(tools[0].submission)).toContain("synthetic-result-0");
  expect(JSON.stringify(tools.at(-1)!.submission)).toContain(`synthetic-result-${toolCount - 1}`);
  expect(evidenceIds).toBe(2 * (outputs.length - 1));
  expect(mappingBytes).toBeLessThan(outputs.length * 1000);
}, 30_000);
