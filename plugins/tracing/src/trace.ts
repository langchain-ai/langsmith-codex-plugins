import type { LineSchema, ResponseItem } from "./types.js";
import { Client, RunTreeConfig, RunTree } from "langsmith";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findLast } from "./utils/findLast.js";
import { loadUploadedTurnIds, markTurnUploaded } from "./sidecar.js";
import type {
  Session,
  TokenCount,
  AggregateMessage,
  MergedMessage,
  Task,
  StandardMessage,
} from "./types.js";
import { isPrimitive } from "./utils/isPrimitive.js";

async function loadSession(name: string) {
  const data = await fs.readFile(name, "utf-8");

  const result = data
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LineSchema);

  return result;
}

// Rollout files are stored at `<sessionsRoot>/YYYY/MM/DD/rollout-<ts>-<threadId>.jsonl`.
// Given the path of the parent rollout file we walk up to the sessions root and
// recursively look for a file whose name ends with the subagent's thread id.
async function findRolloutFileByThreadId(
  parentFileName: string,
  threadId: string,
): Promise<string | undefined> {
  const suffix = `-${threadId}.jsonl`;
  const root = path.resolve(path.dirname(parentFileName), "../../..");

  async function walk(dir: string): Promise<string | undefined> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        return full;
      }
    }
    return undefined;
  }

  return walk(root);
}

function mergeMessages(result: AggregateMessage<StandardMessage>[]) {
  return result.reduce<MergedMessage<StandardMessage>[]>(
    (acc, { message, timestamp, tokenCount, subagentThreads }) => {
      const last = acc.length > 0 ? acc[acc.length - 1] : undefined;

      if (!["ai", "user", "system"].includes(message.role) || last?.message.role !== message.role) {
        acc.push({
          message,
          timestamp: { start: timestamp, end: timestamp },
          tokenCount,
          subagentThreads,
        });
        return acc;
      }

      const nextLast = structuredClone(last);
      nextLast.message.content.push(...message.content);
      nextLast.subagentThreads.push(...subagentThreads);
      nextLast.timestamp.start = Math.min(nextLast.timestamp.start, timestamp);
      nextLast.timestamp.end = Math.max(nextLast.timestamp.end, timestamp);
      if (tokenCount != null) nextLast.tokenCount = tokenCount;

      acc[acc.length - 1] = nextLast;
      return acc;
    },
    [],
  );
}

function getToolName(name: string, namespace?: string | null): string {
  if (typeof namespace !== "string" || namespace.length === 0) return name;
  if (name.startsWith(`${namespace}.`)) return name;
  return `${namespace}.${name}`;
}

function isSkillNamespace(namespace: string | null | undefined): boolean {
  if (typeof namespace !== "string") return false;
  const normalized = namespace.toLowerCase();
  return normalized === "skill" || normalized === "skills" || normalized.includes("skill");
}

function getSkillName(skill: unknown): string | undefined {
  if (skill == null || typeof skill !== "object") return undefined;
  const record = skill as Record<string, unknown>;
  if (typeof record.name === "string") return record.name;
  if (typeof record.id === "string") return record.id;
  if (typeof record.skill_name === "string") return record.skill_name;
  return undefined;
}

function getSkillDescription(skill: unknown): string | undefined {
  if (skill == null || typeof skill !== "object") return undefined;
  const record = skill as Record<string, unknown>;
  if (typeof record.description === "string") return record.description;
  if (record.description != null && typeof record.description === "object") {
    const descObj = record.description as Record<string, unknown>;
    if (typeof descObj.text === "string") return descObj.text;
    if (typeof descObj.value === "string") return descObj.value;
  }
  if (typeof record.summary === "string") return record.summary;
  return undefined;
}

function getStringValue(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? (record[key] as string) : undefined;
}

