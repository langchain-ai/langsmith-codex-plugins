import { expect, it } from "vitest";
import { parseRepository } from "../src/codex-git.js";

it.each([
  ["https://token@github.com/org/repo", "https://github.com/org/repo"],
  ["HTTPS://user:token@example.com:bad/org/repo", "HTTPS://example.com:bad/org/repo"],
])("never sends the credentials in the remote %s", (remote, expected) => {
  const parsed = parseRepository(remote);
  expect(parsed.repository_url).toBe(expected);
  expect(JSON.stringify(parsed)).not.toContain("token");
});

it("keeps the account name of an ssh remote, which is not a secret", () => {
  expect(parseRepository("git@github.com:org/repo.git")).toEqual({
    repository_url: "git@github.com:org/repo",
    repository_provider: "github",
    repository_name: "org/repo",
  });
});
