import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { toolOriginFromArgs } from "../src/tool-path.js";

const program = (...calls: string[]) =>
  calls.map((call) => `text(await tools.exec_command(${call}));`).join("\n");

const SESSION = "/work/a";
const found = (path: string) => ({ path, namedAPath: true, cwd: SESSION });
const none = { namedAPath: false, cwd: SESSION };
const exec = (call: string) => program(call);
const patchText = (file: string) =>
  JSON.stringify(`*** Begin Patch\n*** Add File: ${file}\n+hi\n*** End Patch`);
const lsIn = (dir: string) => exec(`{cmd:"ls",workdir:"${dir}"}`);

it.each([
  ["a workdir inside the JS program Codex wraps shell calls in", lsIn("/work/b")],
  ["single quotes", exec(`{cmd:'ls', workdir:'/work/b'}`)],
  ["backticks", exec("{cmd:`ls`, workdir:`/work/b`}")],
  ["a quoted workdir key", exec(`{"cmd":"ls","workdir":"/work/b"}`)],
  ["a single-quoted workdir key", exec(`{cmd:"ls",'workdir':"/work/b"}`)],
  ["a workdir that comes first in the object", exec(`{workdir:"/work/b",cmd:"ls"}`)],
  ["a real workdir after a comment holding a quote", `// don't use "x"\n${lsIn("/work/b")}`],
  ["a workdir after a block comment", exec(`{cmd:"ls", /* r */ workdir:"/work/b"}`)],
  [
    "a workdir after a line comment",
    `text(await tools.exec_command({cmd:"ls", // r\n workdir:"/work/b"}));`,
  ],
  [
    "a workdir after a block comment holding a closing brace",
    exec(`{cmd:"ls", /* } */ workdir:"/work/b"}`),
  ],
  [
    "a workdir after a line comment holding a closing brace",
    `text(await tools.exec_command({cmd:"ls", // }\n workdir:"/work/b"}));`,
  ],
  [
    "a program that mentions a patch inside a command",
    exec(`{cmd:"echo '*** Begin Patch'",workdir:"/work/b"}`),
  ],
  [
    "the call's own workdir when an inner object has one first",
    exec(`{cmd:"ls",env:{workdir:"/work/plain"},workdir:"/work/b"}`),
  ],
  [
    "the first workdir when one program names several",
    exec(`{cmd:"ls",workdir:"/work/b"}`) + lsIn("/work/c"),
  ],
  [
    "a template holding a dollar sign and a brace but no placeholder",
    exec("{cmd:`ls`,workdir:`/work/$b{x}`}"),
    "/work/$b{x}",
  ],
  [
    "a patch applied inside the program",
    `text(await tools.apply_patch(${patchText("/work/b/x.txt")}));`,
    "/work/b/x.txt",
  ],
  ["a bare apply_patch call", `apply_patch(${patchText("/work/b/x.txt")});`, "/work/b/x.txt"],
  [
    "a patch that starts after blank space",
    "\n  *** Begin Patch\n*** Add File: /work/b/x.txt\n+hi\n*** End Patch",
    "/work/b/x.txt",
  ],
  [
    "every file of a patch, so the first one wins",
    "*** Begin Patch\n*** Update File: /work/b/x.txt\n@@\n-x\n+y\n*** Update File: /work/c/y.txt\n@@\n-x\n+y\n*** End Patch",
    "/work/b/x.txt",
  ],
  [
    "a new file added by a relative path into another folder",
    "*** Begin Patch\n*** Add File: ../b/new.txt\n+hi\n*** End Patch",
    "/work/b/new.txt",
  ],
  ["a relative workdir, resolved from the session folder", lsIn("../b")],
])("reads %s", (_name, input, path = "/work/b") => {
  expect(toolOriginFromArgs({ input }, SESSION)).toEqual(found(path));
});

