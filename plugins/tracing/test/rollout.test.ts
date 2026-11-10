import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { loadSession } from "../src/utils/rollout.js";

it("reads a rollout one line at a time, so a reader that stops early never parses the rest", async () => {
  const file = fileURLToPath(new URL("fixtures/rollout-half-written.jsonl", import.meta.url));
  const types: string[] = [];
  for await (const event of loadSession(file)) {
    types.push(event.type);
    break;
  }
  expect(types).toEqual(["session_meta"]);
});

it("keeps a line whole when its text holds a Unicode line separator", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "rollout-")), "rollout.jsonl");
  const line = { type: "event_msg", payload: { message: "pasted\u2028text\u2029end" } };
  writeFileSync(file, `${JSON.stringify(line)}\n`);
  expect(await Array.fromAsync(loadSession(file))).toEqual([line]);
});
