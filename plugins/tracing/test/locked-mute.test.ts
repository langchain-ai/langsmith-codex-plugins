import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Config } from "../src/models/config.js";

const locked: Config = {
  enabled: true,
  defaultMuted: true,
  redact: true,
  locked: ["defaultMuted"],
  project: "codex",
};
vi.mock("../src/config.js", () => ({ getConfig: async () => locked }));
const liveModes: string[] = [];
vi.mock("../src/tracing-engine.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/tracing-engine.js")>()),
  createCodexTracingSession: () => ({}),
  buildLiveToolRuns: async (_config: Config, _request: unknown, mode: string) => {
    liveModes.push(mode);
    return { root: {}, tool: { run: { name: "web_search" } } };
  },
  saveLiveToolRuns: async () => undefined,
}));

const { defaultPrivacyPath, savedTurnMode } = await import("../src/tracing-policy.js");
const { handlePromptSubmit } = await import("../src/user-prompt-submit.js");
const { handlePostToolUse } = await import("../src/post-tool-use.js");

let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-locked-mute-"));
  vi.stubEnv("HOME", home);
  await fs.mkdir(path.join(home, ".codex"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

const submit = (turn_id: string, prompt = "work") =>
  handlePromptSubmit({ session_id: "thread", turn_id, cwd: home, prompt });

it("keeps a thread muted while the managed file locks muting, even after an earlier unmute", async () => {
  await fs.writeFile(
    defaultPrivacyPath(),
    JSON.stringify({ version: 1, threads: { thread: { preference: "full", turns: {} } } }),
  );
  await submit("saved");
  const unmute = await submit("refused", "langsmith-tracing:unmute");
  await submit("after");
  const mute = await submit("muted", "langsmith-tracing:mute");

  expect(savedTurnMode(defaultPrivacyPath(), "thread", "saved")).toBe("metadata");
  expect(unmute).toEqual({ decision: "block", reason: expect.stringContaining("admin locked") });
  expect(savedTurnMode(defaultPrivacyPath(), "thread", "after")).toBe("metadata");
  expect(mute?.reason).toContain("muted (metadata-only)");
});

it("traces a helper thread's tool call without content while muting is locked", async () => {
  await fs.writeFile(
    defaultPrivacyPath(),
    JSON.stringify({ version: 1, threads: { helper: { inherited: "full", turns: {} } } }),
  );
  await handlePostToolUse({
    hook_event_name: "PostToolUse",
    session_id: "helper",
    turn_id: "turn",
    transcript_path: path.join(home, "rollout.jsonl"),
    tool_use_id: "call",
    cwd: home,
    prompt: "",
  });

  expect(liveModes).toEqual(["metadata"]);
});

it("forgets an unmute refused under a locked mute once the lock is lifted", async () => {
  await submit("refused", "langsmith-tracing:unmute");
  locked.locked = [];
  try {
    await submit("unlocked");
  } finally {
    locked.locked = ["defaultMuted"];
  }

  expect(savedTurnMode(defaultPrivacyPath(), "thread", "unlocked")).toBe("metadata");
});
