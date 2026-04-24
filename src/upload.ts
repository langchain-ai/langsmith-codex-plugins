import type { LineSchema, ResponseItem } from "./types";
import { Client, RunTreeConfig } from "langsmith";
import { RunTree } from "langsmith/run_trees";

import * as fs from "node:fs/promises";
import * as path from "node:path";

import type {
  Session,
  TokenCount,
  AggregateMessage,
  MergedMessage,
  Task,
  StandardMessage,
} from "./types";

const findLast = <T>(
  array: T[],
  predicate: (item: T) => boolean,
): T | undefined => {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) return array[i];
  }
  return undefined;
};

async function loadSession(name: string) {
  const data = await fs.readFile(name, "utf-8");

  const result = data
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LineSchema);

  return result;
}

// Sidecar file that records turn ids already uploaded for a given rollout so
// that resuming / continuing a conversation does not replay completed turns.
const UPLOADED_SIDECAR_SUFFIX = ".ls-uploaded";

function getUploadedSidecarPath(rolloutFile: string): string {
  return `${rolloutFile}${UPLOADED_SIDECAR_SUFFIX}`;
}

async function loadUploadedTurnIds(rolloutFile: string): Promise<Set<string>> {
  try {
    const data = await fs.readFile(
      getUploadedSidecarPath(rolloutFile),
      "utf-8",
    );
    return new Set(data.split("\n").filter(Boolean));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

async function markTurnUploaded(
  rolloutFile: string,
  turnId: string,
): Promise<void> {
  await fs.appendFile(
    getUploadedSidecarPath(rolloutFile),
    `${turnId}\n`,
    "utf-8",
  );
}

// Rollout files are stored at `<sessionsRoot>/YYYY/MM/DD/rollout-<ts>-<threadId>.jsonl`.
// Given the path of the parent rollout file we walk up to the sessions root and
// recursively look for a file whose name ends with the subagent's thread id.
async function findRolloutFileByThreadId(
  parentFileName: string,
  threadId: string,
): Promise<string | undefined> {
  const suffix = `-${threadId}.jsonl`;
  const sessionsRoot = path.resolve(path.dirname(parentFileName), "../../..");

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

  return walk(sessionsRoot);
}

function mergeMessages(result: AggregateMessage<StandardMessage>[]) {
  return result.reduce<MergedMessage<StandardMessage>[]>(
    (acc, { message, timestamp, tokenCount, subagentThreads }) => {
      const last = acc.length > 0 ? acc[acc.length - 1] : undefined;

      if (
        !["ai", "user", "system"].includes(message.role) ||
        last?.message.role !== message.role
      ) {
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
  return messages.map(
    ({ message, ...rest }): AggregateMessage<StandardMessage> => {
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
              content: [
                { type: "tool_call", name, id, args: JSON.parse(args) },
              ],
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
          typeof message.output === "string"
            ? message.output
            : JSON.stringify(message.output);

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
          typeof message.output === "string"
            ? message.output
            : JSON.stringify(message.output);

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
    },
  );
}

function getUsageMetadata(
  counts: TokenCount | undefined,
): Record<string, unknown> | undefined {
  if (
    counts == null ||
    Object.values(counts ?? {}).every((value) => value == null)
  ) {
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
      parentRunTree?: RunTree;
      client?: Client;
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

  const user =
    task.userMessageIndex != null
      ? messages.at(task.userMessageIndex)
      : undefined;

  const agent = mergeMessages(
    task.userMessageIndex != null
      ? messages.slice(task.userMessageIndex + 1)
      : messages,
  );

  const parentStartTime = task.turnId?.timestamp ?? fallbackTime;
  const parentEndTime = agent.at(-1)?.timestamp.end ?? parentStartTime;

  const parentConfig: RunTreeConfig = {
    name: "openai.codex",
    client: options?.client,
    run_type: "chain",
    inputs: { messages: user != null ? [user.message] : [] },
    outputs: { messages: agent.map((i) => i.message) },
    start_time: parentStartTime,
    end_time: parentEndTime,
    extra: {
      metadata: {
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
  const parent =
    options?.parentRunTree?.createChild(parentConfig) ??
    new RunTree(parentConfig);

  PROMISE_QUEUE.push(parent.postRun());

  const fullMessages = mergeMessages([
    ...getSystemMessage(sessionMeta, task),
    ...messages,
  ]);

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
    const outputMessages = fullMessages.slice(
      output.start,
      output.start + output.length,
    );
    const outputStartTime =
      outputMessages.at(0)?.timestamp.start ?? parentStartTime;
    const outputEndTime =
      outputMessages.at(-1)?.timestamp.end ?? outputStartTime;

    const tokenCounts = findLast(
      outputMessages,
      (i) => i.tokenCount != null,
    )?.tokenCount;

    const subagentThreads = findLast(
      outputMessages,
      (i) => i.subagentThreads.length > 0,
    )?.subagentThreads;

    const child = parent.createChild({
      name: "openai.codex.turn",
      run_type: "llm",
      start_time: outputStartTime,
      end_time: outputEndTime,
      inputs: { messages: inputMessages.map((i) => i.message) },
      outputs: { messages: outputMessages.map((i) => i.message) },
      extra: {
        metadata: {
          ls_model_type: "chat",
          ls_provider: sessionMeta?.model_provider,
          ls_model_name: task.context?.model,
          ls_invocation_params: task.context,
          usage_metadata: getUsageMetadata(tokenCounts),
        },
      },
    });
    PROMISE_QUEUE.push(child.postRun());

    for (const subagentThread of subagentThreads ?? []) {
      const subagentFile = await findRolloutFileByThreadId(
        rolloutFile,
        subagentThread,
      );

      if (subagentFile == null) {
        process.stderr.write(
          `Could not locate rollout file for subagent thread ${subagentThread}`,
        );
        process.stderr.write("\n");
        continue;
      }

      await convertToRunTree(subagentFile, {
        parentRunTree: child,
        client: options?.client,
      });
    }
  }
}

export async function convertToRunTree(
  rolloutFile: string,
  options?: {
    parentRunTree?: RunTree;
    client?: Client;
  },
) {
  let sessionMeta: Session | undefined;
  let task: Task | undefined;

  function createTask(): Task {
    return {
      turnId: undefined,
      messages: [],
      userMessageIndex: undefined,
      context: undefined,
      tokenCount: undefined,
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
    }

    if (type === "turn_context") {
      task ??= createTask();
      task.context = payload;
    }

    if (type === "event_msg") {
      if (payload.type === "task_started") {
        // TODO: should we try to flush?
        task = createTask();
        task.turnId = { id: payload.turn_id, timestamp: Date.parse(timestamp) };
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
