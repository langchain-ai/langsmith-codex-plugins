import type {
  AggregateMessage,
  EventMsgLine,
  EventMsgPayload,
  MergedMessage,
  ResponseItem,
  ResponseItemOf,
  Session,
  SessionMetaPayload,
  StandardMessage,
  SubagentSource,
  Task,
  TokenCount,
  ToolCallRecord,
} from "./models/rollout.js";
import type {
  CompletedTurn,
  ModelSpan,
  RolloutWalk,
  TraceConversionOptions,
  TimeWindow,
  TraceInput,
  MetadataContext,
  TurnDraft,
  TurnMetadata,
  TurnPosition,
  TurnRequest,
  TurnRunContext,
} from "./models/trace-conversion.js";
import type { TurnMode } from "./models/tracing-policy.js";
import type { RunTree, RunTreeConfig } from "langsmith";
import type { ReconstructionToolOrigin } from "@langchain/plugins-base/tracing/reconstruction";
import {
  buildCodingAgentMetadata,
  type CodingAgentMetadataOptions,
} from "@langchain/plugins-base/metadata";

import { findLast } from "./utils/findLast.js";
import { skillNamesFromToolCall } from "./skills.js";
import { isPrimitive } from "./utils/isPrimitive.js";
import { createRunTree } from "./privacy.js";
import { defaultPrivacyPath, inheritThreadMode } from "./tracing-policy.js";
import { enumerate } from "./utils/enumerate.js";
import { isRecord } from "./utils/isRecord.js";
import { omitKey } from "./utils/omitKey.js";
import { toolOriginFromArgs } from "./tool-path.js";
import { loadSession, findRolloutFileByThreadId } from "./utils/rollout.js";
import { extractSpawnedAgentId, extractSubagentActivities } from "./utils/subagents.js";
import { rolloutTurnMode } from "./turn-mode.js";
import {
  CHILD_SCOPE_RESET,
  FAILED_TOOL_STATUSES,
  ITEM_COMPLETED_EVENT,
  LS_INTEGRATION,
  LS_INTEGRATION_VERSION,
  MODE_FULL,
  MODE_METADATA,
  MODE_OFF,
  OPEN_TURN_END,
  SKILL_SCOPE_RESET,
  SUBAGENT_SCOPE_RESET,
  TOOL_END_EVENT_SUFFIX,
  TOOL_ITEM_TYPES,
  TOOL_STATUS_ERROR_PREFIX,
} from "./constants.js";

