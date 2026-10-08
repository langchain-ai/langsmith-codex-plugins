import { convertToStandardMessages } from "./utils/messages.js";
import {
  clearTurnCapture,
  prepareTurnCapture,
  recordToolHook,
  readTranscript,
  markTurnStopped,
  pendingCapturedTools,
  reconciliationMetadata,
} from "./tool-capture.js";
import { trackIncrementalDelivery } from "./incremental-delivery.js";
import {
  loadTurnRunTopology,
  loadTurnStates,
  markTurnHandled,
  markTurnRunTopology,
  withRolloutLock,
} from "./trace-delivery-store.js";
import type { LineSchema, ResponseItem, SubagentSource } from "./types.js";
import { Client } from "langsmith";
import type { RunTreeConfig } from "langsmith";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { findLast } from "./utils/findLast.js";
import { isRecord } from "./utils/objects.js";
import { codingAgentMetadata, toolRepositoryMetadata, withTrustedMetadata } from "./metadata.js";
import { resolveTurnAttribution } from "./attribution.js";
import {
  capturedAttributionMessages,
  postCapturedTools,
  proposedReconciliation,
  repositoryFields,
} from "./tool-trace.js";
import { stableRunId, trackRunDelivery } from "./trace-delivery.js";
import { skillNamesFromToolCall } from "./skills.js";
import type {
  PostTurnOptions,
  RolloutTurnMode,
  TraceConversionInput,
  TraceConversionOptions,
} from "./models/trace-delivery.js";
import type {
  Session,
  TokenCount,
  AggregateMessage,
  MergedMessage,
  Task,
  StandardMessage,
} from "./types.js";
import { isPrimitive } from "./utils/isPrimitive.js";
import { createRunTree } from "./privacy.js";
import type { CodingAgentContext } from "./metadata-models.js";
import {
  defaultPrivacyPath,
  hasSavedTurnEvidence,
  hasPrunedSessionHistory,
  savedTurnMode,
  inheritThreadMode,
} from "./tracing-policy.js";
import type { TurnMode } from "./models/tracing-policy.js";
import { enumerate } from "./utils/enumerate.js";

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

