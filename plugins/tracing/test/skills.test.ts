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
  // Programs and commands below are abridged from real 0.153/0.154 rollouts.
  const skills = (program: string) => skillNamesFromToolCall("exec", program);
  const inCommand = (command: string) =>
    skills(`text(await tools.exec_command({cmd:${JSON.stringify(command)}}));`);

  it.each([
    { command: "cat .agents/skills/.system/openai-docs/SKILL.md", names: ["openai-docs"] },
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
    { command: "cat notskills/pr-creation/SKILL.md", names: [] },
    { command: "cat skills/pr-creation/SKILL.md.bak", names: [] },
    { command: "git diff HEAD -- .agents/skills/pr-creation/SKILL.md\ncat AGENTS.md", names: [] },
    { command: "rg --files .agents/skills | rg 'pr-creation/SKILL.md'", names: [] },
    { command: "cat skills/pr-creation/SKILL.md > copy.md", names: [] },
    { command: "sed -i '' 's/a/b/' skills/pr-creation/SKILL.md", names: [] },
  ])("$command", ({ command, names }) => {
    expect(inCommand(command)).toEqual(names);
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
    { transcript_path: file, turn_id: "01a0a326-99d7-71e3-9dce-8eb5d10f08b3" },
    { client, projectName: "codex" },
  );

  const { data } = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const skillNames = Object.values(data)
    .filter((run) => run.run_type === "tool")
    .map((run) => run.extra?.metadata?.ls_skill_name);

  // The first exec reads two skills and the second reads none, so the turn tags one name.
  expect(skillNames).toEqual(["widget-report", undefined]);
});
