import type { LineSchema, ResponseItem, SubagentSource } from "./types.js";
import { Client, RunTreeConfig, RunTree } from "langsmith";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { findLast } from "./utils/findLast.js";
import { loadUploadedTurnIds, markTurnUploaded } from "./sidecar.js";
import { codingAgentMetadata, resolveGitInfo } from "./metadata.js";
import type {
  Session,
  TokenCount,
  AggregateMessage,
  MergedMessage,
  Task,
  StandardMessage,
} from "./types.js";
import { isPrimitive } from "./utils/isPrimitive.js";
import { enumerate } from "./utils/enumerate.js";

async function loadSession(name: string) {
  const data = await fs.readFile(name, "utf-8");

  const result = data
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LineSchema);

  return result;
}

// spawn_agent's output carries the child thread id as `agent_id` (string or object).
function extractSpawnedAgentId(output: unknown): string | undefined {
  let obj: unknown = output;
  if (typeof output === "string") {
    try {
      obj = JSON.parse(output);
    } catch {
      return undefined;
    }
  }
  if (obj != null && typeof obj === "object") {
    const id = (obj as { agent_id?: unknown }).agent_id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

// Anchor at the real sessions root (override, nearest `sessions` ancestor, or
// ~/.codex/sessions) rather than a fragile fixed depth.
function resolveSessionsRoot(parentFileName: string, sessionsRoot?: string): string {
  if (sessionsRoot) return sessionsRoot;

  let dir = path.dirname(path.resolve(parentFileName));
  while (true) {
    if (path.basename(dir) === "sessions") return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.join(os.homedir(), ".codex", "sessions");
}

// Recursively find the rollout file whose name ends with the subagent's thread id.
async function findRolloutFileByThreadId(
  parentFileName: string,
  threadId: string,
  sessionsRoot?: string,
): Promise<string | undefined> {
  const suffix = `-${threadId}.jsonl`;
  const root = resolveSessionsRoot(parentFileName, sessionsRoot);

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
      const name = message.name;
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

// Null run-type-scoped keys on llm/tool runs to override langsmith's
// parent->child metadata inheritance (serialization drops undefined).
const CHILD_SCOPE_RESET = {
  approval_policy: undefined,
  ls_subagent_id: undefined,
  ls_subagent_type: undefined,
} as const;

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
      sessionsRoot?: string;

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

  // Codex turn-context carries the workspace + policy details for this turn.
  const cwd =
    (typeof task.context?.cwd === "string" ? task.context.cwd : undefined) ?? sessionMeta?.cwd;

  const sandboxType = (() => {
    const policy = task.context?.sandbox_policy;
    if (typeof policy === "string") return policy;
    if (policy != null && typeof policy === "object") {
      const type = (policy as { type?: unknown }).type;
      if (typeof type === "string") return type;
    }
    return undefined;
  })();

  const approvalPolicy = (() => {
    const policy = task.context?.approval_policy;
    if (typeof policy === "string") return policy;
    if (policy != null) return JSON.stringify(policy);
    return undefined;
  })();

  const git = await resolveGitInfo(cwd, sessionMeta?.git);

  const isSubagent = sessionMeta?.is_subagent === true;

  // Subagents are separate rollouts; group under the parent thread, not their own.
  const conversationThreadId =
    (isSubagent ? sessionMeta?.parent_thread_id : undefined) ?? sessionMeta?.session_id;

  // coding-agent-v1 base contract, stamped onto every run below.
  const base = codingAgentMetadata({
    threadId: conversationThreadId,
    turnId: task.turnId?.id,
    turnNumber: task.turnNumber,
    cliVersion: sessionMeta?.cli_version,
    cwd,
    git,
    sandboxType,
  });

  // Scope-restricted keys: approval_policy on root only, ls_subagent_* on
  // subagent only. Set undefined elsewhere to override inherited values.
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
        ...base,

        approval_policy: isSubagent ? undefined : approvalPolicy,
        ls_subagent_id: isSubagent ? sessionMeta?.session_id : undefined,
        ls_subagent_type: isSubagent
          ? (sessionMeta?.agent_role ?? sessionMeta?.agent_nickname)
          : undefined,

        // Deprecated compat aliases (>=1 release): codex_cli_version,
        // ls_agent_type.
        codex_cli_version: sessionMeta?.cli_version,
        ls_agent_type: isSubagent ? "subagent" : "root",
        ls_message_format: "anthropic",

        // Non-reserved key: backend auto-aggregates child llm usage into the
        // parent, so usage_metadata here would double-count.
        ls_raw_aggregated_usage: getUsageMetadata(task.tokenCount?.total_token_usage),
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

  for (const output of outputs) {
    const inputMessages = fullMessages.slice(0, output.start);
    const aiMessage = fullMessages.slice(output.start, output.start + 1);
    const toolMessages = fullMessages.slice(output.start + 1, output.start + output.length);

    // Span the LLM from the prior message to its response, not its own instant.
    const outputStartTime =
      inputMessages.at(-1)?.timestamp.end ?? aiMessage.at(0)?.timestamp.start ?? parentStartTime;
    const outputEndTime = Math.max(
      aiMessage.at(-1)?.timestamp.end ?? outputStartTime,
      outputStartTime,
    );

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
          ...base,
          ...CHILD_SCOPE_RESET,
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

      // Span the tool from its call to its output (begin/end events if present).
      const callTime = aiMessage.at(0)?.timestamp.start;
      const min = Math.min(
        toolMessage.timestamp.start,
        ...(callTime != null ? [callTime] : []),
        ...toolCall.timings,
      );
      const max = Math.max(toolMessage.timestamp.end, ...toolCall.timings);

      const nativeToolName = typeof msgToolCall.name === "string" ? msgToolCall.name : undefined;
      const runName = nativeToolName ?? "openai.codex.tool";

      const toolRun = parent.createChild({
        name: runName,
        run_type: "tool",
        start_time: min,
        end_time: max,
        inputs: { input: msgToolCall.args },
        outputs: { ...toolCall.outputs, messages: [toolMessage.message] },
        error: toolCall.error,
        extra: {
          metadata: {
            ...options?.metadata,
            ...base,
            ...CHILD_SCOPE_RESET,
            ls_model_type: "chat",
            ls_provider: sessionMeta?.model_provider,
            ls_model_name: task.context?.model,
            ls_invocation_params: task.context,
            usage_metadata: getUsageMetadata(toolMessage.tokenCount),
            // Native tool name, only when it differs from the run name.
            ...(nativeToolName != null && runName !== nativeToolName
              ? { ls_tool_name: nativeToolName }
              : {}),
          },
        },
      });
      PROMISE_QUEUE.push(toolRun.postRun());
    }

    for (const subagentThread of subagentThreads ?? []) {
      const subagentFile = await findRolloutFileByThreadId(
        rolloutFile,
        subagentThread,
        options?.sessionsRoot,
      );

      if (subagentFile == null) {
        continue;
      }

      const lastTurnId = await (async () => {
        const events = await loadSession(subagentFile);
        const lastEvent = findLast(
          events,
          (e) => e.type === "event_msg" && e.payload.turn_id != null,
        ) as { payload: { turn_id: string } } | undefined;
        return lastEvent?.payload.turn_id ?? null;
      })();

      await convertToRunTree(
        { transcript_path: subagentFile, turn_id: lastTurnId },
        { ...options, parentRunTree: parent, debugNow },
      );
    }
  }
}

export async function convertToRunTree(
  input: { transcript_path: string; turn_id: string | null },
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

  function createTask(): Task {
    return {
      turnId: undefined,
      turnNumber: undefined,
      messages: [],
      userMessageIndex: undefined,
      context: undefined,
      tokenCount: undefined,
      toolCalls: {},
    };
  }

  // 1-based native turn index within this thread; incremented per task_started.
  let turnNumber = 0;

  // spawn_agent call_id → its AI message, so the child id from the matching
  // function_call_output attaches there.
  const spawnAgentMessages = new Map<string, { subagentThreads: string[] }>();

  // Turns that have already been uploaded in a previous hook invocation for the
  // same rollout file. Used to avoid replaying completed turns when the user
  // resumes or continues a conversation.
  const uploadedTurnIds = await loadUploadedTurnIds(input.transcript_path);
  const events = await loadSession(input.transcript_path);
  for (const [index, { type, payload, timestamp }, arr] of enumerate(events)) {
    if (type === "session_meta") {
      // Subagent threads carry `source.subagent.thread_spawn`; roots use "cli".
      const source = payload.source;
      const threadSpawn =
        source != null && typeof source === "object" && "subagent" in source
          ? (source as SubagentSource).subagent?.thread_spawn
          : undefined;

      sessionMeta = {
        session_id: payload.id,
        model_provider: payload.model_provider ?? undefined,
        base_instructions: payload.base_instructions?.text,
        cli_version: payload.cli_version,
        cwd: payload.cwd,
        git: payload.git,
        is_subagent: threadSpawn != null,
        parent_thread_id: threadSpawn?.parent_thread_id ?? undefined,
        agent_role: threadSpawn?.agent_role ?? payload.agent_role ?? undefined,
        agent_nickname: threadSpawn?.agent_nickname ?? payload.agent_nickname ?? undefined,
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

      // multi_agent_v1 discovery: attach the child id from spawn_agent's output.
      if (payload.type === "function_call" && payload.name === "spawn_agent") {
        spawnAgentMessages.set(payload.call_id, message);
      } else if (
        payload.type === "function_call_output" &&
        spawnAgentMessages.has(payload.call_id)
      ) {
        const childId = extractSpawnedAgentId(payload.output);
        if (childId != null) spawnAgentMessages.get(payload.call_id)?.subagentThreads.push(childId);
      }

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
        turnNumber += 1;
        task.turnId = { id: payload.turn_id, timestamp: eventTime };
        task.turnNumber = turnNumber;
      }

      if (typeof payload.call_id === "string") {
        task ??= createTask();
        task.toolCalls[payload.call_id] ??= { error: undefined, timings: [], outputs: {} };
        task.toolCalls[payload.call_id].timings.push(eventTime);

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
            task.toolCalls[payload.call_id].error =
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

          Object.assign(task.toolCalls[payload.call_id].outputs, outputs);
        }
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

      if (
        payload.type === "task_complete" ||
        payload.type === "turn_aborted" ||
        (task != null && index === arr.length - 1 && input.turn_id != null)
      ) {
        task ??= createTask();
        const completedTurnId = task.turnId?.id ?? input.turn_id ?? undefined;
        // Ensure a turn marker for turns completed without a task_started.
        if (task.turnId == null && completedTurnId != null) {
          task.turnId = { id: completedTurnId, timestamp: eventTime };
        }
        if (task.turnNumber == null) {
          turnNumber += 1;
          task.turnNumber = turnNumber;
        }
        if (completedTurnId == null || !uploadedTurnIds.has(completedTurnId)) {
          await postTurn(task, sessionMeta, { rolloutFile: input.transcript_path, options });
          if (completedTurnId != null) {
            uploadedTurnIds.add(completedTurnId);
            await markTurnUploaded(input.transcript_path, completedTurnId);
          }
        }
        task = undefined;
      }
    }
  }

  await Promise.all(PROMISE_QUEUE);
}