function parseSkillBlock(raw: string): {
  name?: string;
  description?: string;
  content?: string;
} {
  const skillBlockMatch = raw.match(/<skill>([\s\S]*?)<\/skill>/);
  if (skillBlockMatch == null) return {};

  const content = skillBlockMatch[0];
  const inner = skillBlockMatch[1] ?? "";
  const name = inner.match(/<name>\s*([^<\n]+?)\s*<\/name>/)?.[1]?.trim();
  const description =
    inner.match(/^\s*description:\s*"([^"\n]+)"/m)?.[1] ??
    inner.match(/^\s*description:\s*'([^'\n]+)'/m)?.[1] ??
    inner.match(/^\s*description:\s*([^\n]+)/m)?.[1]?.trim();

  return { name, description, content };
}

function parseSkillTrigger(raw: string): string[] {
  const matches = Array.from(raw.matchAll(/\$([a-zA-Z0-9][a-zA-Z0-9_-]*)/g));
  return matches.map((m) => m[1]).filter(Boolean);
}
function parseSkillMention(raw: string): string[] {
  const mentions = new Set<string>();

  for (const match of raw.matchAll(/\b(skill(?:-[a-z0-9][a-z0-9._-]*)?)\b/gi)) {
    const name = match[1]?.toLowerCase();
    if (name != null) mentions.add(name);
  }

  return Array.from(mentions);
}

function extractMessageText(payload: ResponseItem): string[] {
  if (payload.type !== "message") return [];
  return payload.content
    .map((part) => {
      if (part == null || typeof part !== "object") return undefined;
      const record = part as Record<string, unknown>;
      const type = getStringValue(record, "type");
      if (type !== "input_text" && type !== "text" && type !== "output_text") return undefined;
      return getStringValue(record, "text");
    })
    .filter((text): text is string => typeof text === "string");
}

