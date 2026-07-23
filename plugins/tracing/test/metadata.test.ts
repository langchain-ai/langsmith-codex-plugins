import { describe, expect, it } from "vitest";
import { skillNameFromToolCall } from "../src/metadata.js";

// Unit coverage for ls_skill_name: an exec_command that READS a
// .../skills/<name>/SKILL.md file. Writes/edits/deletes and other tools must not match.
describe("skillNameFromToolCall", () => {
  it("extracts the skill from an explicit `cat .../skills/<name>/SKILL.md`", () => {
    expect(
      skillNameFromToolCall("exec_command", {
        cmd: "cat /home/u/.codex/skills/.system/openai-docs/SKILL.md",
      }),
    ).toBe("openai-docs");
  });

  it("handles a shell-wrapped read and other read commands (sed/rg)", () => {
    expect(
      skillNameFromToolCall("exec_command", {
        cmd: "/bin/zsh -lc 'cat /home/u/.codex/skills/.system/skill-creator/SKILL.md'",
      }),
    ).toBe("skill-creator");
    expect(
      skillNameFromToolCall("exec_command", {
        cmd: "sed -n '1,80p' /home/u/.codex/skills/.system/skill-creator/SKILL.md",
      }),
    ).toBe("skill-creator");
    // An in-pattern `skills/` substring must not steal the match from the real path.
    expect(
      skillNameFromToolCall("exec_command", {
        cmd: 'rg -n "init_skill|skills/|Naming" /home/u/.codex/skills/.system/skill-creator/SKILL.md',
      }),
    ).toBe("skill-creator");
  });

  it("supports project-local skills and raw-string args", () => {
    expect(
      skillNameFromToolCall("exec_command", { cmd: "cat ./.codex/skills/my-skill/SKILL.md" }),
    ).toBe("my-skill");
    // Raw JSON string args still work.
    expect(skillNameFromToolCall("exec_command", '{"cmd":"cat repo/skills/foo/SKILL.md"}')).toBe(
      "foo",
    );
  });

  it("is not fooled by a verb-like segment in the skill name", () => {
    // `cp-tool` contains "cp"; it's a read (cat), so it must still resolve.
    expect(
      skillNameFromToolCall("exec_command", { cmd: "cat /home/u/.codex/skills/cp-tool/SKILL.md" }),
    ).toBe("cp-tool");
  });

  it("only fires for exec_command, not other tools", () => {
    const args = { cmd: "cat /home/u/.codex/skills/.system/openai-docs/SKILL.md" };
    expect(skillNameFromToolCall("exec", args)).toBeUndefined();
    expect(skillNameFromToolCall("apply_patch", args)).toBeUndefined();
    expect(skillNameFromToolCall("shell", args)).toBeUndefined();
    expect(skillNameFromToolCall(undefined, args)).toBeUndefined();
  });

  it("does not fire for writes, edits, or deletes of a SKILL.md", () => {
    const p = "/home/u/.codex/skills/.system/openai-docs/SKILL.md";
    expect(skillNameFromToolCall("exec_command", { cmd: `rm ${p}` })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: `mv ${p} ${p}.bak` })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: `cp template ${p}` })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: `sed -i 's/a/b/' ${p}` })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: `echo hi > ${p}` })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: `printf x >> ${p}` })).toBeUndefined();
  });

  it("stays inert for reads that aren't a skill file", () => {
    expect(skillNameFromToolCall("exec_command", { cmd: "pwd" })).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", { cmd: "cat README.md" })).toBeUndefined();
    // A SKILL.md not under a `skills/` root is not a skill invocation.
    expect(
      skillNameFromToolCall("exec_command", { cmd: "cat /repo/docs/SKILL.md" }),
    ).toBeUndefined();
    // `skills/` present but no SKILL.md read.
    expect(
      skillNameFromToolCall("exec_command", { cmd: "ls /home/u/.codex/skills/" }),
    ).toBeUndefined();
  });

  it("tolerates missing / odd args", () => {
    expect(skillNameFromToolCall("exec_command", {})).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", null)).toBeUndefined();
    expect(skillNameFromToolCall("exec_command", 42)).toBeUndefined();
    expect(skillNameFromToolCall(undefined, undefined)).toBeUndefined();
  });
});