function formatError(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  if (isPrimitive(value)) return String(value);

  if (isRecord(value)) {
    const message = typeof value.message === "string" ? value.message : undefined;
    const details =
      typeof value.additional_details === "string" ? value.additional_details : undefined;
    const info = value.codex_error_info;
    const infoText =
      typeof info === "string" ? info : info != null ? JSON.stringify(info) : undefined;
    const parts = [message, details, infoText].filter((part) => part != null && part.length > 0);
    if (parts.length > 0) return parts.join(" — ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

function convertMessage(message: ResponseItemOf<"message">): StandardMessage {
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

  return { role, content };
}

function convertFunctionCall(message: ResponseItemOf<"function_call">): StandardMessage {
  const name = message.name;
  const id = message.call_id;
  const args = message.arguments;

  try {
    return {
      role: "ai",
      content: [{ type: "tool_call", name, id, args: JSON.parse(args) }],
    };
  } catch {
    return {
      role: "ai",
      content: [{ type: "tool_call_chunk", name, id, args }],
    };
  }
}

function convertToolOutput(
  message: ResponseItemOf<"function_call_output"> | ResponseItemOf<"custom_tool_call_output">,
): StandardMessage {
  const text = typeof message.output === "string" ? message.output : JSON.stringify(message.output);

  return {
    role: "tool",
    content: [{ type: "text", text }],
    tool_call_id: message.call_id,
  };
}

function convertCustomToolCall(message: ResponseItemOf<"custom_tool_call">): StandardMessage {
  const name = message.name;
  const id = message.call_id;

  return {
    role: "ai",
    content: [{ type: "tool_call", name, id, args: message.input }],
  };
}

function convertToolSearchCall(message: ResponseItemOf<"tool_search_call">): StandardMessage {
  return {
    role: "ai",
    content: [
      {
        type: "tool_call",
        name: message.type,
        id: message.call_id,
        args: message.arguments,
      },
    ],
  };
}

function convertToolSearchOutput(message: ResponseItemOf<"tool_search_output">): StandardMessage {
  const text = JSON.stringify(message.tools);
  return {
    role: "tool",
    content: [{ type: "text", text }],
    tool_call_id: message.call_id,
  };
}

function convertReasoning(message: ResponseItemOf<"reasoning">): StandardMessage {
  // Only include reasoning if it has non-encrypted content
  const { type: _, content: reasoningRaw, ...extras } = message;

  const reasoning = message.content
    ? typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content)
    : undefined;

  return {
    role: "ai",
    content: [{ type: "reasoning", reasoning, extras }],
  };
}

function convertItem(message: ResponseItem): StandardMessage {
  if (message.type === "message") return convertMessage(message);
  if (message.type === "function_call") return convertFunctionCall(message);
  if (message.type === "function_call_output") return convertToolOutput(message);
  if (message.type === "custom_tool_call") return convertCustomToolCall(message);
  if (message.type === "custom_tool_call_output") return convertToolOutput(message);
  if (message.type === "tool_search_call") return convertToolSearchCall(message);
  if (message.type === "tool_search_output") return convertToolSearchOutput(message);
  if (message.type === "reasoning") return convertReasoning(message);

  return {
    role: "unknown",
    content: [{ type: "non_standard", value: message }],
    _raw: message,
  };
}

function convertToStandardMessages(messages: AggregateMessage<ResponseItem>[]) {
  return messages.map(({ message, ...rest }): AggregateMessage<StandardMessage> => ({
    message: convertItem(message),
    ...rest,
  }));
}

function buildChildRunMetadata(
  options: CodingAgentMetadataOptions,
  reset: Record<string, undefined> = CHILD_SCOPE_RESET,
): Record<string, unknown> {
  return Object.assign(buildCodingAgentMetadata(options), reset);
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

function getSystemMessage(
  session: Session | undefined,
  task: Task | undefined,
): AggregateMessage<StandardMessage>[] {
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
}

async function resolveTurnMode(
  task: Task,
  sessionMeta: Session | undefined,
  privacyTurnId: string | undefined,
  request: TurnRequest,
): Promise<TurnMode> {
  const nativeMode = sessionMeta?.session_id
    ? await rolloutTurnMode(request.rolloutFile, sessionMeta.session_id, privacyTurnId)
    : MODE_METADATA;
  const mode: TurnMode =
    nativeMode === MODE_OFF
      ? MODE_OFF
      : request.options.privacyMode === MODE_METADATA || nativeMode === MODE_METADATA
        ? MODE_METADATA
        : MODE_FULL;
  // Persist launch inheritance even when master-off evidence skips this turn.
  for (const child of task.subagentThreads) {
    try {
      await inheritThreadMode(defaultPrivacyPath(), child, mode);
    } catch {
      /* Corrupt/unwritable policy is resolved metadata-only by child uploads. */
    }
  }
  return mode;
}

function turnMetadata(
  task: Task,
  sessionMeta: Session | undefined,
  options: TraceConversionOptions,
): TurnMetadata {
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

  const isSubagent = sessionMeta?.is_subagent === true;

  // Subagents are separate rollouts; group under the parent thread, not their own.
  const conversationThreadId =
    (isSubagent ? sessionMeta?.parent_thread_id : undefined) ?? sessionMeta?.session_id;

  // coding-agent-v1 base contract, stamped onto every run below.
  const metadataBase = {
    ...options.metadata,
    ...omitKey(task.context, "approval_policy"),
    ...(cwd === undefined ? {} : { cwd }),
    ...(sandboxType === undefined ? {} : { sandbox_type: sandboxType }),
  };
  const metadataContext: MetadataContext = {
    integration: LS_INTEGRATION,
    integrationVersion: LS_INTEGRATION_VERSION,
    runtimeVersion: sessionMeta?.cli_version,
    threadId: conversationThreadId ?? "",
    turnId: task.turnId?.id,
    turnNumber: task.turnNumber,
    agentType: isSubagent ? ("subagent" as const) : ("root" as const),
  };

  return { metadataContext, metadataBase, isSubagent, approvalPolicy, cwd };
}

function parentProviderMetadata(task: Task, sessionMeta: Session | undefined) {
  return {
    codex_cli_version: sessionMeta?.cli_version,
    ls_message_format: "anthropic",
    // Non-reserved key: backend auto-aggregates child llm usage into the
    // parent, so usage_metadata here would double-count.
    ls_raw_aggregated_usage: getUsageMetadata(task.tokenCount?.total_token_usage),
  };
}

async function createParentRun(
  draft: TurnDraft,
  user: AggregateMessage<StandardMessage> | undefined,
  agent: MergedMessage<StandardMessage>[],
): Promise<RunTree> {
  const { task, sessionMeta, isSubagent, approvalPolicy, metadataContext, metadataBase } = draft;
  const { mode, parentStartTime } = draft;
  const options = draft.request.options;
  const parentEndTime = agent.at(-1)?.timestamp.end ?? parentStartTime;

  // Scope-restricted keys: approval_policy on root only, ls_subagent_* on
  // subagent only. Set undefined elsewhere to override inherited values.
  const parentMetadata: CodingAgentMetadataOptions = {
    ...metadataContext,
    runType: task.isErrorInterrupt ? "interrupted" : "root",
    approvalPolicy: isSubagent ? undefined : approvalPolicy,
    subagentId: isSubagent ? sessionMeta?.session_id : undefined,
    subagentType: isSubagent ? (sessionMeta?.agent_role ?? sessionMeta?.agent_nickname) : undefined,
    providerMetadata: parentProviderMetadata(task, sessionMeta),
    base: {
      ...metadataBase,
      ...(task.isErrorInterrupt ? { ls_is_error_interrupt: true } : {}),
    },
  };
  const parentConfig: RunTreeConfig = {
    id: options.nextRunId(),
    name: "openai.codex",
    client: options.client,
    project_name: options.projectName,
    run_type: "chain",
    replicas: options.replicas,
    inputs: { messages: user != null ? [user.message] : [] },
    outputs: { messages: agent.map((i) => i.message) },
    error: task.error,
    start_time: parentStartTime,
    end_time: parentEndTime,
    extra: {
      metadata: Object.assign(
        buildCodingAgentMetadata(parentMetadata),
        isSubagent ? SUBAGENT_SCOPE_RESET : {},
      ),
    },
  };
  const parent = createRunTree(parentConfig, mode, options.parentRunTree);

  await options.captureRun(parent, mode, parentMetadata);
  return parent;
}

function modelSpans(
  fullMessages: MergedMessage<StandardMessage>[],
  includeOpenTurn = false,
): ModelSpan[] {
  const aiMessageIndicies = fullMessages.reduce<number[]>((acc, item, idx) => {
    if (item.message.role === "ai") acc.push(idx);
    return acc;
  }, []);

  return aiMessageIndicies.map((start) => {
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
    if (includeOpenTurn && nonToolIdx === -1) return { start, length: fullMessages.length - start };

    return { start, length: 1 };
  });
}

async function postSubagentThread(context: TurnRunContext, subagentThread: string) {
  if (context.postedSubagentThreads.has(subagentThread)) return;
  context.postedSubagentThreads.add(subagentThread);

  const subagentFile = await findRolloutFileByThreadId(context.request.rolloutFile, subagentThread);
  if (subagentFile == null) return;

  const events = await loadSession(subagentFile);
  const lastEvent = findLast(
    events,
    (event) => event.type === "event_msg" && event.payload.turn_id != null,
  ) as { payload: { turn_id: string } } | undefined;

  await convertToRunTree(
    { transcript_path: subagentFile, turn_id: lastEvent?.payload.turn_id ?? null },
    { ...context.request.options, parentRunTree: context.parent, replayHistory: true },
  );
}

async function postModelRun(
  context: TurnRunContext,
  fullMessages: MergedMessage<StandardMessage>[],
  output: ModelSpan,
) {
  const { task, sessionMeta, metadataContext, childMetadataBase, mode, parent } = context;
  const { parentStartTime } = context;
  const options = context.request.options;
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
    (message) => message.subagentThreads.length > 0,
  )?.subagentThreads;

  const llmMetadata: CodingAgentMetadataOptions = {
    ...metadataContext,
    runType: "llm",
    clearSubagent: true,
    modelName: typeof task.context?.model === "string" ? task.context.model : undefined,
    usageMetadata: getUsageMetadata(tokenCounts),
    providerMetadata: {
      ls_model_type: "chat",
      ls_provider: sessionMeta?.model_provider ?? undefined,
      ls_invocation_params: task.context,
    },
    base: childMetadataBase,
  };
  const llmChild = createRunTree(
    {
      id: options.nextRunId(),
      name: "openai.codex.turn",
      run_type: "llm",
      start_time: outputStartTime,
      end_time: outputEndTime,
      inputs: { messages: inputMessages.map((i) => i.message) },
      outputs: { messages: aiMessage.map((i) => i.message) },
      extra: {
        metadata: buildChildRunMetadata(llmMetadata),
      },
    },
    mode,
    parent,
  );
  await options.captureRun(llmChild, mode, llmMetadata);

  return { aiMessage, toolMessages, subagentThreads };
}

async function postSkillRuns(
  context: TurnRunContext,
  skillNames: string[],
  window: TimeWindow,
  toolCall: Task["toolCalls"][string],
) {
  const { metadataContext, childMetadataBase, mode, parent } = context;
  const { min, max } = window;
  const options = context.request.options;
  for (const skillName of skillNames) {
    const skillMetadata: CodingAgentMetadataOptions = {
      ...metadataContext,
      runType: "tool",
      clearSubagent: true,
      skillName,
      base: childMetadataBase,
    };
    const skillRun = createRunTree(
      {
        id: options.nextRunId(),
        name: "Skill",
        run_type: "tool",
        // Only the call's own window is known, not when each read ran inside it.
        start_time: min,
        end_time: max,
        // Wrapped like every other tool run, so one JSON path fits every harness.
        inputs: { input: { skill: skillName } },
        // The rollout never shows the skill's own result, only the read's.
        outputs: { output: { commandName: skillName, success: toolCall.error == null } },
        extra: {
          metadata: buildChildRunMetadata(skillMetadata, SKILL_SCOPE_RESET),
        },
      },
      mode,
      parent,
    );
    await options.captureRun(skillRun, mode, skillMetadata);
  }
}

async function postToolRuns(
  context: TurnRunContext,
  aiMessage: MergedMessage<StandardMessage>[],
  toolMessages: MergedMessage<StandardMessage>[],
) {
  const { task, sessionMeta, metadataContext, childMetadataBase, mode, parent } = context;
  const options = context.request.options;
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

    const skillNames = skillNamesFromToolCall(nativeToolName, msgToolCall.args);

    const toolMetadata: CodingAgentMetadataOptions = {
      ...metadataContext,
      runType: "tool",
      clearSubagent: true,
      modelName: typeof task.context?.model === "string" ? task.context.model : undefined,
      usageMetadata: getUsageMetadata(toolMessage.tokenCount),
      ...(nativeToolName == null ? {} : { toolName: nativeToolName, runName }),
      providerMetadata: {
        ls_model_type: "chat",
        ls_provider: sessionMeta?.model_provider ?? undefined,
        ls_invocation_params: task.context,
      },
      base: toolMetadataBase(context, msgToolCall.args),
    };
    const sequentialId = options.nextRunId();
    const toolRun = createRunTree(
      {
        id: options.toolRunId?.(toolCallId) ?? sequentialId,
        name: runName,
        run_type: "tool",
        start_time: min,
        end_time: max,
        inputs: { input: msgToolCall.args },
        outputs: { ...toolCall.outputs, messages: [toolMessage.message] },
        error: toolCall.error,
        extra: {
          metadata: buildChildRunMetadata(toolMetadata),
        },
      },
      mode,
      parent,
    );
    await options.captureRun(toolRun, mode, toolMetadata);

    await postSkillRuns(context, skillNames, { min, max }, toolCall);
  }
}

async function postModelAndToolRuns(
  context: TurnRunContext,
  messages: AggregateMessage<StandardMessage>[],
) {
  const fullMessages = mergeMessages([
    ...getSystemMessage(context.sessionMeta, context.task),
    ...messages,
  ]);

  for (const output of modelSpans(fullMessages, context.request.includeOpenTurn)) {
    const { aiMessage, toolMessages, subagentThreads } = await postModelRun(
      context,
      fullMessages,
      output,
    );
    await postToolRuns(context, aiMessage, toolMessages);

    for (const subagentThread of subagentThreads ?? []) {
      await postSubagentThread(context, subagentThread);
    }
  }
}

async function postTurn(
  task: Task,
  sessionMeta: Session | undefined,
  privacyTurnId: string | undefined,
  request: TurnRequest,
) {
  const mode = await resolveTurnMode(task, sessionMeta, privacyTurnId, request);
  if (mode === MODE_OFF) return;
  const fallbackTime = Date.now();

  const messages = convertToStandardMessages(task.messages);

  const user = task.userMessageIndex != null ? messages.at(task.userMessageIndex) : undefined;

  const agent = mergeMessages(
    task.userMessageIndex != null ? messages.slice(task.userMessageIndex + 1) : messages,
  );

  const parentStartTime = task.turnId?.timestamp ?? fallbackTime;

  const unattributed = turnMetadata(task, sessionMeta, request.options);
  const attributor = mode === MODE_FULL ? request.options.attributor : undefined;
  const origins = attributor ? toolOrigins(messages, unattributed.cwd) : [];
  const draft: TurnDraft = {
    ...unattributed,
    metadataBase:
      attributor?.turnMetadata(unattributed.metadataBase, unattributed.cwd, origins) ??
      unattributed.metadataBase,
    task,
    sessionMeta,
    request,
    mode,
    parentStartTime,
  };
  const context: TurnRunContext = {
    ...draft,
    childMetadataBase: childBase(draft.metadataBase, draft),
    unattributedChildBase: childBase(unattributed.metadataBase, draft),
    parent: await createParentRun(draft, user, agent),
    postedSubagentThreads: new Set<string>(),
  };

  await postModelAndToolRuns(context, messages);

  // Canonical activity records can arrive without a matching response item.
  for (const subagentThread of task.subagentThreads) {
    await postSubagentThread(context, subagentThread);
  }
}

function childBase(base: Record<string, unknown>, draft: TurnDraft): Record<string, unknown> {
  return draft.mode === MODE_FULL
    ? {
        ...base,
        ...omitKey(
          parentProviderMetadata(draft.task, draft.sessionMeta),
          "ls_raw_aggregated_usage",
        ),
      }
    : base;
}

function toolOrigins(
  messages: AggregateMessage<StandardMessage>[],
  cwd: string | undefined,
): ReconstructionToolOrigin[] {
  return messages.flatMap(({ message }) =>
    message.role === "ai"
      ? message.content
          .filter((c) => c.type === "tool_call")
          .map((c) => toolOriginFromArgs(c.args, cwd))
      : [],
  );
}

function toolMetadataBase(context: TurnRunContext, args: unknown): Record<string, unknown> {
  const attributor = context.mode === MODE_FULL ? context.request.options.attributor : undefined;
  if (!attributor) return context.childMetadataBase;
  const origin = toolOriginFromArgs(args, context.cwd);
  return (
    attributor.toolMetadata(context.unattributedChildBase, origin) ?? context.childMetadataBase
  );
}

function createTask(): Task {
  return {
    turnId: undefined,
    turnNumber: undefined,
    messages: [],
    userMessageIndex: undefined,
    context: undefined,
    tokenCount: undefined,
    error: undefined,
    isErrorInterrupt: false,
    subagentThreads: [],
    toolCalls: {},
  };
}

function recordSubagentThread(walk: RolloutWalk, task: Task, threadId: string, callId?: string) {
  if (!task.subagentThreads.includes(threadId)) task.subagentThreads.push(threadId);

  if (callId == null) return;
  const message = walk.spawnAgentMessages.get(callId);
  if (message != null && !message.subagentThreads.includes(threadId)) {
    message.subagentThreads.push(threadId);
  }
}

function readSessionMeta(payload: SessionMetaPayload): Session {
  // Subagent threads carry `source.subagent.thread_spawn`; roots use "cli".
  const source = payload.source;
  const threadSpawn =
    source != null && typeof source === "object" && "subagent" in source
      ? (source as SubagentSource).subagent?.thread_spawn
      : undefined;

  const isSubagent =
    threadSpawn != null ||
    (payload.thread_source === "subagent" && typeof payload.parent_thread_id === "string");

  return {
    session_id: payload.id,
    model_provider: payload.model_provider ?? undefined,
    base_instructions: payload.base_instructions?.text,
    cli_version: payload.cli_version,
    cwd: payload.cwd,
    is_subagent: isSubagent,
    parent_thread_id: threadSpawn?.parent_thread_id ?? payload.parent_thread_id ?? undefined,
    agent_role: threadSpawn?.agent_role ?? payload.agent_role ?? undefined,
    agent_nickname: threadSpawn?.agent_nickname ?? payload.agent_nickname ?? undefined,
  };
}

function recordResponseItem(walk: RolloutWalk, payload: ResponseItem, timestamp: string) {
  walk.task ??= createTask();
  const task = walk.task;
  const message = {
    timestamp: Date.parse(timestamp),
    message: payload,
    tokenCount: undefined,
    subagentThreads: [],
  };
  task.messages.push(message);

  // multi_agent_v1 discovery: attach the child id from spawn_agent's output.
  if (payload.type === "function_call" && payload.name === "spawn_agent") {
    walk.spawnAgentMessages.set(payload.call_id, message);
  } else if (
    payload.type === "function_call_output" &&
    walk.spawnAgentMessages.has(payload.call_id)
  ) {
    const childId = extractSpawnedAgentId(payload.output);
    if (childId != null) recordSubagentThread(walk, task, childId, payload.call_id);
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

function toolCallEntry(task: Task, callId: string) {
  task.toolCalls[callId] ??= { error: undefined, timings: [], outputs: {} };
  return task.toolCalls[callId];
}

function recordToolCallEnd(
  toolCall: ToolCallRecord,
  payload: Record<string, unknown>,
  outputs: Record<string, unknown>,
) {
  // attempt to find an error message
  if (FAILED_TOOL_STATUSES.includes(payload.status)) {
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
      error != null ? (isPrimitive(error) ? String(error) : JSON.stringify(error)) : undefined;
  }

  Object.assign(toolCall.outputs, outputs);
}

function recordToolCallEvent(task: Task, payload: EventMsgPayload, eventTime: number) {
  const toolCall = toolCallEntry(task, payload.call_id as string);
  toolCall.timings.push(eventTime);

  if (payload.type.endsWith(TOOL_END_EVENT_SUFFIX)) {
    const outputs: Record<string, unknown> = { ...payload };
    delete outputs.call_id;
    delete outputs.turn_id;
    delete outputs.type;

    recordToolCallEnd(toolCall, payload, outputs);
  }
}

function recordToolItem(task: Task, item: Record<string, unknown>, eventTime: number) {
  const toolCall = toolCallEntry(task, item.id as string);
  toolCall.timings.push(eventTime);

  const outputs: Record<string, unknown> = { ...item };
  delete outputs.id;
  delete outputs.type;

  recordToolCallEnd(toolCall, item, outputs);
  if (FAILED_TOOL_STATUSES.includes(item.status)) {
    toolCall.error =
      toolItemErrorText(item) ?? toolCall.error ?? `${TOOL_STATUS_ERROR_PREFIX}${item.status}`;
  }
}

function toolItemErrorText(item: Record<string, unknown>) {
  if (isRecord(item.error) && typeof item.error.message === "string") return item.error.message;
  if (!isRecord(item.result) || !Array.isArray(item.result.content)) return undefined;
  const text = item.result.content
    .filter((part) => isRecord(part) && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
  return text || undefined;
}

function recordTurnError(task: Task, payload: EventMsgPayload) {
  if (payload.type === "stream_error") {
    task.error = formatError(payload);
  }

  if (payload.type === "task_complete" || payload.type === "turn_complete") {
    task.error = formatError(payload.error);
  }

  if (payload.type === "turn_aborted") {
    const explicitError = formatError(payload.error);
    if (explicitError != null) {
      task.error = explicitError;
    } else if (task.error == null && payload.reason !== "review_ended") {
      const interrupted = payload.reason === "interrupted";
      task.isErrorInterrupt = interrupted;
      task.error = interrupted ? "Turn interrupted" : `Turn aborted: ${payload.reason}`;
    }
  }
}

function recordEventMessage(walk: RolloutWalk, payload: EventMsgPayload, eventTime: number) {
  if (payload.type === "task_started") {
    // TODO: should we try to flush?
    walk.task = createTask();
    walk.turnNumber += 1;
    walk.task.turnId = { id: payload.turn_id, timestamp: eventTime };
    walk.task.turnNumber = walk.turnNumber;
  }

  if (typeof payload.call_id === "string") {
    walk.task ??= createTask();
    recordToolCallEvent(walk.task, payload, eventTime);
  }

  if (
    payload.type === ITEM_COMPLETED_EVENT &&
    isRecord(payload.item) &&
    TOOL_ITEM_TYPES.includes(payload.item.type)
  ) {
    walk.task ??= createTask();
    recordToolItem(walk.task, payload.item, eventTime);
  }

  if (payload.type === "token_count") {
    walk.task ??= createTask();
    const task = walk.task;

    // Token count is usually sent after LLM finishes, so we attach the token count to last response item
    const last = task?.messages.at(-1);
    if (last != null) last.tokenCount = payload.info?.last_token_usage;

    // Also update last message as well
    task.tokenCount = payload.info ?? undefined;
  }

  for (const activity of extractSubagentActivities(payload)) {
    walk.task ??= createTask();
    recordSubagentThread(walk, walk.task, activity.threadId, activity.callId);
  }

  if (payload.type === "collab_agent_spawn_end" && payload.new_thread_id != null) {
    walk.task ??= createTask();
    recordSubagentThread(walk, walk.task, payload.new_thread_id, payload.call_id);
  }

  if (
    payload.type === "stream_error" ||
    payload.type === "task_complete" ||
    payload.type === "turn_complete" ||
    payload.type === "turn_aborted"
  ) {
    walk.task ??= createTask();
    recordTurnError(walk.task, payload);
  }
}

function endsTurn(
  walk: RolloutWalk,
  payload: EventMsgPayload,
  position: TurnPosition,
  input: TraceInput,
): boolean {
  return (
    payload.type === "task_complete" ||
    payload.type === "turn_complete" ||
    payload.type === "turn_aborted" ||
    (walk.task != null && position.index === position.length - 1 && input.turn_id != null)
  );
}

async function walkCompletedTurns(
  input: TraceInput,
  onTurn: (turn: CompletedTurn) => Promise<void>,
) {
  const walk: RolloutWalk = {
    sessionMeta: undefined,
    task: undefined,
    // 1-based native turn index within this thread; incremented per task_started.
    turnNumber: 0,
    // spawn_agent call_id → its AI message, so the child id from the matching
    // function_call_output attaches there.
    spawnAgentMessages: new Map<string, { subagentThreads: string[] }>(),
  };

  const events = await loadSession(input.transcript_path);
  const last = events.at(-1);
  if (input.includeOpenTurn && last !== undefined && last.type !== "event_msg") {
    const end: EventMsgLine = {
      timestamp: last.timestamp,
      type: "event_msg",
      payload: { type: OPEN_TURN_END },
    };
    events.push(end);
  }
  for (const [index, { type, payload, timestamp }, arr] of enumerate(events)) {
    if (type === "session_meta") walk.sessionMeta = readSessionMeta(payload);

    if (type === "response_item") recordResponseItem(walk, payload, timestamp);

    if (type === "turn_context") {
      walk.task ??= createTask();
      walk.task.context = payload;
    }

    if (type === "event_msg") {
      const eventTime = Date.parse(timestamp);

      recordEventMessage(walk, payload, eventTime);

      if (endsTurn(walk, payload, { index, length: arr.length }, input)) {
        walk.task ??= createTask();
        const task = walk.task;
        // Delivery may fall back to the Stop ID, but privacy must never assign
        // that current ID to historical content with no native launch evidence.
        const privacyTurnId = task.turnId?.id;
        const completedTurnId = task.turnId?.id ?? input.turn_id ?? undefined;
        // Ensure a turn marker for turns completed without a task_started.
        if (task.turnId == null && completedTurnId != null) {
          task.turnId = { id: completedTurnId, timestamp: eventTime };
        }
        if (task.turnNumber == null) {
          walk.turnNumber += 1;
          task.turnNumber = walk.turnNumber;
        }
        await onTurn({ task, sessionMeta: walk.sessionMeta, privacyTurnId, completedTurnId });
        walk.task = undefined;
      }
    }
  }
}

export async function convertToRunTree(input: TraceInput, options: TraceConversionOptions) {
  const seenTurnIds = new Set<string>();
  const skipBacklog = options.replayHistory !== true;
  await walkCompletedTurns(input, async ({ task, sessionMeta, privacyTurnId, completedTurnId }) => {
    const alreadySeen = completedTurnId != null && seenTurnIds.has(completedTurnId);
    const isBacklog = skipBacklog && input.turn_id != null && completedTurnId !== input.turn_id;
    if (!alreadySeen && !isBacklog) {
      await postTurn(task, sessionMeta, privacyTurnId, {
        rolloutFile: input.transcript_path,
        includeOpenTurn: input.includeOpenTurn,
        options,
      });
    }
    if (completedTurnId != null) seenTurnIds.add(completedTurnId);
  });
}

export async function listCompletedTurnIds(input: TraceInput): Promise<string[]> {
  const turnIds: string[] = [];
  await walkCompletedTurns(input, async ({ completedTurnId }) => {
    if (completedTurnId != null && !turnIds.includes(completedTurnId))
      turnIds.push(completedTurnId);
  });
  return turnIds;
}
