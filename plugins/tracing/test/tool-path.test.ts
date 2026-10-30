import { expect, it } from "vitest";
import { toolOriginFromArgs } from "../src/tool-path.js";

const program = (...calls: string[]) =>
  calls.map((call) => `text(await tools.exec_command(${call}));`).join("\n");

it.each([
  {
    name: "a workdir inside the JS program Codex wraps shell calls in",
    args: { input: program(`{cmd:"git status",workdir:"/work/b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "single quotes and backticks",
    args: { input: program(`{cmd:'ls', workdir:'/work/b'}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a relative workdir, resolved from the session folder",
    args: { input: program(`{cmd:"ls",workdir:"../b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "the first workdir when one program names several",
    args: {
      input: program(`{cmd:"ls",workdir:"/work/b"}`, `{cmd:"ls",workdir:"/work/c"}`),
    },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir in the program",
    args: { input: program(`{cmd:"ls"}`) },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "a workdir on the plain function call",
    args: { cmd: "ls", workdir: "/work/b" },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "every file of a patch, so the first one wins",
    args: {
      input:
        "*** Begin Patch\n*** Update File: /work/b/x.txt\n@@\n-x\n+y\n*** Update File: /work/c/y.txt\n@@\n-x\n+y\n*** End Patch",
    },
    expected: { path: "/work/b/x.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a new file added by a relative path into another folder",
    args: { input: "*** Begin Patch\n*** Add File: ../b/new.txt\n+hi\n*** End Patch" },
    expected: { path: "/work/b/new.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a relative path that names a missing folder",
    args: { file_path: "../b/deeper/new.txt" },
    expected: { path: "/work/b/deeper/new.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no path at all",
    args: { cmd: "pwd" },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
])("reads $name", ({ args, expected }) => {
  expect(toolOriginFromArgs(args, "/work/a")).toEqual(expected);
});

it("skips a relative first file when the session folder is unknown and takes the next absolute one", () => {
  const input =
    "*** Begin Patch\n*** Update File: rel.txt\n@@\n-x\n+y\n*** Update File: /work/c/y.txt\n@@\n-x\n+y\n*** End Patch";
  expect(toolOriginFromArgs({ input }, undefined)).toEqual({
    path: "/work/c/y.txt",
    namedAPath: true,
  });
});

it("reports a named path that cannot be resolved without a session folder", () => {
  expect(toolOriginFromArgs({ path: "rel.txt" }, undefined)).toEqual({ namedAPath: true });
});
