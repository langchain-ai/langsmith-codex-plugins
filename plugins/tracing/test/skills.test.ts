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

async function runsFor(
  transcript: string,
  { metadata, muted }: { metadata?: Record<string, unknown>; muted?: boolean } = {},
) {
  const { client, callSpy } = mockClient();
  vol.fromJSON({ [FILE]: transcript });

  // An unlisted turn reads as metadata mode, which is how a muted turn arrives.
  if (!muted) seedFullLaunchEvidence();
  await convertToRunTree(
    { transcript_path: FILE, turn_id: "019900aa-tttt-0001" },
    { client, projectName: "codex", metadata },
  );

  const { data } = await getAssumedTreeFromCalls(callSpy.mock.calls, client);
  const runs = Object.values(data);
  return {
    turn: runs.find((run) => run.name === "openai.codex"),
    execs: runs.filter((run) => run.name === "exec"),
    skills: runs.filter((run) => run.name === "Skill"),
    childrenOf: (id: string) => runs.filter((run) => run.parent_run_id === id),
  };
}

async function fixture(): Promise<string> {
  const fs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return fs.readFile(path.join(__dirname, "sessions/2026/09/14/rollout-skills.jsonl"), {
    encoding: "utf-8",
  });
}

// An end event marks the call that read both skills as failed.
function withFailedRead(transcript: string): string {
  const end =
    `{"timestamp":"2026-09-14T00:00:06.500Z","type":"event_msg","payload":` +
    `{"type":"exec_command_end","call_id":"call_read_skills","turn_id":"019900aa-tttt-0001",` +
    `"stdout":"","stderr":"cat: no such file","aggregated_output":"cat: no such file",` +
    `"exit_code":1,"status":"failed"}}`;
  const lines = transcript.trimEnd().split("\n");
  const at = lines.findIndex((line) => line.includes("custom_tool_call_output"));
  lines.splice(at + 1, 0, end);
  return `${lines.join("\n")}\n`;
}

it("emits one turn-level Skill run per skill read", async () => {
  const { turn, execs, skills, childrenOf } = await runsFor(await fixture());

  // The first exec reads two skills, the second reads none.
  expect(skills.map((run) => run.name)).toEqual(["Skill", "Skill"]);
  expect(skills.map((run) => run.run_type)).toEqual(["tool", "tool"]);
  expect(skills.map((run) => run.inputs)).toEqual([
    { input: { skill: "widget-report" } },
    { input: { skill: "teapot-check" } },
  ]);

  // Siblings of the exec run, not children of it.
  expect(turn).toBeDefined();
  expect(execs.map((run) => run.parent_run_id)).toEqual([turn?.id, turn?.id]);
  expect(skills.map((run) => run.parent_run_id)).toEqual([turn?.id, turn?.id]);
  for (const exec of execs) expect(childrenOf(exec.id)).toEqual([]);
});

it("reports the read call's own success on the Skill run", async () => {
  const { skills } = await runsFor(await fixture());
  expect(skills.map((run) => run.outputs)).toEqual([
    { output: { commandName: "widget-report", success: true } },
    { output: { commandName: "teapot-check", success: true } },
  ]);
});

it("reports success false when the call that read the skills failed", async () => {
  const { execs, skills } = await runsFor(withFailedRead(await fixture()));

  expect(execs[0].error).toBeTruthy();
  // One call read both skills, so one failure marks both.
  expect(skills.map((run) => run.outputs)).toEqual([
    { output: { commandName: "widget-report", success: false } },
    { output: { commandName: "teapot-check", success: false } },
  ]);
});

it("spans a Skill run over the window of the call that read it", async () => {
  const { execs, skills } = await runsFor(await fixture());
  const [reader] = execs;

  // start_time is an ISO string with a sub-millisecond ordering suffix, end_time epoch millis.
  const ms = (value: unknown) => (typeof value === "number" ? value : Date.parse(String(value)));
  expect(ms(reader.start_time)).toBeLessThan(ms(reader.end_time));

  for (const skill of skills) {
    expect(ms(skill.start_time)).toBe(ms(reader.start_time));
    expect(ms(skill.end_time)).toBe(ms(reader.end_time));
  }
});

it("emits no Skill run for a call that reads no skill", async () => {
  const noSkills = (await fixture()).replaceAll(".agents/skills/", ".agents/notes/");
  const { execs, skills } = await runsFor(noSkills);

  expect(execs).toHaveLength(2);
  expect(skills).toEqual([]);
});

it("emits a run for each read, so a re-read in a later call counts again", async () => {
  const reread = (await fixture()).replace(
    "cat widgets.txt",
    "cat .agents/skills/widget-report/SKILL.md",
  );
  const { skills } = await runsFor(reread);

  expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([
    "widget-report",
    "teapot-check",
    "widget-report",
  ]);
});

it("carries the contract keys onto a muted Skill run", async () => {
  // A muted run drops the metadata it would inherit, so these come from the run itself.
  const { skills } = await runsFor(await fixture(), { muted: true });
  const meta = skills[0].extra?.metadata as Record<string, unknown>;

  expect(meta.ls_agent_type).toBe("root");
  expect(meta.ls_trace_schema_version).toBe("coding-agent-v1");
  expect(meta.thread_id).toBe("019900aa-0000-7000-8000-skillsthread");
  expect(meta.turn_id).toBe("019900aa-tttt-0001");
  expect(meta.ls_skill_name).toBe("widget-report");
});

it("drops a configured usage_metadata from a Skill run", async () => {
  // Configured metadata reaches every run, so the reset has to outrank it.
  const configured = { usage_metadata: { total_tokens: 999 } };
  const { turn, skills } = await runsFor(await fixture(), { metadata: configured });

  expect(turn?.extra?.metadata?.usage_metadata).toMatchObject({ total_tokens: 999 });
  expect(skills[0].extra?.metadata?.usage_metadata).toBeUndefined();
  expect(skills[1].extra?.metadata?.usage_metadata).toBeUndefined();
});
