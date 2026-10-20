import { mkdir, mkdtemp, readFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recordWarning, showPendingWarning } from "../src/warnings.js";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "codex-warning-"));
  await mkdir(path.join(home, ".codex"));
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

it("shows the newest recorded warning on stderr once, then nothing", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await recordWarning(home, "first");
  await recordWarning(home, "second");

  await showPendingWarning(home);
  await showPendingWarning(home);

  expect(log.mock.calls).toEqual([["second"]]);
  expect(out).not.toHaveBeenCalled();
  await expect(readFile(path.join(home, ".codex", "langsmith_warning.txt"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  log.mockRestore();
  out.mockRestore();
});

it("drops a warning older than 6 hours without showing it", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await recordWarning(home, "old");
  const file = path.join(home, ".codex", "langsmith_warning.txt");
  const old = new Date(Date.now() - 7 * 60 * 60 * 1000);
  await utimes(file, old, old);

  await showPendingWarning(home);

  expect(log).not.toHaveBeenCalled();
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
  log.mockRestore();
});

it("still shows a warning that is 5 hours old", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await recordWarning(home, "recent");
  const file = path.join(home, ".codex", "langsmith_warning.txt");
  const recent = new Date(Date.now() - 5 * 60 * 60 * 1000);
  await utimes(file, recent, recent);

  await showPendingWarning(home);

  expect(log.mock.calls).toEqual([["recent"]]);
  log.mockRestore();
});
