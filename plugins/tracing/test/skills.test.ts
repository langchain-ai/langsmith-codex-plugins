import { seedFullLaunchEvidence } from "./utils/launch.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as path from "node:path";

import { skillReadsFromToolCall } from "../src/skills.js";
import { convertToRunTree } from "./utils/convert.js";
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

const namesOf = (toolName: string | undefined, args: unknown) =>
  skillReadsFromToolCall(toolName, args).map(({ name }) => name);

describe("skillReadsFromToolCall", () => {
  // Commands below follow the shapes seen in real 0.153/0.154 rollouts.
  const skills = (program: string) => namesOf("exec", program);
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
    { command: `bash -lc 'cat ${SKILL}'`, names: FOUND },
    { command: `/bin/zsh -lc "cat ${SKILL}"`, names: FOUND },
    { command: `sh -c 'bash -c "cat ${SKILL}"'`, names: FOUND },
    { command: `bash -l -c 'cat ${SKILL}'`, names: FOUND },
    { command: `FOO=1 BAR="a b" cat ${SKILL}`, names: FOUND },
    { command: `env FOO=1 cat ${SKILL}`, names: FOUND },
    { command: `sudo -n cat ${SKILL}`, names: FOUND },
    { command: `bash -lc 'cat ${SKILL} > copy.md'`, names: [] },
    { command: `bash -c cat ${SKILL}`, names: [] },
    { command: `bash -c 'cat ${SKILL}' extra`, names: [] },
    { command: `bash -x 'cat ${SKILL}'`, names: [] },
    { command: "Get-Content C:\\repo\\.agents\\skills\\pr-creation\\SKILL.md", names: FOUND },
    { command: "type C:\\repo\\.agents\\skills\\pr-creation\\SKILL.md", names: [] },
    {
      command: 'powershell -Command "Get-Content C:\\repo\\skills\\pr-creation\\SKILL.md"',
      names: FOUND,
    },
    {
      command:
        'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Content C:\\repo\\skills\\pr-creation\\SKILL.md"',
      names: FOUND,
    },
    { command: `pwsh -NoLogo -Command 'Get-Content ${SKILL}'`, names: FOUND },
    { command: "cd .agents/skills/pr-creation && cat SKILL.md", names: FOUND },
    { command: "cd '/Users/a b/.agents/skills/pr-creation' && cat SKILL.md", names: FOUND },
    { command: "cd .agents/skills/pr-creation && bash -lc 'cat SKILL.md'", names: FOUND },
    { command: "cd .agents/skills && cd pr-creation && cat SKILL.md", names: FOUND },
    { command: "cd .agents/skills/other && cd ../pr-creation && cat SKILL.md", names: FOUND },
    { command: "cd .agents && cd ./skills//pr-creation && cat SKILL.md", names: FOUND },
    { command: "cd /h/skills && cd /h/.agents/skills/pr-creation && cat SKILL.md", names: FOUND },
    { command: "cd /repo && cat SKILL.md", names: [] },
    { command: "cd /repo/skills/x && cd .. && cat SKILL.md", names: [] },
    { command: "cd .agents/skills || cat pr-creation/SKILL.md", names: [] },
    { command: "cd .agents/skills; cat pr-creation/SKILL.md", names: [] },
    {
      command: `bash -lc 'cd .agents/skills && cat pr-creation/SKILL.md'; cat other/SKILL.md`,
      names: FOUND,
    },
    { command: "cat /root/.codex/skills/.system/openai-docs/SKILL.md", names: ["openai-docs"] },
    { command: "cat /root/.codex/other/.system/openai-docs/SKILL.md", names: [] },
    {
      command:
        "cat /h/.codex/plugins/cache/m/p/1.0/.codex-plugin/migrated-command-skills/trace/SKILL.md",
      names: ["trace"],
    },
    { command: "cat .agents/skills/pr-creation/references/SKILL.md", names: [] },
    { command: "cat .agents/skills/pr-creation/templates/deep/SKILL.md", names: [] },
    { command: "cat .agents/skills/.cache/pr-creation/SKILL.md", names: [] },
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
      namesOf("exec_command", {
        cmd: "cat .agents/skills/local-development/SKILL.md",
      }),
    ).toEqual(["local-development"]);
  });

  // A shell tool would find a skill in this program, so only the tool name empties it.
  it.each(["apply_patch", "shell", undefined])("ignores the %s tool", (toolName) => {
    const program = `text(await tools.exec_command({cmd:"cat ${SKILL}"}));`;
    expect(namesOf(toolName, program)).toEqual([]);
  });

  it.each([
    {
      command: "cd /r && cat /h/.agents/skills/foo/SKILL.md",
      path: "/h/.agents/skills/foo/SKILL.md",
    },
    { command: "cd /r/skills && cat foo/SKILL.md", path: "/r/skills/foo/SKILL.md" },
    { command: "cat ~/.agents/skills/foo/SKILL.md", path: "~/.agents/skills/foo/SKILL.md" },
    {
      command: "cd /r && cat ~/.agents/skills/foo/SKILL.md",
      path: "~/.agents/skills/foo/SKILL.md",
    },
    {
      command: "cd /r && cat C:\\skills\\foo\\SKILL.md",
      path: "C:\\skills\\foo\\SKILL.md",
    },
    { command: "cd a && cd .. && cat skills/foo/SKILL.md", path: "skills/foo/SKILL.md" },
    {
      command: "cd /r && cd /h/.agents/skills/foo && cat SKILL.md",
      path: "/h/.agents/skills/foo/SKILL.md",
    },
  ])("names the file read as $path", ({ command, path }) => {
    expect(skillReadsFromToolCall("exec_command", { cmd: command })).toEqual([
      { name: "foo", paths: [path], commands: [command] },
    ]);
  });

  it("scans a long run of cd commands and reads in linear time", () => {
    const crafted = `${"cd /a/skills/x && ".repeat(10_000)}${"cat SKILL.md && ".repeat(10_000)}`;
    const started = performance.now();
    expect(inCommand(crafted)).toEqual(["x"]);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("lists each path and command once when two commands read the same file", () => {
    const first = "cat /h/.agents/skills/foo/SKILL.md";
    const second = "head -5 /h/.agents/skills/foo/SKILL.md";
    const program = [first, second, first]
      .map((cmd) => `tools.exec_command({cmd:${JSON.stringify(cmd)}})`)
      .join(";");
    expect(skillReadsFromToolCall("exec", program)).toEqual([
      { name: "foo", paths: ["/h/.agents/skills/foo/SKILL.md"], commands: [first, second] },
    ]);
  });

  it("scans a long run of relative cd commands in linear time", () => {
    const crafted = `${"cd x && ".repeat(10_000)}${"cat SKILL.md && ".repeat(10_000)}`;
    const started = performance.now();
    expect(inCommand(crafted)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(250);
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

const ITEM_COMPLETED = "item_completed";
const TURN_ID = "019900aa-tttt-0001";
const SKILL_BODY = "---\nname: plain-terms\n---\nAnswer first.";

function line(timestamp: string, type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ timestamp, type, payload });
}

function typedSkillMessage(
  name: string,
  at: string,
  role = "user",
  path = `/h/.agents/skills/${name}/SKILL.md`,
): string {
  const text = `<skill>\n<name>${name}</name>\n<path>${path}</path>\n${SKILL_BODY}\n</skill>`;
  return line(at, "response_item", {
    type: "message",
    role,
    content: [{ type: "input_text", text }],
  });
}

function readCall(id: string, commands: string | string[], at: string): string[] {
  const calls = [commands]
    .flat()
    .map((command) => `tools.exec_command({cmd:${JSON.stringify(command)}})`);
  return [
    line(at, "response_item", {
      type: "custom_tool_call",
      call_id: id,
      name: "exec",
      input: `await Promise.all([${calls.join(",")}]);`,
    }),
    line(new Date(Date.parse(at) + 2000).toISOString(), "response_item", {
      type: "custom_tool_call_output",
      call_id: id,
      output: [{ type: "input_text", text: "Script completed" }],
    }),
  ];
}

function commandExecution(command: string, exitCode: number, at: string): string {
  return line(at, "event_msg", {
    type: ITEM_COMPLETED,
    item: {
      type: "CommandExecution",
      id: `exec-${command.length}-${exitCode}`,
      command: ["/bin/zsh", "-lc", command],
      status: exitCode === 0 ? "completed" : "failed",
      exit_code: exitCode,
      aggregated_output: exitCode === 0 ? "ok" : "cat: no such file",
    },
  });
}

function turn(...middle: string[]): string {
  return `${[
    line("2026-09-14T00:00:02.000Z", "session_meta", {
      id: "019900aa-0000-7000-8000-skillsthread",
      cwd: "/Users/dev/sample-project",
      originator: "codex_exec",
      cli_version: "0.154.0",
      source: "exec",
      model_provider: "openai",
    }),
    line("2026-09-14T00:00:03.000Z", "event_msg", { type: "task_started", turn_id: TURN_ID }),
    line("2026-09-14T00:00:04.000Z", "response_item", {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Use $plain-terms" }],
    }),
    ...middle,
    line("2026-09-14T00:00:20.000Z", "response_item", {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "done" }],
    }),
    line("2026-09-14T00:00:21.000Z", "event_msg", { type: "task_complete", turn_id: TURN_ID }),
  ].join("\n")}\n`;
}

const skillOutputs = (skills: { outputs?: unknown }[]) => skills.map((run) => run.outputs);

describe("skills typed as $name", () => {
  it("counts the injected skill once, with its name and success true", async () => {
    const {
      turn: root,
      skills,
      childrenOf,
    } = await runsFor(turn(typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z")));

    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual(["plain-terms"]);
    expect(skillOutputs(skills)).toEqual([
      { output: { commandName: "plain-terms", success: true } },
    ]);
    expect(skills.map((run) => run.parent_run_id)).toEqual([root?.id]);
    expect(childrenOf(skills[0].id)).toEqual([]);
  });

  it("does not put the skill body into the user message", async () => {
    const { turn: root } = await runsFor(
      turn(typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z")),
    );
    expect(JSON.stringify(root?.inputs)).not.toContain("Answer first.");
  });

  it("counts a skill the model also reads in the same turn once", async () => {
    const { skills } = await runsFor(
      turn(
        typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z"),
        ...readCall(
          "call_a",
          "cat /h/.agents/skills/plain-terms/SKILL.md",
          "2026-09-14T00:00:06.000Z",
        ),
      ),
    );
    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual(["plain-terms"]);
  });

  it("counts a typed skill and a different skill the model reads separately", async () => {
    const { skills } = await runsFor(
      turn(
        typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z"),
        ...readCall("call_a", "cat /h/.agents/skills/ship-pr/SKILL.md", "2026-09-14T00:00:06.000Z"),
      ),
    );
    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name).sort()).toEqual([
      "plain-terms",
      "ship-pr",
    ]);
  });

  it("counts two typed skills and ignores a repeat of the same one", async () => {
    const { skills } = await runsFor(
      turn(
        typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z"),
        typedSkillMessage("ship-pr", "2026-09-14T00:00:05.100Z"),
        typedSkillMessage("plain-terms", "2026-09-14T00:00:05.200Z"),
      ),
    );
    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([
      "plain-terms",
      "ship-pr",
    ]);
  });

  it("counts a namespaced plugin skill once when the model reads the file Codex injected", async () => {
    const path = "/h/plugins/cache/tracing/skills/trace/SKILL.md";
    const { skills } = await runsFor(
      turn(
        typedSkillMessage("tracing:trace", "2026-09-14T00:00:05.000Z", "user", path),
        ...readCall("call_a", `cat ${path}`, "2026-09-14T00:00:06.000Z"),
      ),
    );
    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual(["tracing:trace"]);
  });

  it("keeps a read of a different file that shares the typed skill's folder name", async () => {
    const { skills } = await runsFor(
      turn(
        typedSkillMessage(
          "tracing:trace",
          "2026-09-14T00:00:05.000Z",
          "user",
          "/h/plugins/cache/tracing/skills/trace/SKILL.md",
        ),
        ...readCall("call_a", "cat /h/.agents/skills/trace/SKILL.md", "2026-09-14T00:00:06.000Z"),
      ),
    );
    expect(skills.map((run) => run.extra?.metadata?.ls_skill_name)).toEqual([
      "tracing:trace",
      "trace",
    ]);
  });

  it("starts the typed run when Codex injected the skill", async () => {
    const { skills } = await runsFor(
      turn(typedSkillMessage("plain-terms", "2026-09-14T00:00:05.000Z")),
    );
    const injected = Date.parse("2026-09-14T00:00:05.000Z");
    expect(Date.parse(String(skills[0].start_time))).toBe(injected);
    expect(Number(skills[0].end_time)).toBe(injected);
  });

  it.each([
    { what: "an assistant message", name: "plain-terms", role: "assistant" },
    { what: "a name that is not a skill name", name: "../etc", role: "user" },
  ])("counts nothing for $what carrying a skill tag", async ({ name, role }) => {
    const { skills } = await runsFor(
      turn(typedSkillMessage(name, "2026-09-14T00:00:05.000Z", role)),
    );
    expect(skills).toEqual([]);
  });

  it.each([
    { what: "no path or closing tag", text: "<skill><name>plain-terms</name> is what I typed" },
    { what: "no path", text: "<skill><name>plain-terms</name>body</skill>" },
    {
      what: "text after the closing tag",
      text: "<skill><name>plain-terms</name><path>/p</path>body</skill> and more",
    },
    { what: "no closing tag", text: "<skill><name>plain-terms</name><path>/p</path>body" },
  ])("counts nothing for a user message with $what", async ({ text }) => {
    const { skills } = await runsFor(
      turn(
        line("2026-09-14T00:00:05.000Z", "response_item", {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        }),
      ),
    );
    expect(skills).toEqual([]);
  });

  it("counts nothing for a user message that only mentions a skill tag", async () => {
    const { skills } = await runsFor(
      turn(
        line("2026-09-14T00:00:05.000Z", "response_item", {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "what is <skill> for?" }],
        }),
      ),
    );
    expect(skills).toEqual([]);
  });
});

describe("success of a skill the model read", () => {
  const READ = "cat /h/.agents/skills/plain-terms/SKILL.md";

  it.each([
    { what: "a failed command", exitCode: 1, success: false },
    { what: "a command that exited 0", exitCode: 0, success: true },
  ])("reports $what from the script's own command record", async ({ exitCode, success }) => {
    const { skills } = await runsFor(
      turn(
        ...readCall("call_a", READ, "2026-09-14T00:00:06.000Z"),
        commandExecution(READ, exitCode, "2026-09-14T00:00:06.500Z"),
      ),
    );
    expect(skillOutputs(skills)).toEqual([{ output: { commandName: "plain-terms", success } }]);
  });

  it.each([
    { order: "failed first", codes: [1, 0] },
    { order: "worked first", codes: [0, 1] },
  ])(
    "reports success when one of two reads in the same call worked ($order)",
    async ({ codes }) => {
      const second = `sed -n 1,5p /h/.agents/skills/plain-terms/SKILL.md`;
      const { skills } = await runsFor(
        turn(
          ...readCall("call_a", [READ, second], "2026-09-14T00:00:06.000Z"),
          commandExecution(READ, codes[0], "2026-09-14T00:00:06.500Z"),
          commandExecution(second, codes[1], "2026-09-14T00:00:07.000Z"),
        ),
      );
      expect(skillOutputs(skills)).toEqual([
        { output: { commandName: "plain-terms", success: true } },
      ]);
    },
  );

  it.each([
    { order: "failure then success", codes: [1, 0] },
    { order: "success then failure", codes: [0, 1] },
  ])("judges a retried read by its own call ($order)", async ({ codes }) => {
    const { skills } = await runsFor(
      turn(
        ...readCall("call_a", READ, "2026-09-14T00:00:06.000Z"),
        commandExecution(READ, codes[0], "2026-09-14T00:00:06.500Z"),
        ...readCall("call_b", READ, "2026-09-14T00:00:10.000Z"),
        commandExecution(READ, codes[1], "2026-09-14T00:00:10.500Z"),
      ),
    );
    expect(skillOutputs(skills)).toEqual(
      codes.map((code) => ({ output: { commandName: "plain-terms", success: code === 0 } })),
    );
  });

  it("fails every call that ran the same read at the same time when one of them failed", async () => {
    const { skills } = await runsFor(
      turn(
        ...readCall("call_a", READ, "2026-09-14T00:00:06.000Z"),
        ...readCall("call_b", READ, "2026-09-14T00:00:06.100Z"),
        commandExecution(READ, 1, "2026-09-14T00:00:06.500Z"),
        commandExecution(READ, 0, "2026-09-14T00:00:07.000Z"),
      ),
    );
    expect(skillOutputs(skills)).toEqual([
      { output: { commandName: "plain-terms", success: false } },
      { output: { commandName: "plain-terms", success: false } },
    ]);
  });

  it("does not let another skill or a command that only names the path decide success", async () => {
    const sibling = "cat /h/.agents/skills/plain-terms-extra/SKILL.md";
    const echo = "echo /plain-terms SKILL.md";
    const { skills } = await runsFor(
      turn(
        ...readCall("call_a", [READ, sibling], "2026-09-14T00:00:06.000Z"),
        commandExecution(READ, 1, "2026-09-14T00:00:06.500Z"),
        commandExecution(sibling, 0, "2026-09-14T00:00:07.000Z"),
        commandExecution(echo, 0, "2026-09-14T00:00:07.500Z"),
      ),
    );
    expect(skillOutputs(skills)).toEqual([
      { output: { commandName: "plain-terms", success: false } },
      { output: { commandName: "plain-terms-extra", success: true } },
    ]);
  });

  it("reports a failure from the failed status of an exec_command_end event", async () => {
    const { skills } = await runsFor(
      turn(
        line("2026-09-14T00:00:06.000Z", "response_item", {
          type: "function_call",
          call_id: "call_a",
          name: "exec_command",
          arguments: JSON.stringify({ cmd: READ }),
        }),
        line("2026-09-14T00:00:06.100Z", "response_item", {
          type: "function_call_output",
          call_id: "call_a",
          output: "denied",
        }),
        line("2026-09-14T00:00:06.200Z", "event_msg", {
          type: "exec_command_end",
          call_id: "call_a",
          status: "failed",
          aggregated_output: "denied",
        }),
      ),
    );
    expect(skillOutputs(skills)).toEqual([
      { output: { commandName: "plain-terms", success: false } },
    ]);
  });

  it.each([1, -1])(
    "reports a failure from exit code %i of an exec_command_end event",
    async (exitCode) => {
      const { skills } = await runsFor(
        turn(
          line("2026-09-14T00:00:06.000Z", "response_item", {
            type: "function_call",
            call_id: "call_a",
            name: "exec_command",
            arguments: JSON.stringify({ cmd: READ }),
          }),
          line("2026-09-14T00:00:06.100Z", "response_item", {
            type: "function_call_output",
            call_id: "call_a",
            output: "cat: no such file",
          }),
          line("2026-09-14T00:00:06.200Z", "event_msg", {
            type: "exec_command_end",
            call_id: "call_a",
            exit_code: exitCode,
            aggregated_output: "cat: no such file",
          }),
        ),
      );
      expect(skillOutputs(skills)).toEqual([
        { output: { commandName: "plain-terms", success: false } },
      ]);
    },
  );
});
