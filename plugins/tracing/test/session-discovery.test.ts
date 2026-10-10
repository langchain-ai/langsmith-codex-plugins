const { opendirSpy, readFileSpy } = vi.hoisted(() => ({
  opendirSpy: vi.fn(),
  readFileSpy: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  const promises = fs.promises;
  return {
    ...promises,
    opendir: opendirSpy.mockImplementation(promises.opendir.bind(promises)),
    readFile: readFileSpy.mockImplementation(promises.readFile.bind(promises)),
  };
});

import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { vol } from "memfs";
import { createCodexSessionCwdResolver } from "../src/session-discovery.js";

const home = join(tmpdir(), "codex-session-discovery", "home");

afterEach(() => {
  vol.reset();
  opendirSpy.mockClear();
  readFileSpy.mockClear();
  vi.restoreAllMocks();
});

it("indexes rollouts once and reads only bounded session headers", async () => {
  const day = join(home, ".codex", "sessions", "2026", "10", "10");
  const trailer = "x".repeat(256 * 1024);
  vol.fromJSON({
    [join(day, "rollout-subagents-session-one.jsonl")]:
      `${JSON.stringify({ type: "session_meta", payload: { id: "session-one", cwd: "/repo/one" } })}\n${trailer}`,
    [join(day, "rollout-session-two.jsonl")]:
      `${JSON.stringify({ type: "session_meta", payload: { id: "session-two", cwd: "/repo/two" } })}\n${trailer}`,
  });
  const resolveCwd = createCodexSessionCwdResolver(home);

  await expect(resolveCwd("session-one")).resolves.toBe("/repo/one");
  await expect(resolveCwd("session-two")).resolves.toBe("/repo/two");

  expect(opendirSpy).toHaveBeenCalledTimes(4);
  expect(readFileSpy).not.toHaveBeenCalled();
});

it("stops discovery when the directory entry limit is exceeded", async () => {
  const day = join(home, ".codex", "sessions", "2026", "10", "10");
  vol.fromJSON({
    [join(day, "rollout-session-one.jsonl")]: JSON.stringify({
      type: "session_meta",
      payload: { id: "session-one", cwd: "/repo/one" },
    }),
  });
  const resolveCwd = createCodexSessionCwdResolver(home, 1);

  await expect(resolveCwd("session-one")).rejects.toThrow("recovery entry limit");
  expect(readFileSpy).not.toHaveBeenCalled();
});

it("does not parse a session header larger than the read limit", async () => {
  const day = join(home, ".codex", "sessions", "2026", "10", "10");
  vol.fromJSON({
    [join(day, "rollout-session-large.jsonl")]: `${JSON.stringify({
      type: "session_meta",
      payload: { id: "session-large", cwd: "/repo/large", padding: "x".repeat(128 * 1024) },
    })}\n`,
  });
  const resolveCwd = createCodexSessionCwdResolver(home);

  await expect(resolveCwd("session-large")).resolves.toBeUndefined();
  expect(readFileSpy).not.toHaveBeenCalled();
});
