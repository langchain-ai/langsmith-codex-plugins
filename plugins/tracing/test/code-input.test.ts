import { expect, it } from "vitest";
import { toolCodeInput } from "../src/utils/codeInput.js";

it.each([
  ["python -c 'print(1)'", "python", "print(1)"],
  ["/usr/bin/python3.14 -I -u -c 'print(1)' -- -x", "python", "print(1)"],
  ["python -c'print(1)'", "python", "print(1)"],
  ['python -c "print(\\\"hello\\\")"', "python", 'print("hello")'],
  ["python -c 'print(\"$HOME\")'", "python", 'print("$HOME")'],
  ["node -e 'console.log(1)'", "javascript", "console.log(1)"],
  ["/usr/bin/node --input-type=module --eval='await foo()'", "javascript", "await foo()"],
  ["node --no-warnings --eval 'console.log(1)' -- --flag", "javascript", "console.log(1)"],
  ["node -p '1 + 1'", "javascript", "1 + 1"],
  ["node --print='1 + 1'", "javascript", "1 + 1"],
  ["node -e'console.log(1)'", "javascript", "console.log(1)"],
  ["env FOO=bar /usr/bin/node -e 'console.log(1)'", "javascript", "console.log(1)"],
  ["env -- python -c 'print(1)'", "python", "print(1)"],
  ["FOO=bar command -- python -c 'print(1)'", "python", "print(1)"],
  ["bash -lc \"python -c 'print(1)'\"", "python", "print(1)"],
  ["bash -c -- \"node -e 'console.log(1)'\"", "javascript", "console.log(1)"],
  ["python -c ''", "python", ""],
])("extracts inline code from %s", (command, language, code) => {
  expect(toolCodeInput("exec_command", { cmd: command })).toEqual({ code, language });
});

it.each([
  "ls -la",
  "python script.py",
  "node script.js",
  "python -- -c 'print(1)'",
  "node -- --eval 'console.log(1)'",
  "python -m module -c 'print(1)'",
  "node --require module -e 'console.log(1)'",
  "python -c",
  "python -c 'unterminated",
  'node -e "$CODE"',
  'node -e "`cat script.js`"',
  "node -e $CODE",
  "python -c 'print(1)' && echo done",
  "python -c 'print(1)' | cat",
  "python -c 'print(1)' > output.txt",
  "python -c 'print(1)'\necho done",
  "bash -lc \"python -c 'print(1)'; echo done\"",
  "python -c 'print(1)' # comment",
  "cat <<'PY'\nprint(1)\nPY",
  "bash -- -c 'node -e foo'",
  `bash -c 'python -c "$1"' arg`,
  `bash -c 'python -c "print(1)"' extra`,
  `bash -o -c 'python -c "print(1)"'`,
])("keeps ambiguous or non-inline commands as shell: %s", (command) => {
  expect(toolCodeInput("shell_command", { command })).toEqual({ code: command, language: "shell" });
});

it("uses argv without reinterpreting code as shell syntax", () => {
  expect(
    toolCodeInput("local_shell_call", { command: ["/usr/bin/python3", "-c", "print('$HOME')"] }),
  ).toEqual({
    code: "print('$HOME')",
    language: "python",
  });
  expect(
    toolCodeInput("shell", { command: ["/bin/bash", "-lc", "node -e 'console.log(1)'"] }),
  ).toEqual({
    code: "console.log(1)",
    language: "javascript",
  });
  expect(toolCodeInput("shell", { command: ["echo", "a'b", "$(whoami)"] })).toEqual({
    code: "echo 'a'\\''b' '$(whoami)'",
    language: "shell",
  });
});

it.each([
  ["exec", { code: "text(await tools.exec_command({cmd:'ls'}))" }],
  ["mcp__service__shell", { command: "node -e 'foo'" }],
  ["search", { cmd: "node -e 'foo'" }],
  ["exec_command", {}],
  ["exec_command", { command: ["python", 1] }],
  ["exec_command", { command: [] }],
  ["exec_command", "node -e 'foo'"],
  [undefined, { command: "ls" }],
])("does not infer code for %s with %j", (name, args) => {
  expect(toolCodeInput(name, args)).toBeUndefined();
});
