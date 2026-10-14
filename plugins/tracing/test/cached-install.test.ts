import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const pluginRoot = fileURLToPath(new URL("../", import.meta.url));

it("runs every hook from a cached plugin folder that has no node_modules", () => {
  const cached = mkdtempSync(path.join(os.tmpdir(), "codex cached plugin "));
  const home = mkdtempSync(path.join(os.tmpdir(), "codex cached home "));
  cpSync(path.join(pluginRoot, "dist"), path.join(cached, "dist"), { recursive: true });
  const transcript = path.join(home, "rollout.jsonl");
  writeFileSync(transcript, "");
  for (const event of [
    { hook_event_name: "UserPromptSubmit", prompt: "hello" },
    { hook_event_name: "Stop", transcript_path: transcript },
  ]) {
    const result = spawnSync(process.execPath, [path.join(cached, "dist", "index.mjs")], {
      cwd: home,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: home, USERPROFILE: home, TMPDIR: home },
      input: JSON.stringify({ session_id: "s", turn_id: "t", cwd: home, ...event }),
    });
    expect({ event: event.hook_event_name, status: result.status, stderr: result.stderr }).toEqual({
      event: event.hook_event_name,
      status: 0,
      stderr: "",
    });
  }
});
