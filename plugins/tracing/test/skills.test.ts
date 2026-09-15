import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as path from "node:path";

import { skillNamesFromToolCall } from "../src/metadata.js";
import { convertToRunTree } from "../src/trace.js";
import { mockClient } from "./utils/mock_client.js";
import { getAssumedTreeFromCalls } from "./utils/tree.js";

vi.mock("node:fs/promises", async () => {
  const { fs } = await import("memfs");
  return fs.promises;
});

vi.mock("node:fs", async () => {
  const { fs } = await import("memfs");
  return fs;
});

beforeEach(() => vol.reset());
afterEach(() => vi.unstubAllEnvs());

describe("skillNamesFromToolCall", () => {
  // Commands below follow the shapes seen in real 0.153/0.154 rollouts.
  const skills = (program: string) => skillNamesFromToolCall("exec", program);
  const inCommand = (command: string) =>
    skills(`text(await tools.exec_command({cmd:${JSON.stringify(command)}}));`);

  it.each([
    { command: "cat .agents/skills/.system/openai-docs/SKILL.md", names: ["openai-docs"] },
    { command: "/bin/cat .agents/skills/pr-creation/SKILL.md", names: ["pr-creation"] },
    { command: "cat C:\\repo\\skills\\pr-creation\\SKILL.md", names: ["pr-creation"] },
    {
      command: `cat .agents/skills/langster-safety/SKILL.md 2>/dev/null; command -v "$tool"`,
      names: ["langster-safety"],
    },
    {
      command:
        "cat .agents/skills/pr-creation/SKILL.md; head -40 .agents/skills/pr-creation/SKILL.md",
      names: ["pr-creation"],
    },
    // A redirect character inside quotes is a search pattern, not a rewrite.
    { command: "grep '>' .agents/skills/pr-creation/SKILL.md", names: ["pr-creation"] },
    { command: `rg "a>b" .agents/skills/pr-creation/SKILL.md`, names: ["pr-creation"] },
    { command: "sed 's/x/>/' .agents/skills/pr-creation/SKILL.md", names: ["pr-creation"] },
    { command: "rg -e '->' .agents/skills/pr-creation/SKILL.md", names: ["pr-creation"] },
    // A separator inside quotes does not end the command.
    { command: "cat 'a;b' .agents/skills/pr-creation/SKILL.md", names: ["pr-creation"] },
    { command: "cat notskills/pr-creation/SKILL.md", names: [] },
    { command: "cat skills/pr-creation/SKILL.md.bak", names: [] },
    // An unexpanded variable is not a skill name.
    { command: "cat .agents/skills/$name/SKILL.md", names: [] },
    // A read verb counts only at the start of its own command.
    { command: "git log --grep=cat -- .agents/skills/pr-creation/SKILL.md", names: [] },
    { command: "git diff HEAD -- .agents/skills/pr-creation/SKILL.md\ncat AGENTS.md", names: [] },
    {
      command: "rg --files .agents/skills | git diff .agents/skills/pr-creation/SKILL.md",
      names: [],
    },
    { command: "cat skills/pr-creation/SKILL.md > copy.md", names: [] },
    { command: "sed -i '' 's/a/b/' skills/pr-creation/SKILL.md", names: [] },
  ])("$command", ({ command, names }) => {
    expect(inCommand(command)).toEqual(names);
  });

  it.each([
    { quote: "double", cmd: `"cat .agents/skills/pr-creation/SKILL.md"` },
    { quote: "single", cmd: `'cat .agents/skills/pr-creation/SKILL.md'` },
    { quote: "backtick", cmd: "`cat .agents/skills/pr-creation/SKILL.md`" },
  ])("reads a $quote-quoted cmd string", ({ cmd }) => {
    expect(skills(`text(await tools.exec_command({cmd:${cmd}}));`)).toEqual(["pr-creation"]);
  });

  it("decodes escapes so an escaped newline still ends the command", () => {
    expect(inCommand("git diff\ncat .agents/skills/pr-creation/SKILL.md")).toEqual(["pr-creation"]);
  });

  it("finds every skill across the commands of one program", () => {
    expect(
      skills(
        `const results = await Promise.allSettled([\n` +
          `tools.exec_command({cmd:"cat .agents/skills/pr-creation/SKILL.md .agents/skills/local-development/SKILL.md"}),\n` +
          `tools.exec_command({"cmd":"cat /root/.codex/skills/.system/openai-docs/SKILL.md"})]);`,
      ),
    ).toEqual(["pr-creation", "local-development", "openai-docs"]);
  });

  it("is unaffected by the JS around the commands", () => {
    expect(
      skills(
        `text(ALL_TOOLS.filter(x=>/exec/.test(x.name)));\n` +
          `text(await tools.exec_command({cmd:"cat .agents/skills/langster-safety/SKILL.md"}));`,
      ),
    ).toEqual(["langster-safety"]);
  });

  it("reads the pre-0.153 exec_command argument object", () => {
    expect(
      skillNamesFromToolCall("exec_command", {
        cmd: "cat .agents/skills/local-development/SKILL.md",
      }),
    ).toEqual(["local-development"]);
  });

  it.each(["apply_patch", "shell", undefined])("ignores the %s tool", (toolName) => {
    expect(skillNamesFromToolCall(toolName, "cat skills/pr-creation/SKILL.md")).toEqual([]);
  });

  it("scans a crafted run of skills segments in linear time", () => {
    const crafted = `cat /skills/${"/skills/!".repeat(20_000)}`;
    const started = performance.now();
    expect(inCommand(crafted)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

it("tags the tool run that loaded a skill", async () => {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const file = "/home/codex-user/.codex/sessions/2026/09/14/rollout-skills.jsonl";

  const { client, callSpy } = mockClient();
  vol.fromJSON({
    [file]: await fs.readFile(path.join(__dirname, "sessions/2026/09/14/rollout-skills.jsonl"), {
      encoding: "utf-8",
    }),
  });

  seedFullLaunchEvidence();
  await convertToRunTree(
    { transcript_path: file, turn_id: "019900aa-tttt-0001" },
    { client, projectName: "codex" },
  );

  const { data } = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const skillNames = Object.values(data)
    .filter((run) => run.run_type === "tool")
    .map((run) => run.extra?.metadata?.ls_skill_name);

  // The first exec reads two skills and the second reads none, so the turn tags one name.
  expect(skillNames).toEqual(["widget-report", undefined]);
});
