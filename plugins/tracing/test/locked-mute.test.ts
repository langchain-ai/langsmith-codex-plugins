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

const { defaultPrivacyPath, savedTurnMode } = await import("../src/tracing-policy.js");
const { handlePromptSubmit } = await import("../src/user-prompt-submit.js");

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
  expect(unmute?.hookSpecificOutput?.additionalContext).toContain(
    "enabled muting for all sessions",
  );
  expect(savedTurnMode(defaultPrivacyPath(), "thread", "after")).toBe("metadata");
  expect(mute?.hookSpecificOutput?.additionalContext).toContain("muted (metadata-only)");
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

it("warns that setup keeps a thread muted while the admin locks muting, even after an unmute", async () => {
  await fs.writeFile(
    defaultPrivacyPath(),
    JSON.stringify({ version: 1, threads: { thread: { preference: "full", turns: {} } } }),
  );

  const reply = await submit("setup", "langsmith-tracing:setup");

  expect(reply?.hookSpecificOutput?.additionalContext).toContain("This thread is muted");
});
