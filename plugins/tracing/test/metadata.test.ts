import { describe, expect, it } from "vitest";
import { skillNameFromToolCall } from "../src/metadata.js";

// Unit coverage for the provisional skill-name extraction. Shape-independent, so
// it holds regardless of how a real Codex skill rollout ends up looking — the
// tool-name / arg matching in skillNameFromToolCall is what a rollout sample
// will tighten (see the TODO there).
describe("skillNameFromToolCall", () => {
  it("returns the skill name for a skill tool call", () => {
    expect(skillNameFromToolCall("skill", { skill: "deep-research" })).toBe("deep-research");
    expect(skillNameFromToolCall("invoke_skill", { name: "deep-research" })).toBe("deep-research");
  });

  it("stays inert for ordinary tool calls (no false positives)", () => {
    expect(skillNameFromToolCall("exec_command", { cmd: "pwd" })).toBeUndefined();
    expect(skillNameFromToolCall("spawn_agent", { skill: "x" })).toBeUndefined();
    expect(skillNameFromToolCall(undefined, {})).toBeUndefined();
  });

  it("returns undefined when the skill name is missing or non-string", () => {
    expect(skillNameFromToolCall("skill", {})).toBeUndefined();
    expect(skillNameFromToolCall("skill", { skill: 42 })).toBeUndefined();
    expect(skillNameFromToolCall("skill", "not-an-object")).toBeUndefined();
    expect(skillNameFromToolCall("skill", null)).toBeUndefined();
  });
});
