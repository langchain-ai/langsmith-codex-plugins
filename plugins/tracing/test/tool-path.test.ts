import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    name: "single quotes",
    args: { input: program(`{cmd:'ls', workdir:'/work/b'}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "backticks",
    args: { input: program("{cmd:`ls`, workdir:`/work/b`}") },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a quoted workdir key",
    args: { input: program(`{"cmd":"ls","workdir":"/work/b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a real workdir after a comment holding a quote",
    args: {
      input: `// don't use "x"\ntext(await tools.exec_command({cmd:"ls",workdir:"/work/b"}));`,
    },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a template with no placeholder",
    args: { input: program("{cmd:`ls`, workdir:`/work/b`}") },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir when it only appears in a line comment",
    args: { input: `// workdir: "/work/b"\n${program(`{cmd:"ls"}`)}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when it only appears in a block comment",
    args: { input: `/* {workdir: "/work/b"} */\n${program(`{cmd:"ls"}`)}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the value is a template with a placeholder",
    args: { input: program("{cmd:`ls`,workdir:`${base}/repo`}") },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the value is joined from two strings",
    args: { input: program(`{cmd:"ls",workdir:"/w/"+"repo"}`) },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the key belongs to a property access",
    args: { input: program(`{cmd:"ls"}`) + `\nopts.workdir:"/work/b"}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the text sits inside a command string",
    args: {
      input: program(
        `{cmd:"grep \\"workdir: '/work/plain'\\" notes.md"}`,
        `{cmd:'grep "workdir: \\'/work/plain\\'" notes.md'}`,
        '{cmd:`echo workdir: "/work/plain"`}',
        `{cmd:"workdir: '/work/plain'"}`,
      ),
    },
    expected: { namedAPath: false, cwd: "/work/a" },
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

function folders() {
  const root = mkdtempSync(join(tmpdir(), "tool-path-"));
  const repo = join(root, "repo");
  const plain = join(root, "plain");
  mkdirSync(join(repo, ".git"), { recursive: true });
  mkdirSync(plain);
  return { repo, plain };
}

it("prefers the first folder inside a repo over an earlier plain one", () => {
  const { repo, plain } = folders();
  const input = program(
    `{cmd:"ls",workdir:${JSON.stringify(plain)}}`,
    `{cmd:"ls",workdir:${JSON.stringify(repo)}}`,
  );
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: repo,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it("prefers a patched file inside a repo over an earlier plain file", () => {
  const { repo, plain } = folders();
  const input = `*** Begin Patch\n*** Update File: ${plain}/x.txt\n@@\n-x\n+y\n*** Update File: ${repo}/y.txt\n@@\n-x\n+y\n*** End Patch`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: `${repo}/y.txt`,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it("falls back to the first folder when none is inside a repo", () => {
  const { plain } = folders();
  const input = program(
    `{cmd:"ls",workdir:${JSON.stringify(plain)}}`,
    `{cmd:"ls",workdir:"/work/other"}`,
  );
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: plain,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it("does not count a folder whose .git pointer is broken as a repo", () => {
  const { repo, plain } = folders();
  const broken = join(plain, "broken");
  mkdirSync(broken);
  writeFileSync(join(broken, ".git"), "gitdir: /nowhere/at/all\n");
  const input = program(
    `{cmd:"ls",workdir:${JSON.stringify(broken)}}`,
    `{cmd:"ls",workdir:${JSON.stringify(repo)}}`,
  );
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: repo,
    namedAPath: true,
    cwd: "/work/a",
  });
});