function extractSubagentActivities(payload: Record<string, unknown>) {
  const activities: { threadId: string; callId?: string }[] = [];

  if (payload.type === "sub_agent_activity" && payload.kind === "started") {
    if (typeof payload.agent_thread_id === "string") {
      activities.push({
        threadId: payload.agent_thread_id,
        callId: typeof payload.event_id === "string" ? payload.event_id : undefined,
      });
    }
    return activities;
  }

  if (payload.type !== "item_completed" || !isRecord(payload.item)) return activities;

  const item = payload.item;
  const callId = typeof item.id === "string" ? item.id : undefined;
  if (
    item.type === "SubAgentActivity" &&
    item.kind === "started" &&
    typeof item.agent_thread_id === "string"
  ) {
    activities.push({ threadId: item.agent_thread_id, callId });
  }

  if (item.type === "CollabAgentToolCall" && item.tool === "spawn_agent") {
    const ids = new Set<string>();
    if (Array.isArray(item.receiver_thread_ids)) {
      for (const id of item.receiver_thread_ids) {
        if (typeof id === "string") ids.add(id);
      }
    }
    if (Array.isArray(item.receiver_agents)) {
      for (const agent of item.receiver_agents) {
        if (isRecord(agent) && typeof agent.thread_id === "string") ids.add(agent.thread_id);
      }
    }
    for (const threadId of ids) activities.push({ threadId, callId });
  }

  return activities;
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

/** Resolve direct child Stops exactly as recursive uploads: use the spawning
 * parent's native turn, not the parent's current preference or Stop turn_id.
 * Missing/ambiguous launch evidence is metadata-only. No timing heuristic. */
async function rolloutTurnMode(
  file: string,
  sessionId: string,
  turnId: string | undefined,
  privacyPath: string,
  sessionsRoot?: string,
  visited = new Set<string>(),
): Promise<RolloutTurnMode> {
  if (visited.has(sessionId)) return { mode: "metadata", hasEvidence: false };
  visited.add(sessionId);
  const events = await readTranscript(file, turnId);
  const meta = events.find((event) => event.type === "session_meta");
  if (meta?.type !== "session_meta" || meta.payload.id !== sessionId)
    return { mode: "metadata", hasEvidence: false };
  const source = meta.payload.source as SubagentSource | undefined;
  const parentId =
    source && typeof source === "object"
      ? (source.subagent?.thread_spawn?.parent_thread_id ?? meta.payload.parent_thread_id)
      : meta.payload.parent_thread_id;
  const child =
    !!parentId ||
    meta.payload.thread_source === "subagent" ||
    (source && typeof source === "object" && !!source.subagent);
  if (!child) {
    return {
      mode: savedTurnMode(privacyPath, sessionId, turnId),
      hasEvidence: hasSavedTurnEvidence(privacyPath, sessionId, turnId),
    };
  }
  if (
    hasPrunedSessionHistory(privacyPath, sessionId) &&
    hasSavedTurnEvidence(privacyPath, sessionId, turnId)
  ) {
    return { mode: savedTurnMode(privacyPath, sessionId, turnId), hasEvidence: true };
  }
  let mode: TurnMode = "metadata";
  let hasEvidence = false;
  const parentFile = parentId
    ? await findRolloutFileByThreadId(file, parentId, sessionsRoot)
    : undefined;
  if (parentFile && parentId) {
    let nativeTurn: string | undefined;
    const calls = new Map<string, string>();
    const launches = new Set<string>();
    for (const event of await readTranscript(parentFile)) {
      if (event.type === "event_msg") {
        if (event.payload.type === "task_started") nativeTurn = event.payload.turn_id;
        const ids = extractSubagentActivities(event.payload).map((activity) => activity.threadId);
        if (
          event.payload.type === "collab_agent_spawn_end" &&
          typeof event.payload.new_thread_id === "string"
        )
          ids.push(event.payload.new_thread_id);
        if (nativeTurn && ids.includes(sessionId)) launches.add(nativeTurn);
        if (["task_complete", "turn_complete", "turn_aborted"].includes(event.payload.type)) {
          nativeTurn = undefined;
        }
      }
      if (event.type === "response_item") {
        if (
          event.payload.type === "function_call" &&
          event.payload.name === "spawn_agent" &&
          nativeTurn
        )
          calls.set(event.payload.call_id, nativeTurn);
        if (
          event.payload.type === "function_call_output" &&
          calls.has(event.payload.call_id) &&
          extractSpawnedAgentId(event.payload.output) === sessionId
        )
          launches.add(calls.get(event.payload.call_id)!);
      }
    }
    if (launches.size === 1) {
      const launch = await rolloutTurnMode(
        parentFile,
        parentId,
        [...launches][0],
        privacyPath,
        sessionsRoot,
        visited,
      );
      mode = launch.mode;
      hasEvidence = launch.hasEvidence;
    }
  }
  try {
    return { mode: await inheritThreadMode(privacyPath, sessionId, mode), hasEvidence };
  } catch {
    return { mode: "metadata", hasEvidence: false };
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

// Null run-type-scoped keys on llm/tool runs to override langsmith's
// parent->child metadata inheritance (serialization drops undefined).
const CHILD_SCOPE_RESET = {
  approval_policy: undefined,
  ls_is_error_interrupt: undefined,
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

async function postTurn(
  task: Task,
  sessionMeta: Session | undefined,
  privacyTurnId: string | undefined,
  { rolloutFile, options, mode, turnKey, fallbackTime }: PostTurnOptions,
) {
  if (sessionMeta?.session_id) options?.visitedThreads?.add(sessionMeta.session_id);
  if (sessionMeta?.parent_thread_id) options?.visitedThreads?.add(sessionMeta.parent_thread_id);
  // Persist launch inheritance even when master-off evidence skips this turn.
  for (const child of task.subagentThreads) {
    try {
      await inheritThreadMode(options?.privacyPath ?? defaultPrivacyPath(), child, mode);
    } catch {
      /* Corrupt/unwritable policy is resolved metadata-only by child uploads. */
    }
  }
  if (mode === "off") return;
  const deliveryErrors: unknown[] = [];
  const sourceClient = options?.client ?? new Client({ autoBatchTracing: false });
  const client = options?.incremental
    ? trackIncrementalDelivery(
        sourceClient,
        deliveryErrors,
        rolloutFile,
        turnKey,
        !options?.partial,
        options?.redactCapture,
        options?.redactionPolicy,
        sessionMeta?.session_id,
      )
    : trackRunDelivery(sourceClient, deliveryErrors);
  const replicas = options?.replicas?.map((replica) => {
    const replicaClient = "client" in replica ? replica.client : undefined;
    return {
      ...replica,
      client: replicaClient
        ? options?.incremental
          ? trackIncrementalDelivery(
              replicaClient,
              deliveryErrors,
              rolloutFile,
              turnKey,
              !options?.partial,
              options?.redactCapture,
              options?.redactionPolicy,
              sessionMeta?.session_id,
            )
          : trackRunDelivery(replicaClient, deliveryErrors)
        : client,
    };
  });
  const postPromises: Promise<void>[] = [];

  const messages = convertToStandardMessages(task.messages);

  const user = task.userMessageIndex != null ? messages.at(task.userMessageIndex) : undefined;

  const agent = mergeMessages(
    task.userMessageIndex != null ? messages.slice(task.userMessageIndex + 1) : messages,
  );

  const parentStartTime = task.turnId?.timestamp ?? fallbackTime;
  const parentEndTime = Math.max(agent.at(-1)?.timestamp.end ?? parentStartTime, parentStartTime);

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

  const existingRootMetadata = { ...options?.metadata, ...task.context };
  const attribution =
    mode === "full" && !options?.partial
      ? await resolveTurnAttribution({
          cwd,
          sessionCwd: typeof sessionMeta?.cwd === "string" ? sessionMeta.cwd : undefined,
          sessionGit: sessionMeta?.git,
          sessionIdentifier: sessionMeta?.ls_attribution_identifier,
          existingMetadata: existingRootMetadata,
          messages: [
            ...messages,
            ...capturedAttributionMessages(options?.capturedTools ?? [], messages),
          ].sort((a, b) => a.timestamp - b.timestamp),
          toolCalls: task.toolCalls,
        })
      : undefined;
  const git = attribution?.git;
  const attributionIdentifier = attribution?.identifier;

  const isSubagent = sessionMeta?.is_subagent === true;

  // Subagents are separate rollouts; group under the parent thread, not their own.
  const conversationThreadId =
    (isSubagent ? sessionMeta?.parent_thread_id : undefined) ?? sessionMeta?.session_id;

  // coding-agent-v1 base contract, stamped onto every run below.
  const metadataContext = {
    agentType: isSubagent ? "subagent" : "root",
    threadId: conversationThreadId,
    turnId: task.turnId?.id,
    turnNumber: task.turnNumber,
    cliVersion: sessionMeta?.cli_version,
    cwd,
    git,
    attributionIdentifier,
    sandboxType,
  } satisfies CodingAgentContext;
  const base = codingAgentMetadata(metadataContext, existingRootMetadata);
  const proposed = proposedReconciliation(base, attribution);
  const reconciliation =
    options?.incremental && !options.partial && mode === "full"
      ? await reconciliationMetadata(
          rolloutFile,
          turnKey,
          options?.redactCapture ? options.redactCapture(proposed) : proposed,
        )
      : undefined;
  if (reconciliation) Object.assign(base, repositoryFields(reconciliation.root));

  // Scope-restricted keys: approval_policy on root only, ls_subagent_* on
  // subagent only. Set undefined elsewhere to override inherited values.
  const parentConfig: RunTreeConfig = {
    id: stableRunId(sessionMeta?.session_id, rolloutFile, turnKey, "root"),
    name: "openai.codex",
    client,
    project_name: options?.projectName,
    run_type: "chain",
    replicas,
    inputs: { messages: user != null ? [user.message] : [] },
    outputs: options?.partial ? undefined : { messages: agent.map((i) => i.message) },
    error: task.error,
    start_time: parentStartTime,
    end_time: options?.partial ? undefined : parentEndTime,
    extra: {
      metadata: withTrustedMetadata(
        { ...options?.metadata, ...task.context },
        {
          ...base,
          ...(task.isErrorInterrupt ? { ls_is_error_interrupt: true } : {}),

          approval_policy: isSubagent ? undefined : approvalPolicy,
          ls_subagent_id: isSubagent ? sessionMeta?.session_id : undefined,
          ls_subagent_type: isSubagent
            ? (sessionMeta?.agent_role ?? sessionMeta?.agent_nickname)
            : undefined,

          codex_cli_version: sessionMeta?.cli_version,
          ls_message_format: "anthropic",

          // Non-reserved key: backend auto-aggregates child llm usage into the
          // parent, so usage_metadata here would double-count.
          ls_raw_aggregated_usage: getUsageMetadata(task.tokenCount?.total_token_usage),
        },
      ),
    },
  };
  const topology = await loadTurnRunTopology(rolloutFile, turnKey);
  const parent = createRunTree(
    topology
      ? {
          ...parentConfig,
          ...(topology.parentRunId === null ? {} : { parent_run_id: topology.parentRunId }),
          trace_id: topology.traceId,
          dotted_order: topology.dottedOrder,
          execution_order: topology.executionOrder,
          child_execution_order: topology.childExecutionOrder,
        }
      : parentConfig,
    mode,
    topology ? undefined : options?.parentRunTree,
  );
  parent.client = client;
  if (topology == null) {
    await markTurnRunTopology(rolloutFile, turnKey, {
      parentRunId: parent.parent_run?.id ?? parent.parent_run_id ?? null,
      traceId: parent.trace_id,
      dottedOrder: parent.dotted_order,
      executionOrder: parent.execution_order,
      childExecutionOrder: parent.child_execution_order,
    });
  }

  postPromises.push(parent.postRun());

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

  const postedToolIds = new Set<string>();
  const postedSubagentThreads = new Set<string>();
  async function postSubagentThread(subagentThread: string) {
    if (options?.partial || postedSubagentThreads.has(subagentThread)) return;
    postedSubagentThreads.add(subagentThread);
    if (options?.visitedThreads?.has(subagentThread)) return;
    options?.visitedThreads?.add(subagentThread);

    const subagentFile = await findRolloutFileByThreadId(
      rolloutFile,
      subagentThread,
      options?.sessionsRoot,
    );
    if (subagentFile == null) return;

    const events = await readTranscript(subagentFile);
    const lastEvent = findLast(
      events,
      (event) => event.type === "event_msg" && event.payload.turn_id != null,
    ) as { payload: { turn_id: string } } | undefined;

    await convertToRunTree(
      { transcript_path: subagentFile, turn_id: lastEvent?.payload.turn_id ?? null },
      {
        ...options,
        parentRunTree: parent,
        debugNow,
        replayHistory: true,
        hook: undefined,
        events: undefined,
        capturedTools: undefined,
      },
    );
  }

  for (const [outputIndex, output] of outputs.entries()) {
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

    const llmChild = createRunTree(
      {
        id: stableRunId(sessionMeta?.session_id, rolloutFile, turnKey, `llm:${outputIndex}`),
        name: "openai.codex.turn",
        run_type: "llm",
        start_time: outputStartTime,
        end_time: outputEndTime,
        inputs: { messages: inputMessages.map((i) => i.message) },
        outputs: { messages: aiMessage.map((i) => i.message) },
        extra: {
          metadata: withTrustedMetadata(
            { ...options?.metadata },
            {
              ...base,
              ...CHILD_SCOPE_RESET,
              ls_model_type: "chat",
              ls_provider: sessionMeta?.model_provider,
              ls_model_name: task.context?.model,
              ls_invocation_params: task.context,
              usage_metadata: getUsageMetadata(tokenCounts),
            },
          ),
        },
      },
      mode,
      parent,
    );
    if (!options?.partial) postPromises.push(llmChild.postRun());

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
      postedToolIds.add(toolCallId);
      const toolAttribution = attribution?.tools.get(toolCallId);
      const toolRepositoryFields = reconciliation?.tools[toolCallId]
        ? repositoryFields(reconciliation.tools[toolCallId])
        : toolAttribution != null &&
            (toolAttribution.resolved != null ||
              (!options?.incremental && toolAttribution.explicit))
          ? {
              ...toolRepositoryMetadata(toolAttribution.resolved),
              ...(options?.incremental && toolAttribution.resolved
                ? {
                    ls_attribution_identifier:
                      toolAttribution.resolved.identifier ?? base.ls_attribution_identifier,
                  }
                : {}),
            }
          : {};

      const toolRun = createRunTree(
        {
          id: stableRunId(sessionMeta?.session_id, rolloutFile, turnKey, `tool:${toolCallId}`),
          name: runName,
          run_type: "tool",
          start_time: min,
          end_time: max,
          inputs: { input: msgToolCall.args },
          outputs: { ...toolCall.outputs, messages: [toolMessage.message] },
          error: toolCall.error,
          extra: {
            metadata: withTrustedMetadata(
              { ...options?.metadata },
              {
                ...base,
                ...CHILD_SCOPE_RESET,
                ...toolRepositoryFields,
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
            ),
          },
        },
        mode,
        parent,
      );
      postPromises.push(toolRun.postRun());

      for (const skillName of skillNames) {
        const skillRun = createRunTree(
          {
            id: stableRunId(
              sessionMeta?.session_id,
              rolloutFile,
              turnKey,
              `skill:${toolCallId}:${skillName}`,
            ),
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
              metadata: withTrustedMetadata(
                { ...options?.metadata },
                {
                  ...base,
                  ...CHILD_SCOPE_RESET,
                  // Configured metadata reaches every run; the tokens belong to the call.
                  usage_metadata: undefined,
                  ls_skill_name: skillName,
                },
              ),
            },
          },
          mode,
          parent,
        );
        postPromises.push(skillRun.postRun());
      }
    }

    for (const subagentThread of subagentThreads ?? []) {
      await postSubagentThread(subagentThread);
    }
  }

  // Canonical activity records can arrive without a matching response item.
  for (const subagentThread of task.subagentThreads) {
    await postSubagentThread(subagentThread);
  }
  if (options?.incremental) {
    postPromises.push(
      postCapturedTools({
        tools: options.capturedTools ?? [],
        postedToolIds,
        messages,
        parent,
        base,
        mode,
        reconciliation,
        sessionId: sessionMeta?.session_id,
        rolloutFile,
        turnKey,
      }),
    );
  }
  await Promise.all(postPromises);
  await client.awaitPendingTraceBatches();
  if (deliveryErrors.length > 0) throw deliveryErrors[0];
}

async function convertToRunTreeWorker(
  input: TraceConversionInput,
  options: TraceConversionOptions | undefined,
  visitedThreads: Set<string>,
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
      error: undefined,
      isErrorInterrupt: false,
      subagentThreads: [],
      toolCalls: {},
    };
  }

  // 1-based native turn index within this thread; incremented per task_started.
  let turnNumber = 0;

  // spawn_agent call_id → its AI message, so the child id from the matching
  // function_call_output attaches there.
  const spawnAgentMessages = new Map<string, { subagentThreads: string[] }>();

  function recordSubagentThread(task: Task, threadId: string, callId?: string) {
    if (!task.subagentThreads.includes(threadId)) task.subagentThreads.push(threadId);

    if (callId == null) return;
    const message = spawnAgentMessages.get(callId);
    if (message != null && !message.subagentThreads.includes(threadId)) {
      message.subagentThreads.push(threadId);
    }
  }

  const turnStates = await loadTurnStates(input.transcript_path);
  const events = options?.events ?? (await readTranscript(input.transcript_path));
  for (const [index, { type, payload, timestamp }, arr] of enumerate(events)) {
    if (type === "session_meta") {
      // Subagent threads carry `source.subagent.thread_spawn`; roots use "cli".
      const source = payload.source;
      const threadSpawn =
        source != null && typeof source === "object" && "subagent" in source
          ? (source as SubagentSource).subagent?.thread_spawn
          : undefined;

      const isSubagent =
        threadSpawn != null ||
        (payload.thread_source === "subagent" && typeof payload.parent_thread_id === "string");

      sessionMeta = {
        session_id: payload.id,
        model_provider: payload.model_provider ?? undefined,
        base_instructions: payload.base_instructions?.text,
        cli_version: payload.cli_version,
        cwd: payload.cwd,
        git: payload.git,
        ls_attribution_identifier: payload.ls_attribution_identifier,
        is_subagent: isSubagent,
        parent_thread_id: threadSpawn?.parent_thread_id ?? payload.parent_thread_id ?? undefined,
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
        if (childId != null) recordSubagentThread(task, childId, payload.call_id);
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

        if (payload.type === "exec_command_end" && typeof payload.cwd === "string") {
          task.toolCalls[payload.call_id].executionCwd = payload.cwd;
        }
        if (payload.type === "patch_apply_end") {
          task.toolCalls[payload.call_id].changedPaths = isRecord(payload.changes)
            ? Object.keys(payload.changes)
            : [];
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

      for (const activity of extractSubagentActivities(payload)) {
        task ??= createTask();
        recordSubagentThread(task, activity.threadId, activity.callId);
      }

      if (payload.type === "collab_agent_spawn_end" && payload.new_thread_id != null) {
        task ??= createTask();
        recordSubagentThread(task, payload.new_thread_id, payload.call_id);
      }

      if (payload.type === "stream_error") {
        task ??= createTask();
        task.error = formatError(payload);
      }

      if (payload.type === "task_complete" || payload.type === "turn_complete") {
        task ??= createTask();
        task.error = formatError(payload.error);
      }

      if (payload.type === "turn_aborted") {
        task ??= createTask();
        const explicitError = formatError(payload.error);
        if (explicitError != null) {
          task.error = explicitError;
        } else if (task.error == null && payload.reason !== "review_ended") {
          const interrupted = payload.reason === "interrupted";
          task.isErrorInterrupt = interrupted;
          task.error = interrupted ? "Turn interrupted" : `Turn aborted: ${payload.reason}`;
        }
      }

      if (
        payload.type === "task_complete" ||
        payload.type === "turn_complete" ||
        payload.type === "turn_aborted" ||
        (task != null && index === arr.length - 1 && input.turn_id != null)
      ) {
        task ??= createTask();
        // Delivery may fall back to the Stop ID, but privacy must never assign
        // that current ID to historical content with no native launch evidence.
        const privacyTurnId = task.turnId?.id;
        const completedTurnId = task.turnId?.id ?? input.turn_id ?? undefined;
        const turnKey = completedTurnId ?? `timestamp:${task.turnId?.timestamp ?? eventTime}`;
        // Ensure a turn marker for turns completed without a task_started.
        if (task.turnId == null && completedTurnId != null) {
          task.turnId = { id: completedTurnId, timestamp: eventTime };
        }
        if (task.turnNumber == null) {
          turnNumber += 1;
          task.turnNumber = turnNumber;
        }
        if (options?.partial && completedTurnId !== input.turn_id) {
          task = undefined;
          continue;
        }
        const alreadyHandled = completedTurnId != null && turnStates.has(completedTurnId);
        if (alreadyHandled && options?.incremental && completedTurnId != null)
          await clearTurnCapture(input.transcript_path, completedTurnId);
        if (!alreadyHandled) {
          const turnMode = sessionMeta?.session_id
            ? await rolloutTurnMode(
                input.transcript_path,
                sessionMeta.session_id,
                privacyTurnId,
                options?.privacyPath ?? defaultPrivacyPath(),
                options?.sessionsRoot,
              )
            : { mode: "metadata" as TurnMode, hasEvidence: false };
          const isBacklog =
            options?.replayHistory !== true &&
            input.turn_id != null &&
            completedTurnId !== input.turn_id &&
            !turnMode.hasEvidence;
          const state = isBacklog ? "backlog" : turnMode.mode === "off" ? "off" : "uploaded";
          const capture =
            options?.incremental && !isBacklog
              ? await prepareTurnCapture(
                  input.transcript_path,
                  turnKey,
                  turnMode.mode,
                  options.redactCapture,
                )
              : undefined;
          const partial =
            options?.partial ||
            (capture != null && pendingCapturedTools(capture.tools, events, turnKey));
          if (!isBacklog) {
            await postTurn(task, sessionMeta, privacyTurnId, {
              rolloutFile: input.transcript_path,
              options: { ...options, visitedThreads, partial, capturedTools: capture?.tools ?? [] },
              mode: turnMode.mode,
              turnKey,
              fallbackTime: task.turnId?.timestamp ?? eventTime,
            });
          }
          if (completedTurnId != null && !partial) {
            await markTurnHandled(input.transcript_path, completedTurnId, state);
            turnStates.set(completedTurnId, state);
            if (options?.incremental)
              await clearTurnCapture(input.transcript_path, completedTurnId);
          }
        }
        task = undefined;
      }
    }
  }
}

export async function convertToRunTree(
  input: TraceConversionInput,
  options?: TraceConversionOptions,
) {
  const visitedThreads = options?.visitedThreads ?? new Set<string>();
  return withRolloutLock(input.transcript_path, async () => {
    if (!options?.hook || !input.turn_id)
      return convertToRunTreeWorker(input, options, visitedThreads);
    const states = await loadTurnStates(input.transcript_path);
    if (states.has(input.turn_id)) {
      await clearTurnCapture(input.transcript_path, input.turn_id);
      return;
    }
    const { mode } = await rolloutTurnMode(
      input.transcript_path,
      options.hook.session_id,
      input.turn_id,
      options.privacyPath ?? defaultPrivacyPath(),
      options.sessionsRoot,
    );
    if (options.hook.hook_event_name === "PostToolUse")
      await recordToolHook(options.hook, mode, options.redactCapture);
    if (options.hook.hook_event_name === "Stop" && mode !== "off")
      await markTurnStopped(input.transcript_path, input.turn_id);
    const capture = await prepareTurnCapture(
      input.transcript_path,
      input.turn_id,
      mode,
      options.redactCapture,
    );
    const partial = !capture.stopped && options.hook.hook_event_name === "PostToolUse";
    const events = [...capture.events];
    let currentTurn = false;
    let completed = false;
    for (const event of events) {
      if (event.type !== "event_msg") continue;
      if (event.payload.type === "task_started")
        currentTurn = event.payload.turn_id === input.turn_id;
      if (
        currentTurn &&
        ["task_complete", "turn_complete", "turn_aborted"].includes(event.payload.type)
      )
        completed = true;
    }
    if (!completed)
      events.push({
        timestamp: new Date().toISOString(),
        type: "event_msg",
        payload: { type: "task_complete", turn_id: input.turn_id },
      });
    await convertToRunTreeWorker(
      input,
      { ...options, incremental: true, partial, events, capturedTools: capture.tools },
      visitedThreads,
    );
    if ((await loadTurnStates(input.transcript_path)).has(input.turn_id))
      await clearTurnCapture(input.transcript_path, input.turn_id);
  });
}