it.each([
  ["a workdir that only appears in a line comment", `// workdir: "/work/b"\n${exec(`{cmd:"ls"}`)}`],
  [
    "a workdir that only appears in a block comment",
    `/* {workdir: "/work/b"} */\n${exec(`{cmd:"ls"}`)}`,
  ],
  ["an object inside a line comment", `// {workdir:"/work/plain"}\n${exec(`{cmd:"ls"}`)}`],
  [
    "an object inside a multi-line block comment",
    `/* first\n{workdir:"/work/plain"}\n*/\n${exec(`{cmd:"ls"}`)}`,
  ],
  ["an object inside a double-quoted string", exec(`{cmd:"echo {workdir:'/work/plain'}"}`)],
  ["an object inside a single-quoted string", exec(`{cmd:'echo {workdir:"/work/plain"}'}`)],
  ["an object inside a backtick string", exec("{cmd:`echo {workdir:'/work/plain'}`}")],
  [
    "text inside a command string",
    exec(`{cmd:"grep \\"workdir: '/work/plain'\\" notes.md"}`) +
      exec(`{cmd:'grep "workdir: \\'/work/plain\\'" notes.md'}`) +
      exec('{cmd:`echo workdir: "/work/plain"`}') +
      exec(`{cmd:"workdir: '/work/plain'"}`),
  ],
  ["a template value with a placeholder", exec("{cmd:`ls`,workdir:`${base}/repo`}")],
  ["a placeholder mid-path", exec("{cmd:`ls`,workdir:`/work/${b}`}")],
  ["a value joined from two strings", exec(`{cmd:"ls",workdir:"/w/"+"repo"}`)],
  ["a key that belongs to a property access", exec(`{cmd:"ls", opts.workdir:"/work/plain"}`)],
  ["a workdir only in an object inside the call", exec(`{cmd:"ls",env:{workdir:"/work/plain"}}`)],
  [
    "a workdir only in an object outside the call",
    `const config = {workdir:"/work/plain"};\n${exec(`{cmd:"ls"}`)}`,
  ],
  [
    "a later call that is not an exec_command",
    `${exec(`{cmd:"ls"}`)}\ntext(await tools.other({cmd:"ls",workdir:"/work/plain"}));`,
  ],
  [
    "an object assigned to a variable named like the call",
    `const exec_command = {cmd:"ls",workdir:"/work/plain"};`,
  ],
  [
    "a call name that only ends like exec_command",
    `text(await $exec_command({cmd:"ls",workdir:"/work/plain"}));`,
  ],
  [
    "an exec_command of another object",
    `text(await foo.exec_command({cmd:"ls",workdir:"/work/plain"}));`,
  ],
  [
    "a name like apply_patch that only holds text",
    `const apply_patch = ${patchText("/work/plain/x.txt")};`,
  ],
  ["an apply_patch of another object", `foo.apply_patch(${patchText("/work/plain/x.txt")});`],
  ["a patch text sent to another function", `f(${patchText("/work/plain/x.txt")});`],
  [
    "a patch path built with a placeholder",
    "tools.apply_patch(`*** Begin Patch\n*** Add File: ${base}/x.txt\n+hi\n*** End Patch`);",
  ],
  [
    "a patch text joined from several strings",
    `tools.apply_patch(${JSON.stringify("*** Begin Patch\n*** Add File: /work/plain/")} + name);`,
  ],
  [
    "a patch with no opening bracket after the name",
    `tools.apply_patch ; ${patchText("/work/plain/x.txt")})`,
  ],
  ["a program with no workdir", exec(`{cmd:"ls"}`)],
])("ignores %s", (_name, input) => {
  expect(toolOriginFromArgs({ input }, SESSION)).toEqual(none);
});

it.each([
  ["a workdir on the plain function call", { cmd: "ls", workdir: "/work/b" }, "/work/b"],
  [
    "a relative path that names a missing folder",
    { file_path: "../b/deeper/new.txt" },
    "/work/b/deeper/new.txt",
  ],
  ["the file_path key", { file_path: "/work/b" }, "/work/b"],
  ["the path key", { path: "/work/b" }, "/work/b"],
  ["the workdir key", { workdir: "/work/b" }, "/work/b"],
  ["the cwd key", { cwd: "/work/b" }, "/work/b"],
])("reads %s", (_name, args, path) => {
  expect(toolOriginFromArgs(args, SESSION)).toEqual(found(path));
});

it.each([
  ["no path at all", { cmd: "pwd" }],
  ["an empty path key", { path: "" }],
  ["an empty workdir in a program", { input: exec(`{cmd:"ls",workdir:""}`) }],
])("does not count %s as named", (_name, args) => {
  expect(toolOriginFromArgs(args, SESSION)).toEqual(none);
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
