import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = new URL("../../../", import.meta.url);
const seaSettings = JSON.parse(readFileSync(new URL("sea-config.json", repoRoot), "utf8"));
const binaryPath = fileURLToPath(new URL(seaSettings.output, repoRoot));
const binaryExists = existsSync(binaryPath);
const ciShouldHaveBuiltBinary = Boolean(process.env.CI) && os.platform() === "darwin";

if (!binaryExists && ciShouldHaveBuiltBinary) {
  throw new Error(
    `Expected the SEA binary at ${binaryPath}. CI must run \`pnpm build:sea\` before this suite.`,
  );
}

let codexHome: string;
beforeEach(async () => {
  codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-sea-"));
});
afterEach(async () => {
  await fs.rm(codexHome, { recursive: true, force: true });
});

const DEVELOPER_TRACING_VARS = /^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/;

function envWithoutDeveloperTracingVars() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !DEVELOPER_TRACING_VARS.test(key)),
  );
}

function runHook(event: string, prompt: string, tracingEnabled = false) {
  const envWithoutTracing = envWithoutDeveloperTracingVars();
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binaryPath, [], {
      env: { ...envWithoutTracing, HOME: codexHome, TRACE_TO_LANGSMITH: String(tracingEnabled) },
      cwd: codexHome,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(
      JSON.stringify({
        hook_event_name: event,
        session_id: "thread",
        turn_id: "control",
        transcript_path: path.join(codexHome, "rollout.jsonl"),
        cwd: codexHome,
        prompt,
      }),
    );
  });
}

describe.runIf(binaryExists)("the standalone binary", () => {
  it("blocks the turn and saves the policy when the prompt is a mute command", async () => {
    const result = await runHook("UserPromptSubmit", "langsmith-tracing:mute");
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      decision: "block",
      reason: expect.stringContaining("Thread tracing muted (metadata-only)."),
    });
    const policy = JSON.parse(
      await fs.readFile(path.join(codexHome, ".codex/langsmith-state.privacy.json"), "utf8"),
    );
    expect(policy.threads.thread.turns).toEqual({ control: "off" });
  });

  it("writes nothing on a Stop event when tracing is off", async () => {
    const result = await runHook("Stop", "work");
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(existsSync(path.join(codexHome, ".codex/langsmith-state.privacy.json"))).toBe(false);
  });

  it("does nothing on a hook event it does not handle", async () => {
    const result = await runHook("SessionStart", "langsmith-tracing:mute", true);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(existsSync(path.join(codexHome, ".codex/langsmith-state.privacy.json"))).toBe(false);
  });
});
