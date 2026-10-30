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
    name: "a single-quoted workdir key",
    args: { input: program(`{cmd:"ls",'workdir':"/work/b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a workdir that comes first in the object",
    args: { input: program(`{workdir:"/work/b",cmd:"ls"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a workdir after a block comment",
    args: { input: program(`{cmd:"ls", /* r */ workdir:"/work/b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a workdir after a line comment",
    args: { input: `text(await tools.exec_command({cmd:"ls", // r\n workdir:"/work/b"}));` },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object sits inside a double-quoted string",
    args: { input: program(`{cmd:"echo {workdir:'/work/plain'}"}`) },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object sits inside a single-quoted string",
    args: { input: program(`{cmd:'echo {workdir:"/work/plain"}'}`) },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object sits inside a backtick string",
    args: { input: program("{cmd:`echo {workdir:'/work/plain'}`}") },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object sits inside a line comment",
    args: { input: `// {workdir:"/work/plain"}\n${program(`{cmd:"ls"}`)}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object sits inside a multi-line block comment",
    args: { input: `/* first\n{workdir:"/work/plain"}\n*/\n${program(`{cmd:"ls"}`)}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "a patch applied inside the program",
    args: {
      input: `text(await tools.apply_patch(${JSON.stringify("*** Begin Patch\n*** Add File: /work/b/x.txt\n+hi\n*** End Patch")}));`,
    },
    expected: { path: "/work/b/x.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a patch that starts after blank space",
    args: { input: "\n  *** Begin Patch\n*** Add File: /work/b/x.txt\n+hi\n*** End Patch" },
    expected: { path: "/work/b/x.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a program that mentions a patch inside a command",
    args: {
      input: program(`{cmd:"echo '*** Begin Patch'",workdir:"/work/b"}`),
    },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "the call's own workdir when an inner object has one first",
    args: {
      input: program(`{cmd:"ls",env:{workdir:"/work/plain"},workdir:"/work/b"}`),
    },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir when it only sits in an object inside the call",
    args: { input: program(`{cmd:"ls",env:{workdir:"/work/plain"}}`) },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when it only sits in an object outside the call",
    args: { input: `const config = {workdir:"/work/plain"};\n${program(`{cmd:"ls"}`)}` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when a later call is not an exec_command",
    args: {
      input: `${program(`{cmd:"ls"}`)}\ntext(await tools.other({cmd:"ls",workdir:"/work/plain"}));`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "a workdir after a line comment holding a closing brace",
    args: { input: `text(await tools.exec_command({cmd:"ls", // }\n workdir:"/work/b"}));` },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "a workdir after a block comment holding a closing brace",
    args: { input: program(`{cmd:"ls", /* } */ workdir:"/work/b"}`) },
    expected: { path: "/work/b", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir when an object is only assigned to a variable named like the call",
    args: { input: `const exec_command = {cmd:"ls",workdir:"/work/plain"};` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no patch when a name like apply_patch only holds text",
    args: {
      input: `const apply_patch = ${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/x.txt\n+hi\n*** End Patch")};`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "a bare apply_patch call",
    args: {
      input: `apply_patch(${JSON.stringify("*** Begin Patch\n*** Add File: /work/b/x.txt\n+hi\n*** End Patch")});`,
    },
    expected: { path: "/work/b/x.txt", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no patch when the call belongs to another object",
    args: {
      input: `foo.apply_patch(${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/x.txt\n+hi\n*** End Patch")});`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no patch when the text goes to some other function",
    args: {
      input: `f(${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/x.txt\n+hi\n*** End Patch")});`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no patch when the path is built with a placeholder",
    args: {
      input:
        "tools.apply_patch(`*** Begin Patch\n*** Add File: ${base}/x.txt\n+hi\n*** End Patch`);",
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no patch when the text is joined from several strings",
    args: {
      input: `tools.apply_patch(${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/")} + name);`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no patch when there is no opening bracket after the name",
    args: {
      input: `tools.apply_patch ; ${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/x.txt\n+hi\n*** End Patch")})`,
    },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the call name only ends like exec_command",
    args: { input: `text(await $exec_command({cmd:"ls",workdir:"/work/plain"}));` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when exec_command belongs to another object",
    args: { input: `text(await foo.exec_command({cmd:"ls",workdir:"/work/plain"}));` },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "a template holding a dollar sign and a brace but no placeholder",
    args: { input: program("{cmd:`ls`,workdir:`/work/$b{x}`}") },
    expected: { path: "/work/$b{x}", namedAPath: true, cwd: "/work/a" },
  },
  {
    name: "no workdir when a placeholder sits mid-path",
    args: { input: program("{cmd:`ls`,workdir:`/work/${b}`}") },
    expected: { namedAPath: false, cwd: "/work/a" },
  },
  {
    name: "no workdir when the key is a property access",
    args: { input: program(`{cmd:"ls", opts.workdir:"/work/plain"}`) },
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

it("takes a patch's repo from its file paths and not from workdir text in the added content", () => {
  const { repo, plain } = folders();
  const input = `*** Begin Patch\n*** Add File: ${plain}/x.js\n+{cmd:"ls",workdir:${JSON.stringify(repo)}}\n*** End Patch`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: `${plain}/x.js`,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it("leaves a relative folder unresolved when the session folder is relative", () => {
  expect(toolOriginFromArgs({ workdir: "b" }, "rel")).toEqual({ namedAPath: true, cwd: "rel" });
});

it.each(["file_path", "path", "workdir", "cwd"])("reads the %s key of a plain call", (key) => {
  expect(toolOriginFromArgs({ [key]: "/work/b" }, "/work/a")).toEqual({
    path: "/work/b",
    namedAPath: true,
    cwd: "/work/a",
  });
});

it.each([
  { name: "escaped double quotes with no closing quote", text: `"${'\\"'.repeat(90_000)}` },
  { name: "escaped single quotes with no closing quote", text: `'${"\\'".repeat(90_000)}` },
  { name: "escaped backticks with no closing backtick", text: `\`${"\\`".repeat(90_000)}` },
  { name: "block comment openers with no end", text: "/*a".repeat(60_000) },
])("reads a long program of $name in linear time", ({ text }) => {
  const started = performance.now();
  expect(toolOriginFromArgs({ input: text }, "/work/a")).toEqual({
    namedAPath: false,
    cwd: "/work/a",
  });
  expect(performance.now() - started).toBeLessThan(1000);
});

it("ignores a program longer than the scan limit", () => {
  const input = `${program(`{cmd:"ls",workdir:"/work/b"}`)}${" ".repeat(200_000)}`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});

it("ignores a patch of 150 thousand files without throwing", () => {
  const files = Array.from(
    { length: 150_000 },
    (_, n) => `*** Add File: /work/plain/f${n}.txt\n+x`,
  );
  const input = `*** Begin Patch\n${files.join("\n")}\n*** End Patch`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});

const padTo = (text: string, length: number, filler: string) =>
  text + filler.repeat(length - text.length);

it.each([
  { name: "a patch exactly at the scan limit", length: 200_000, found: true },
  { name: "a patch one past the scan limit", length: 200_001, found: false },
])("reads $name", ({ length, found }) => {
  const head = "*** Begin Patch\n*** Add File: /work/b/x.txt\n+";
  const input = padTo(head, length, "x");
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual(
    found
      ? { path: "/work/b/x.txt", namedAPath: true, cwd: "/work/a" }
      : { namedAPath: false, cwd: "/work/a" },
  );
});

it.each([
  { name: "a program exactly at the scan limit", length: 200_000, found: true },
  { name: "a program one past the scan limit", length: 200_001, found: false },
])("reads $name", ({ length, found }) => {
  const input = padTo(program(`{cmd:"ls",workdir:"/work/b"}`), length, " ");
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual(
    found
      ? { path: "/work/b", namedAPath: true, cwd: "/work/a" }
      : { namedAPath: false, cwd: "/work/a" },
  );
});

it.each([
  { name: "the twentieth", plainBefore: 19, found: true },
  { name: "the twenty-first", plainBefore: 20, found: false },
])("counts $name named file for a repo", ({ plainBefore, found }) => {
  const { repo, plain } = folders();
  const files = Array.from(
    { length: plainBefore },
    (_, n) => `*** Add File: ${plain}/f${n}.txt\n+x`,
  );
  files.push(`*** Add File: ${repo}/late.txt\n+x`);
  const input = `*** Begin Patch\n${files.join("\n")}\n*** End Patch`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: found ? `${repo}/late.txt` : `${plain}/f0.txt`,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it("checks forty-five very long paths for a repo quickly", () => {
  const files = Array.from(
    { length: 45 },
    (_, n) => `*** Add File: /${"a/".repeat(2040)}${n}.txt\n+x`,
  );
  const input = `*** Begin Patch\n${files.join("\n")}\n*** End Patch`;
  const started = performance.now();
  expect(toolOriginFromArgs({ input }, "/work/a").namedAPath).toBe(true);
  expect(performance.now() - started).toBeLessThan(1000);
});

it("reads a workdir from text inside a later string when a regex literal holds a lone quote", () => {
  const input = `const r = /'/; text(await tools.exec_command({cmd:"ls"})); const g = 'tools.exec_command({workdir:"/work/b"})';`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: "/work/b",
    namedAPath: true,
    cwd: "/work/a",
  });
});

it.each([
  { name: "a program workdir", input: program(`{cmd:"ls",workdir:"/${"a/".repeat(40_000)}"}`) },
  {
    name: "a patch path",
    input: `*** Begin Patch\n*** Add File: /${"a/".repeat(75_000)}x.txt\n+x\n*** End Patch`,
  },
])("skips a very deep $name quickly", ({ input }) => {
  const started = performance.now();
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: true, cwd: "/work/a" });
  expect(performance.now() - started).toBeLessThan(1000);
});

it.each([
  { name: "at the length limit", length: 4096, found: true },
  { name: "one past the length limit", length: 4097, found: false },
])("reads a path $name", ({ length, found }) => {
  const path = padTo("/work/", length, "a");
  expect(toolOriginFromArgs({ path }, "/work/a")).toEqual(
    found ? { path, namedAPath: true, cwd: "/work/a" } : { namedAPath: true, cwd: "/work/a" },
  );
});

it.each([
  { name: "an empty workdir in a program", args: { input: program(`{cmd:"ls",workdir:""}`) } },
  { name: "an empty path key", args: { path: "" } },
])("does not count $name as named", ({ args }) => {
  expect(toolOriginFromArgs(args, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});

it("keeps the workdir read before a patch call whose text is not a literal", () => {
  const input = `${program(`{cmd:"ls",workdir:"/work/b"}`)}\ntext(await tools.apply_patch(patchText));`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: "/work/b",
    namedAPath: true,
    cwd: "/work/a",
  });
});

it.each([
  { escape: "\\n", decoded: "\n" },
  { escape: "\\t", decoded: "\t" },
  { escape: "\\r", decoded: "\r" },
  { escape: '\\"', decoded: '"' },
  { escape: "\\'", decoded: "'" },
  { escape: "\\`", decoded: "`" },
  { escape: "\\\\", decoded: "\\" },
])("decodes the escape $escape in a workdir", ({ escape, decoded }) => {
  const input = program(`{cmd:"ls",workdir:"/work/x${escape}y"}`);
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: `/work/x${decoded}y`,
    namedAPath: true,
    cwd: "/work/a",
  });
});

it.each(["\\u00e9", "\\x2f", "\\0", "\\b"])(
  "ignores a workdir written with the escape %s",
  (escape) => {
    const input = program(`{cmd:"ls",workdir:"/work/x${escape}y"}`);
    expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
  },
);

it("ignores a patch written with an escape it cannot decode", () => {
  const patch = "*** Begin Patch\n*** Add File: /work/caf\\u00e9.txt\n+hi\n*** End Patch";
  const input = `tools.apply_patch(${JSON.stringify(patch).replace("\\\\u", "\\u")});`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});

it("loses a workdir that follows a regex literal ending in two slashes on the same line", () => {
  const input = `const r = /\\/\\//; text(await tools.exec_command({cmd:"ls",workdir:"/work/b"}));`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});
it("falls back to no path when reading the arguments throws", () => {
  const args = {
    get path(): string {
      throw new Error("boom");
    },
  };
  expect(toolOriginFromArgs(args, "/work/a")).toEqual({ namedAPath: false, cwd: "/work/a" });
});

it("only looks at the first hundred named files", () => {
  const { repo, plain } = folders();
  const files = Array.from({ length: 100 }, (_, n) => `*** Add File: ${plain}/f${n}.txt\n+x`);
  const input = `*** Begin Patch\n${files.join("\n")}\n*** Add File: ${repo}/late.txt\n+x\n*** End Patch`;
  expect(toolOriginFromArgs({ input }, "/work/a")).toEqual({
    path: `${plain}/f0.txt`,
    namedAPath: true,
    cwd: "/work/a",
  });
});
