import { describe, expect, it } from "vitest";

import { normalizedPath } from "../src/utils/skillPaths.js";

describe("normalizedPath", () => {
  it.each([
    { path: "~/a/SKILL.md", home: "/h", cwd: undefined, expected: "/h/a/SKILL.md" },
    { path: "$HOME/a", home: "/h", cwd: undefined, expected: "/h/a" },
    { path: "${HOME}/a", home: "/h", cwd: undefined, expected: "/h/a" },
    { path: "$HOMEDIR/a", home: "/h", cwd: "/c", expected: "/c/$HOMEDIR/a" },
    { path: "~/a", home: "C:\\Users\\a", cwd: undefined, expected: "C:/Users/a/a" },
    { path: "a\\b", home: "/h", cwd: "/c", expected: "/c/a/b" },
    { path: "a/b", home: "/h", cwd: "C:\\w", expected: "C:/w/a/b" },
    { path: "a/b", home: "/h", cwd: undefined, expected: "a/b" },
    { path: "C:/x/y", home: "/h", cwd: "/c", expected: "C:/x/y" },
    { path: "/x/./y//z", home: "/h", cwd: "/c", expected: "/x/y/z" },
    { path: "/x/y/../../../z", home: "/h", cwd: "/c", expected: "/z" },
    { path: "C:/x/../../z", home: "/h", cwd: "/c", expected: "C:/z" },
    { path: "../a", home: "/h", cwd: undefined, expected: "a" },
  ])("turns $path into $expected", ({ path, home, cwd, expected }) => {
    expect(normalizedPath(path, home, cwd)).toBe(expected);
  });
});
