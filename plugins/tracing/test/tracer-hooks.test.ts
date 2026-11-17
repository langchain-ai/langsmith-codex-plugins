import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PositionedHookNote } from "@langchain/plugins-base/tracer";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@langchain/plugins-base/plugin", async (original) => ({
  ...(await original<typeof import("@langchain/plugins-base/plugin")>()),
  launchDetachedWorker: vi.fn(async () => 1),
  openPluginSession: vi.fn(() => ({ session: { drain: async () => "drained" } })),
}));

import { openPluginSession } from "@langchain/plugins-base/plugin";
import { createCaptureStore } from "@langchain/plugins-base/storage/capture";
import { saveJobContext } from "../src/job-context.js";
import { readLegacySessions, sendTracerNote } from "../src/tracer-hooks.js";
import { contextSourceRef, transcriptSourceRef } from "../src/tracing-engine-locator.js";
import { handlePromptSubmit } from "../src/user-prompt-submit.js";

let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(join(tmpdir(), "codex-tracer-hooks-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("TRACE_TO_LANGSMITH", "true");
  vi.stubEnv("LANGSMITH_CODEX_API_KEY", "test-key");
  vi.stubEnv("LANGSMITH_CODEX_NOTICE_COOLDOWN", "off");
});

async function prompt(turnId: string, text: string): Promise<PositionedHookNote> {
  const input = {
    session_id: "thread",
    turn_id: turnId,
    cwd: home,
    prompt: text,
    transcript_path: join(home, "rollout.jsonl"),
    hook_event_name: "UserPromptSubmit" as const,
  };
  await handlePromptSubmit(input);
  await sendTracerNote(input);
  const notes = await fs.readFile(join(home, ".codex", "langsmith_plugins_base", "notes.jsonl"));
  return JSON.parse(String(notes).trim().split("\n").at(-1)!);
}

it("keeps a mute command's own turn at the mode it had before the command", async () => {
  const command = await prompt("t1", "langsmith-tracing:mute");
  const next = await prompt("t2", "next");

  expect(command).toMatchObject({ event: "UserPromptSubmit", sessionId: "thread" });
  expect(command.details).toMatchObject({ turnId: "t1" });
  expect([command.tracingMode, next.tracingMode]).toEqual(["full", "metadata"]);
});

it("hands the engine each old session that still has queued work, with the writer it would have used", async () => {
  const sessions = join(home, ".codex", "sessions", "2026");
  await fs.mkdir(sessions, { recursive: true });
  for (const id of ["job", "upload"]) {
    const meta = {
      timestamp: "2026-11-14T00:00:00.000Z",
      type: "session_meta",
      payload: { id, cwd: home },
    };
    await fs.writeFile(join(sessions, `rollout-2026-${id}.jsonl`), `${JSON.stringify(meta)}\n`);
  }
  const context = { cwd: home, project: "queued", metadata: undefined, parent_headers: undefined };
  for (const id of ["job", "no-rollout"]) {
    const ref = contextSourceRef(id, "t1", transcriptSourceRef(join(sessions, "x")), "full");
    await saveJobContext(home, id, ref, context);
  }
  await createCaptureStore(join(home, ".codex", "langsmith_engine")).capture({
    integration: "openai-codex",
    sessionId: "upload",
    turnId: "t1",
    eventId: "e1",
    runId: "r1",
    destinationFingerprint: "d1",
    eventKind: "run",
    normalizedPayload: {},
    turnEvidence: {},
    metadataProvenance: {},
  });

  const found = await readLegacySessions(home);
  const projects = found.map(({ sessionId, writer }) => [
    sessionId,
    writer?.destinations[0]?.projectName,
  ]);
  expect(projects.toSorted()).toEqual([
    ["job", "queued"],
    ["upload", "codex"],
  ]);
  expect(found.find(({ sessionId }) => sessionId === "upload")?.transcriptPath).toBe(
    join(sessions, "rollout-2026-upload.jsonl"),
  );

  await found.find(({ sessionId }) => sessionId === "upload")?.recover?.();
  expect(openPluginSession).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: "upload",
      storageRoot: join(home, ".codex", "langsmith_engine"),
    }),
  );
});
