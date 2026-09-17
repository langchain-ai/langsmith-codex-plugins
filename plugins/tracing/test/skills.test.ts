import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as path from "node:path";

import { skillNamesFromToolCall } from "../src/skills.js";
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

  // The path most rows share, so each row shows the command that differs.
  const SKILL = ".agents/skills/pr-creation/SKILL.md";
  const FOUND = ["pr-creation"];

  // First axis: which shell command counts as reading a skill.
  it.each([
    { command: `/bin/cat ${SKILL}`, names: FOUND },
    { command: `cat ${SKILL} 2>/dev/null; command -v "$tool"`, names: FOUND },
    // Windows separators.
    { command: "cat C:\\repo\\skills\\pr-creation\\SKILL.md", names: FOUND },
    // A redirect character inside quotes is a search pattern, not a rewrite.
    { command: `grep '>' ${SKILL}`, names: FOUND },
    { command: `rg "a>b" ${SKILL}`, names: FOUND },
    // A separator inside quotes does not end the command.
    { command: `cat 'a;b' ${SKILL}`, names: FOUND },
    // An escaped newline in the source literal still ends the command.
    { command: `git diff\ncat ${SKILL}`, names: FOUND },
    { command: "cat notskills/pr-creation/SKILL.md", names: [] },
    { command: `cat ${SKILL}.bak`, names: [] },
    // An unexpanded variable is not a skill name.
    { command: "cat .agents/skills/$name/SKILL.md", names: [] },
    // A read verb counts only at the start of its own command.
    { command: `git log --grep=cat -- ${SKILL}`, names: [] },
    { command: `rg --files .agents/skills | git diff ${SKILL}`, names: [] },
    // Writing the file is not reading it.
    { command: `cat ${SKILL} > copy.md`, names: [] },
    { command: `sed -i '' 's/a/b/' ${SKILL}`, names: [] },
  ])("$command", ({ command, names }) => {
    expect(inCommand(command)).toEqual(names);
  });

  it.each([
    { quote: "double", cmd: `"cat ${SKILL}"` },
    { quote: "single", cmd: `'cat ${SKILL}'` },
    { quote: "backtick", cmd: `\`cat ${SKILL}\`` },
  ])("reads a $quote-quoted cmd string", ({ cmd }) => {
    expect(skills(`text(await tools.exec_command({cmd:${cmd}}));`)).toEqual(FOUND);
  });

  // Second axis: pulling the cmd literals out of the surrounding JS program.
  it.each([
    {
      what: "collects every skill across several calls in one program",
      program:
        `const results = await Promise.allSettled([\n` +
        `tools.exec_command({cmd:"cat .agents/skills/pr-creation/SKILL.md .agents/skills/local-development/SKILL.md"}),\n` +
        `tools.exec_command({"cmd":"cat /root/.codex/skills/.system/openai-docs/SKILL.md"})]);`,
      names: ["pr-creation", "local-development", "openai-docs"],
    },
    {
      what: "ignores JS that is not an exec_command call",
      program:
        `text(ALL_TOOLS.filter(x=>/exec/.test(x.name)));\n` +
        `text(await tools.exec_command({cmd:"cat .agents/skills/langster-safety/SKILL.md"}));`,
      names: ["langster-safety"],
    },
  ])("$what", ({ program, names }) => {
    expect(skills(program)).toEqual(names);
  });

  it("reads the pre-0.153 exec_command argument object", () => {
    expect(
      skillNamesFromToolCall("exec_command", {
        cmd: "cat .agents/skills/local-development/SKILL.md",
      }),
    ).toEqual(["local-development"]);
  });

  // A shell tool would find a skill in this program, so only the tool name empties it.
  it.each(["apply_patch", "shell", undefined])("ignores the %s tool", (toolName) => {
    const program = `text(await tools.exec_command({cmd:"cat ${SKILL}"}));`;
    expect(skillNamesFromToolCall(toolName, program)).toEqual([]);
  });

  it("scans a long run of skills segments in linear time", () => {
    const crafted = `cat /skills/${"/skills/!".repeat(20_000)}`;
    const started = performance.now();
    expect(inCommand(crafted)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

const FILE = "/home/codex-user/.codex/sessions/2026/09/14/rollout-skills.jsonl";

async function runsFor(transcript: string) {
  const { client, callSpy } = mockClient();
  vol.fromJSON({ [FILE]: transcript });

  seedFullLaunchEvidence();
  await convertToRunTree(
    { transcript_path: FILE, turn_id: "019900aa-tttt-0001" },
    { client, projectName: "codex" },
  );

  const { data } = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(data);
  return {
    execs: runs.filter((run) => run.name === "exec"),
    skills: runs.filter((run) => run.extra?.metadata?.ls_skill_name != null),
    childrenOf: (id: string) => runs.filter((run) => run.parent_run_id === id),
  };
}

async function fixture(): Promise<string> {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return fs.readFile(path.join(__dirname, "sessions/2026/09/14/rollout-skills.jsonl"), {
    encoding: "utf-8",
  });
}

it("emits one run per skill, under the call that read it", async () => {
  const { execs, skills, childrenOf } = await runsFor(await fixture());

  // The first exec reads two skills, the second reads none.
  expect(execs.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([undefined, undefined]);
  expect(skills.map((run) => run.name)).toEqual(["widget-report", "teapot-check"]);
  expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([
    "widget-report",
    "teapot-check",
  ]);
  expect(skills.map((run) => run.run_type)).toEqual(["tool", "tool"]);

  const [reader, other] = execs;
  expect(skills.map((run) => run.parent_run_id)).toEqual([reader.id, reader.id]);
  expect(childrenOf(other.id)).toEqual([]);
});

it("emits a run for each read, so a re-read in a later call counts again", async () => {
  const reread = (await fixture()).replace(
    "cat widgets.txt",
    "cat .agents/skills/widget-report/SKILL.md",
  );
  const { execs, skills } = await runsFor(reread);

  expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([
    "widget-report",
    "teapot-check",
    "widget-report",
  ]);
  // The repeat hangs off the second call, not the first.
  expect(skills.at(-1)?.parent_run_id).toBe(execs[1].id);
});

it("carries the contract keys onto a skill run", async () => {
  const { skills } = await runsFor(await fixture());
  const meta = skills[0].extra?.metadata as Record<string, unknown>;

  expect(meta.ls_agent_type).toBe("root");
  expect(meta.ls_trace_schema_version).toBe("coding-agent-v1");
  expect(meta.thread_id).toBe("019900aa-0000-7000-8000-skillsthread");
  expect(meta.turn_id).toBe("019900aa-tttt-0001");
  // A child inherits the exec run's metadata, so usage has to be reset or the turn double-counts.
  expect(meta.usage_metadata).toBeUndefined();
});

it("keeps the exec run's usage on the exec run", async () => {
  const { execs } = await runsFor(await fixture());
  expect(execs[0].extra?.metadata?.usage_metadata).toMatchObject({ total_tokens: 12 });
});