function detectHookSkill(command: unknown): {
  skillName: string;
  scriptPath: string;
  commandText: string;
} | null {
  const cmd =
    typeof command === "string"
      ? command
      : Array.isArray(command)
        ? command.filter((c) => typeof c === "string").join(" ")
        : "";
  if (cmd.length === 0) return null;

  const lowerCmd = cmd.toLowerCase();
  const likelyExec =
    /\b(node|python|python3|bash|sh|zsh|bun|deno|ts-node)\b/.test(lowerCmd) &&
    !/\b(sed|cat|head|tail|grep|rg|ls|find)\b/.test(lowerCmd);
  if (!likelyExec) return null;

  const match = cmd.match(/skills\/([a-zA-Z0-9._-]+)\/scripts\/([^\s'"]+)/);
  if (match == null) return null;

  return {
    skillName: match[1],
    scriptPath: `skills/${match[1]}/scripts/${match[2]}`,
    commandText: cmd,
  };
}

function detectSkillRead(command: unknown): {
  skillName: string;
  skillPath: string;
  commandText: string;
} | null {
  const cmd =
    typeof command === "string"
      ? command
      : Array.isArray(command)
        ? command.filter((c) => typeof c === "string").join(" ")
        : "";
  if (cmd.length === 0) return null;

  const match = cmd.match(/([^\s'"]*skills\/([a-zA-Z0-9._-]+)\/SKILL\.md)/);
  if (match == null) return null;

  return {
    skillName: match[2],
    skillPath: match[1],
    commandText: cmd,
  };
}

function applyHookSkillToolCall(
  toolCall: {
    namespace?: string | null;
    isSkill?: boolean;
    name?: string;
    outputs: Record<string, unknown>;
  },
  hookSkill: { skillName: string; scriptPath: string; commandText: string },
  skillDef?: unknown,
  eventKind: "hook_execution" | "hook_invocation" = "hook_execution",
) {
  toolCall.namespace ??= "skill";
  toolCall.isSkill = true;
  toolCall.name = `skill.${hookSkill.skillName}.hook`;
  Object.assign(toolCall.outputs, {
    skill_name: hookSkill.skillName,
    skill_description: getSkillDescription(skillDef),
    skill: skillDef,
    hook_script: hookSkill.scriptPath,
    hook_command: hookSkill.commandText,
    skill_event_kind: eventKind,
  });
}

function applySkillReadToolCall(
  toolCall: {
    namespace?: string | null;
    isSkill?: boolean;
    name?: string;
    outputs: Record<string, unknown>;
  },
  skillRead: { skillName: string; skillPath: string; commandText: string },
  skillDef?: unknown,
) {
  toolCall.namespace ??= "skill";
  toolCall.isSkill = true;
  toolCall.name = `skill.${skillRead.skillName}.read`;
  Object.assign(toolCall.outputs, {
    skill_name: skillRead.skillName,
    skill_description: getSkillDescription(skillDef),
    skill: skillDef,
    skill_path: skillRead.skillPath,
    skill_command: skillRead.commandText,
    skill_event_kind: "skill_read",
  });
}

function convertToStandardMessages(messages: AggregateMessage<ResponseItem>[]) {
  return messages.map(({ message, ...rest }): AggregateMessage<StandardMessage> => {
    if (message.type === "message") {
      const role = (() => {
        if (message.role === "developer") return "system";
        if (message.role === "assistant") return "ai";
        return message.role;
      })();

      const content = message.content.map((c) => {
        if (c.type === "input_text") return { type: "text", text: c.text };

        if (c.type === "output_text") return { type: "text", text: c.text };

        if (c.type === "text") {
          return { type: "text", text: c.text };
        }

        if (c.type === "input_image") {
          return {
            type: "image_url",
            image_url: c.image_url,
          };
        }

        return { type: "non_standard", value: c };
      });

      return { message: { role, content }, ...rest };
    }

    if (message.type === "function_call") {
      const name = getToolName(message.name, message.namespace);
      const id = message.call_id;
      const args = message.arguments;

      try {
        return {
          message: {
            role: "ai",
            content: [{ type: "tool_call", name, id, args: JSON.parse(args) }],
          },
          ...rest,
        };
      } catch {
        return {
          message: {
            role: "ai",
            content: [{ type: "tool_call_chunk", name, id, args }],
          },
          ...rest,
        };
      }
    }

    if (message.type === "function_call_output") {
      const text =
        typeof message.output === "string" ? message.output : JSON.stringify(message.output);

      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "custom_tool_call") {
      const name = message.name;
      const id = message.call_id;

      return {
        message: {
          role: "ai",
          content: [{ type: "tool_call", name, id, args: message.input }],
        },
        ...rest,
      };
    }

    if (message.type === "custom_tool_call_output") {
      const text =
        typeof message.output === "string" ? message.output : JSON.stringify(message.output);

      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "tool_search_call") {
      return {
        message: {
          role: "ai",
          content: [
            {
              type: "tool_call",
              name: message.type,
              id: message.call_id,
              args: message.arguments,
            },
          ],
        },
        ...rest,
      };
    }

    if (message.type === "tool_search_output") {
      const text = JSON.stringify(message.tools);
      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "reasoning") {
      // Only include reasoning if it has non-encrypted content
      const { type: _, content: reasoningRaw, ...extras } = message;

      const reasoning = message.content
        ? typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content)
        : undefined;

      return {
        message: {
          role: "ai",
          content: [{ type: "reasoning", reasoning, extras }],
        },
        ...rest,
      };
    }

    return {
      message: {
        role: "unknown",
        content: [{ type: "non_standard", value: message }],
        _raw: message,
      },
      ...rest,
    };
  });
}

function getUsageMetadata(counts: TokenCount | undefined): Record<string, unknown> | undefined {
  if (counts == null || Object.values(counts ?? {}).every((value) => value == null)) {
    return undefined;
  }

  return {
    input_tokens: counts.input_tokens,
    output_tokens: counts.output_tokens,
    total_tokens: counts.total_tokens,
    input_token_details: {
      cache_read: counts.cached_input_tokens,
      cache_creation: counts.reasoning_output_tokens,
    },
  };
}

const PROMISE_QUEUE: Promise<void>[] = [];

async function postTurn(
  task: Task,
  sessionMeta: Session | undefined,
  {
    rolloutFile,
    options,
  }: {
    rolloutFile: string;
    options?: {
      client?: Client;
      projectName?: string;
      metadata?: Record<string, unknown>;
      replicas?: RunTreeConfig["replicas"];

      parentRunTree?: RunTree;
      debugNow?: { now: number; startTime: number };
    };
  },
) {
  const fallbackTime = Date.now();

  const getSystemMessage = (
    session: Session | undefined,
    task: Task | undefined,
  ): {
    message: StandardMessage;
    timestamp: number;
    tokenCount: TokenCount | undefined;
    subagentThreads: string[];
  }[] => {
    if (session?.base_instructions == null || task?.turnId == null) {
      return [];
    }

    return [
      {
        message: {
          role: "system",
          content: [{ type: "text", text: session.base_instructions }],
        },
        timestamp: task.turnId.timestamp,
        tokenCount: undefined,
        subagentThreads: [],
      },
    ];
  };

  const messages = convertToStandardMessages(task.messages);

  const user = task.userMessageIndex != null ? messages.at(task.userMessageIndex) : undefined;

  const agent = mergeMessages(
    task.userMessageIndex != null ? messages.slice(task.userMessageIndex + 1) : messages,
  );

  const parentStartTime = task.turnId?.timestamp ?? fallbackTime;
  const parentEndTime = agent.at(-1)?.timestamp.end ?? parentStartTime;

  const debugNow = options?.debugNow ?? { now: Date.now(), startTime: parentStartTime };

  const parentConfig: RunTreeConfig = {
    name: "openai.codex",
    client: options?.client,
    project_name: options?.projectName,
    run_type: "chain",
    replicas: options?.replicas,
    inputs: { messages: user != null ? [user.message] : [] },
    outputs: { messages: agent.map((i) => i.message) },
    start_time: parentStartTime,
    end_time: parentEndTime,
    extra: {
      metadata: {
        ...options?.metadata,
        ...task.context,
        codex_cli_version: sessionMeta?.cli_version,
        turn_id: task.turnId?.id,
        thread_id: sessionMeta?.session_id,

        ls_integration: "openai-codex",
        ls_agent_type: "root",
        ls_message_format: "anthropic",

        usage_metadata: getUsageMetadata(task.tokenCount?.total_token_usage),
      },
    },
  };
  const parent = options?.parentRunTree?.createChild(parentConfig) ?? new RunTree(parentConfig);

  PROMISE_QUEUE.push(parent.postRun());

  const fullMessages = mergeMessages([...getSystemMessage(sessionMeta, task), ...messages]);

  const aiMessageIndicies = fullMessages.reduce<number[]>((acc, item, idx) => {
    if (item.message.role === "ai") acc.push(idx);
    return acc;
  }, []);

  const outputs = aiMessageIndicies.map((start) => {
    const targetList = Array.from({ length: start + 1 })
      .fill(null)
      .concat(fullMessages.slice(start + 1));

    const nonToolIdx = targetList.findIndex((i) => {
      const value = i as { message: StandardMessage } | null;
      if (value == null) return false;
      return value?.message.role !== "tool";
    });

    if (nonToolIdx > start) {
      return { start, length: nonToolIdx - start };
    }

    return { start, length: 1 };
  });

  const matchedToolCallIds = new Set<string>();

  for (const output of outputs) {
    const inputMessages = fullMessages.slice(0, output.start);
    const aiMessage = fullMessages.slice(output.start, output.start + 1);
    const toolMessages = fullMessages.slice(output.start + 1, output.start + output.length);

    const outputStartTime = aiMessage.at(0)?.timestamp.start ?? parentStartTime;
    const outputEndTime = aiMessage.at(-1)?.timestamp.end ?? outputStartTime;

    const tokenCounts = findLast(aiMessage, (i) => i.tokenCount != null)?.tokenCount;

    const subagentThreads = findLast(
      aiMessage,
      (i) => i.subagentThreads.length > 0,
    )?.subagentThreads;

    const llmChild = parent.createChild({
      name: "openai.codex.turn",
      run_type: "llm",
      start_time: outputStartTime,
      end_time: outputEndTime,
      inputs: { messages: inputMessages.map((i) => i.message) },
      outputs: { messages: aiMessage.map((i) => i.message) },
      extra: {
        metadata: {
          ...options?.metadata,
          ls_model_type: "chat",
          ls_provider: sessionMeta?.model_provider,
          ls_model_name: task.context?.model,
          ls_invocation_params: task.context,
          usage_metadata: getUsageMetadata(tokenCounts),
        },
      },
    });
    PROMISE_QUEUE.push(llmChild.postRun());

    for (const toolMessage of toolMessages) {
      if (toolMessage.message.role !== "tool") continue;
      const toolCallId =
        typeof toolMessage.message.tool_call_id === "string"
          ? toolMessage.message.tool_call_id
          : undefined;

      const msgToolCall = aiMessage
        .at(0)
        ?.message.content.find((c) => c.type === "tool_call" && c.id === toolCallId);

      // Ignore tool calls that don't have a tool call id
      if (toolCallId == null || msgToolCall == null) continue;

      const toolCall = task.toolCalls?.[toolCallId] ?? {
        error: undefined,
        timings: [],
        outputs: {},
      };

      const min = Math.min(toolMessage.timestamp.start, ...toolCall.timings);
      const max = Math.max(toolMessage.timestamp.end, ...toolCall.timings);

      const toolRun = parent.createChild({
        name:
          (toolCall.isSkill ? toolCall.name : undefined) ??
          (msgToolCall.name as string) ??
          "openai.codex.tool",
        run_type: "tool",
        start_time: min,
        end_time: max,
        inputs: { input: msgToolCall.args },
        outputs: { ...toolCall.outputs, messages: [toolMessage.message] },
        error: toolCall.error,
        extra: {
          metadata: {
            ...options?.metadata,
            ls_model_type: "chat",
            ls_provider: sessionMeta?.model_provider,
            ls_model_name: task.context?.model,
            ls_invocation_params: task.context,
            ls_tool_namespace: toolCall.namespace,
            ls_tool_category: toolCall.isSkill ? "skill" : undefined,
            usage_metadata: getUsageMetadata(toolMessage.tokenCount),
          },
        },
      });
      PROMISE_QUEUE.push(toolRun.postRun());
      matchedToolCallIds.add(toolCallId);
    }

    for (const subagentThread of subagentThreads ?? []) {
      const subagentFile = await findRolloutFileByThreadId(rolloutFile, subagentThread);

      if (subagentFile == null) {
        continue;
      }

      await convertToRunTree(subagentFile, {
        ...options,
        parentRunTree: parent,
        debugNow,
      });
    }
  }

  for (const [toolCallId, toolCall] of Object.entries(task.toolCalls)) {
    if (matchedToolCallIds.has(toolCallId)) continue;

    const hasStructuredPayload =
      toolCall.name != null ||
      toolCall.input != null ||
      toolCall.error != null ||
      Object.keys(toolCall.outputs).length > 0;
    if (!hasStructuredPayload) continue;

    const min = toolCall.timings.length > 0 ? Math.min(...toolCall.timings) : parentStartTime;
    const max = toolCall.timings.length > 0 ? Math.max(...toolCall.timings) : parentEndTime;

    const outputsPayload: Record<string, unknown> = { ...toolCall.outputs };
    if (outputsPayload.messages == null) {
      const fallbackText = JSON.stringify(toolCall.outputs);
      outputsPayload.messages = [{ role: "tool", content: [{ type: "text", text: fallbackText }] }];
    }

    const toolRun = parent.createChild({
      name: toolCall.name ?? "openai.codex.tool",
      run_type: "tool",
      start_time: min,
      end_time: Math.max(min, max),
      inputs: { input: toolCall.input },
      outputs: outputsPayload,
      error: toolCall.error,
      extra: {
        metadata: {
          ...options?.metadata,
          ls_model_type: "chat",
          ls_provider: sessionMeta?.model_provider,
          ls_model_name: task.context?.model,
          ls_invocation_params: task.context,
          ls_tool_namespace: toolCall.namespace,
          ls_tool_category: toolCall.isSkill ? "skill" : undefined,
        },
      },
    });
    PROMISE_QUEUE.push(toolRun.postRun());
  }
}

export async function convertToRunTree(
  rolloutFile: string,
  options?: {
    parentRunTree?: RunTree;
    client?: Client;
    metadata?: Record<string, unknown>;
    replicas?: RunTreeConfig["replicas"];
    projectName?: string;
    sessionsRoot?: string;
    debugNow?: { now: number; startTime: number };
  },
) {
  let sessionMeta: Session | undefined;
  let task: Task | undefined;
  let syntheticSkillCallIdx = 0;
  let syntheticSkillEventKeys = new Set<string>();
  const skillDefinitions = new Map<string, unknown>();

  function createTask(): Task {
    return {
      turnId: undefined,
      messages: [],
      userMessageIndex: undefined,
      context: undefined,
      tokenCount: undefined,
      toolCalls: {},
    };
  }

  function upsertToolCall(currentTask: Task, callId: string) {
    currentTask.toolCalls[callId] ??= { error: undefined, timings: [], outputs: {} };
    return currentTask.toolCalls[callId];
  }

  function addSyntheticSkillEvent(
    currentTask: Task,
    eventTime: number,
    name: string,
    outputs: Record<string, unknown>,
    input?: unknown,
    dedupeKey?: string,
  ) {
    if (dedupeKey != null && syntheticSkillEventKeys.has(dedupeKey)) return;
    if (dedupeKey != null) syntheticSkillEventKeys.add(dedupeKey);

    const callId = `skill_event_${currentTask.turnId?.id ?? "unknown"}_${syntheticSkillCallIdx++}`;
    currentTask.toolCalls[callId] = {
      name,
      namespace: "skill",
      input,
      isSkill: true,
      error: undefined,
      timings: [eventTime],
      outputs: { ...outputs, status: "completed" },
    };
  }

  // Turns that have already been uploaded in a previous hook invocation for the
  // same rollout file. Used to avoid replaying completed turns when the user
  // resumes or continues a conversation.
  const uploadedTurnIds = await loadUploadedTurnIds(rolloutFile);

  for (const { type, payload, timestamp } of await loadSession(rolloutFile)) {
    if (type === "session_meta") {
      sessionMeta = {
        session_id: payload.id,
        model_provider: payload.model_provider ?? undefined,
        base_instructions: payload.base_instructions?.text,
        cli_version: payload.cli_version,
      };
    }

    if (type === "response_item") {
      task ??= createTask();
      const message = {
        timestamp: Date.parse(timestamp),
        message: payload,
        tokenCount: undefined,
        subagentThreads: [],
      };
      task.messages.push(message);

      // Only capture the user message after we retrieved to turn context,
      // since <environment_context /> is being sent as user message
      if (
        task.context != null &&
        task.userMessageIndex == null &&
        payload.type === "message" &&
        payload.role === "user"
      ) {
        task.userMessageIndex = task.messages.length - 1;
      }

      if (payload.type === "message" && payload.role === "user") {
        for (const text of extractMessageText(payload)) {
          for (const mentionName of parseSkillMention(text)) {
            addSyntheticSkillEvent(
              task,
              Date.parse(timestamp),
              `skill.${mentionName}.mentioned`,
              {
                skill_name: mentionName,
                source: "text_mention",
                content: text,
              },
              undefined,
              `mentioned:${mentionName}`,
            );
          }

          for (const triggerName of parseSkillTrigger(text)) {
            addSyntheticSkillEvent(
              task,
              Date.parse(timestamp),
              `skill.${triggerName}.requested`,
              {
                skill_name: triggerName,
                source: "user_trigger",
                content: text,
              },
              { trigger: `$${triggerName}` },
              `requested:${triggerName}`,
            );
          }

          const skillBlock = parseSkillBlock(text);
          if (skillBlock.name != null) {
            const existing = skillDefinitions.get(skillBlock.name);
            skillDefinitions.set(skillBlock.name, {
              ...(existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}),
              name: skillBlock.name,
              description: skillBlock.description ?? getSkillDescription(existing),
              content: skillBlock.content,
            });
            addSyntheticSkillEvent(
              task,
              Date.parse(timestamp),
              `skill.${skillBlock.name}.loaded`,
              {
                skill_name: skillBlock.name,
                skill_description: skillBlock.description,
                content: skillBlock.content,
                source: "user_skill_block",
              },
              undefined,
              `loaded:${skillBlock.name}`,
            );
          }
        }
      }

      if (payload.type === "function_call" && typeof payload.call_id === "string") {
        const toolCall = upsertToolCall(task, payload.call_id);
        toolCall.namespace ??= payload.namespace ?? null;
        toolCall.name ??= getToolName(payload.name, payload.namespace);
        toolCall.isSkill ||= isSkillNamespace(payload.namespace);
        let parsedArgs: unknown = payload.arguments;
        try {
          parsedArgs = JSON.parse(payload.arguments);
        } catch {
          parsedArgs = payload.arguments;
        }
        toolCall.input ??= parsedArgs;

        if (payload.name === "exec_command" && parsedArgs != null && typeof parsedArgs === "object") {
          const cmd = getStringValue(parsedArgs as Record<string, unknown>, "cmd");
          if (cmd != null) {
            const hookSkill = detectHookSkill(cmd);
            if (hookSkill != null) {
              const skillDef = skillDefinitions.get(hookSkill.skillName);
              applyHookSkillToolCall(toolCall, hookSkill, skillDef, "hook_invocation");
            }

            const skillRead = detectSkillRead(cmd);
            if (skillRead != null) {
              const skillDef = skillDefinitions.get(skillRead.skillName);
              applySkillReadToolCall(toolCall, skillRead, skillDef);
            }
          }
        }
      }

      if (payload.type === "custom_tool_call" && typeof payload.call_id === "string") {
        const toolCall = upsertToolCall(task, payload.call_id);
        toolCall.name ??= payload.name;
        toolCall.input ??= payload.input;
      }

      if (payload.type === "tool_search_call" && typeof payload.call_id === "string") {
        const toolCall = upsertToolCall(task, payload.call_id);
        toolCall.name ??= payload.type;
        toolCall.input ??= payload.arguments;
      }
    }

    if (type === "turn_context") {
      task ??= createTask();
      task.context = payload;
    }

    if (type === "event_msg") {
      const eventTime = Date.parse(timestamp);

      if (payload.type === "task_started") {
        // TODO: should we try to flush?
        task = createTask();
        syntheticSkillEventKeys = new Set<string>();
        task.turnId = { id: payload.turn_id, timestamp: eventTime };
      }

      if (typeof payload.call_id === "string") {
        task ??= createTask();
        const toolCall = upsertToolCall(task, payload.call_id);
        toolCall.timings.push(eventTime);

        if (payload.type === "mcp_tool_call_begin" || payload.type === "mcp_tool_call_end") {
          toolCall.namespace ??= "mcp";
          toolCall.name ??= getToolName(
            payload.invocation.tool,
            `mcp.${payload.invocation.server}`,
          );
          toolCall.input ??= payload.invocation.arguments;
        }

        if (payload.type === "dynamic_tool_call_response") {
          toolCall.namespace ??= payload.namespace ?? null;
          toolCall.name ??= getToolName(payload.tool, payload.namespace);
          toolCall.input ??= payload.arguments;
          toolCall.isSkill ||= isSkillNamespace(payload.namespace);
          const skillDef = toolCall.isSkill ? skillDefinitions.get(payload.tool) : undefined;
          Object.assign(toolCall.outputs, {
            namespace: payload.namespace,
            tool: payload.tool,
            arguments: payload.arguments,
            content_items: payload.content_items,
            content: payload.content_items,
            skill: skillDef,
            skill_description: getSkillDescription(skillDef),
            success: payload.success,
            duration: payload.duration,
            status: payload.success ? "completed" : "failed",
          });
          if (!payload.success) {
            toolCall.error =
              payload.error == null
                ? "Dynamic tool call failed"
                : isPrimitive(payload.error)
                  ? String(payload.error)
                  : JSON.stringify(payload.error);
          }
        }

        if (payload.type.endsWith("_end")) {
          // attempt to find an error message
          if (payload.status === "failed" || payload.status === "declined") {
            const stdout = (() => {
              if (typeof payload.aggregated_output === "string") {
                return payload.aggregated_output || undefined;
              }

              const bestEffort = [payload.stdout, payload.stderr].filter(Boolean).join("\n");
              if (!bestEffort) return undefined;
              return bestEffort;
            })();

            const exitCode = (() => {
              if (typeof payload.exit_code === "number") return `Exit code: ${payload.exit_code}`;
              return undefined;
            })();

            const error = payload.error ?? payload.codex_error_info ?? stdout ?? exitCode;
            toolCall.error =
              error != null
                ? isPrimitive(error)
                  ? String(error)
                  : JSON.stringify(error)
                : undefined;
          }

          const outputs: Record<string, unknown> = { ...payload };
          delete outputs.call_id;
          delete outputs.turn_id;
          delete outputs.type;

          Object.assign(toolCall.outputs, outputs);
        }

        if (payload.type === "exec_command_end") {
          const hookSkill = detectHookSkill(payload.command);
          if (hookSkill != null) {
            const skillDef = skillDefinitions.get(hookSkill.skillName);
            applyHookSkillToolCall(toolCall, hookSkill, skillDef, "hook_execution");
          }
        }
      }

      if (payload.type === "list_skills_response") {
        task ??= createTask();
        for (const skill of payload.skills) {
          const name = getSkillName(skill);
          if (name != null) skillDefinitions.set(name, skill);
        }
        addSyntheticSkillEvent(task, eventTime, "skill.list_skills", { skills: payload.skills });
      }

      if (payload.type === "skills_update_available") {
        task ??= createTask();
        addSyntheticSkillEvent(task, eventTime, "skill.skills_update_available", {
          update_available: true,
        });
      }

      if (payload.type === "token_count") {
        task ??= createTask();

        // Token count is usually sent after LLM finishes, so we attach the token count to last response item
        const last = task?.messages.at(-1);
        if (last != null) last.tokenCount = payload.info?.last_token_usage;

        // Also update last message as well
        task.tokenCount = payload.info ?? undefined;
      }

      if (payload.type === "collab_agent_spawn_end") {
        if (payload.new_thread_id != null) {
          task ??= createTask();
          task.messages.at(-1)?.subagentThreads.push(payload.new_thread_id);
        }
      }

      if (payload.type === "task_complete" || payload.type === "turn_aborted") {
        task ??= createTask();
        const completedTurnId = task.turnId?.id;
        if (completedTurnId == null || !uploadedTurnIds.has(completedTurnId)) {
          await postTurn(task, sessionMeta, { rolloutFile, options });
          if (completedTurnId != null) {
            uploadedTurnIds.add(completedTurnId);
            await markTurnUploaded(rolloutFile, completedTurnId);
          }
        }
        task = undefined;
      }
    }
  }

  // Trailing in-progress task: post if we haven't already uploaded this turn.
  // We intentionally do not mark it as uploaded here because the turn has not
  // completed yet; the completion handler above will mark it on the next hook
  // invocation once `task_complete`/`turn_aborted` is observed.
  if (task != null) {
    const trailingTurnId = task.turnId?.id;
    if (trailingTurnId == null || !uploadedTurnIds.has(trailingTurnId)) {
      await postTurn(task, sessionMeta, { rolloutFile, options });
    }
    task = undefined;
  }

  await Promise.all(PROMISE_QUEUE);
}
