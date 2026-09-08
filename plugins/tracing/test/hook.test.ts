import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

let home: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-hook-"));
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});
async function hook(
  prompt: string,
  turnId: string,
  enabled = false,
  defaultMuted = false,
  options: { configOnly?: boolean; cwd?: string } = {},
) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(LANGCHAIN_|LANGSMITH_|TRACE_TO_LANGSMITH)/.test(key),
    ),
  );
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("../dist/index.mjs", import.meta.url))],
      {
        env: {
          ...env,
          HOME: home,
          ...(options.configOnly
            ? {}
            : {
                TRACE_TO_LANGSMITH: String(enabled),
                LANGSMITH_CODEX_DEFAULT_MUTED: String(defaultMuted),
              }),
        },
        cwd: home,
      },
    );
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
        hook_event_name: "UserPromptSubmit",
        session_id: "thread",
        turn_id: turnId,
        cwd: options.cwd ?? home,
        prompt,
      }),
    );
  });
}
it("the installed hook definition is synchronous and preserves Stop timing", async () => {
  const definition = JSON.parse(
    await fs.readFile(new URL("../hooks/hooks.json", import.meta.url), "utf8"),
  );
  const submit = definition.hooks.UserPromptSubmit[0].hooks[0];
  expect(submit.type).toBe("command");
  expect(submit.command).toBe(`node "$PLUGIN_ROOT/dist/index.mjs"`);
  expect(submit.timeout).toBe(10);
  expect(submit.async).toBeUndefined();
  expect(definition.hooks.Stop[0].hooks[0]).toEqual({
    type: "command",
    command: submit.command,
    timeout: 30,
    statusMessage: "Uploading Codex trace to LangSmith",
  });
});
it("the production bundle consumes exact controls with no credentials, across restarts", async () => {
  const muted = await hook("langsmith-tracing:mute", "control");
  expect(muted.code).toBe(0);
  expect(muted.stderr).toBe("");
  expect(JSON.parse(muted.stdout)).toEqual({
    decision: "block",
    reason: expect.stringContaining(
      "Preference saved for the next turn; the current turn is unchanged.",
    ),
  });
  expect((await hook("work", "private", true)).stdout).toBe("");
  const unmuted = await hook("langsmith-tracing:unmute", "private", true);
  expect(JSON.parse(unmuted.stdout).decision).toBe("block");
  expect((await hook("work", "future", true)).stdout).toBe("");
  const policy = JSON.parse(
    await fs.readFile(path.join(home, ".codex/langsmith-state.privacy.json"), "utf8"),
  );
  expect(policy.threads.thread.turns).toEqual({
    control: "off",
    private: "metadata",
    future: "full",
  });
});
it("the bundle blocks corruption without overwriting it", async () => {
  await fs.mkdir(path.join(home, ".codex"));
  const file = path.join(home, ".codex/langsmith-state.privacy.json");
  await fs.writeFile(file, "broken");
  const result = await hook("langsmith-tracing:unmute", "control");
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).decision).toBe("block");
  expect(JSON.parse(result.stdout).reason).toContain("Refusing to overwrite");
  expect(await fs.readFile(file, "utf8")).toBe("broken");
});
it("the bundle does not interpret whitespace or slash lookalikes", async () => {
  expect((await hook(" langsmith-tracing:mute", "a")).stdout).toBe("");
  expect((await hook("/langsmith-tracing:mute", "b")).stdout).toBe("");
});

it("the production bundle follows changing defaults without materializing an override", async () => {
  expect((await hook("work", "muted", true, true)).stdout).toBe("");
  expect((await hook("work", "full", true, false)).stdout).toBe("");
  expect((await hook("work", "muted", true, false)).stdout).toBe("");
  const policy = JSON.parse(
    await fs.readFile(path.join(home, ".codex/langsmith-state.privacy.json"), "utf8"),
  );
  expect(policy).toEqual({
    version: 1,
    threads: { thread: { turns: { muted: "metadata", full: "full" } } },
  });
});

it("the production submit hook reads only the hidden home baseline outside home cwd", async () => {
  const cwd = path.join(home, "project");
  await fs.mkdir(cwd);
  const options = { configOnly: true, cwd };
  await fs.writeFile(
    path.join(home, "langsmith-plugins.json"),
    JSON.stringify({ enabled: true, defaultMuted: false }),
  );
  expect(await hook("work", "old-only", false, false, options)).toEqual({
    code: 0,
    stdout: "",
    stderr: "",
  });
  await fs.writeFile(
    path.join(home, ".langsmith-plugins.json"),
    JSON.stringify({ enabled: true, defaultMuted: true }),
  );
  expect(await hook("work", "hidden", false, false, options)).toEqual({
    code: 0,
    stdout: "",
    stderr: "",
  });
  const policy = JSON.parse(
    await fs.readFile(path.join(home, ".codex/langsmith-state.privacy.json"), "utf8"),
  );
  expect(policy.threads.thread.turns).toEqual({ "old-only": "off", hidden: "metadata" });
});
