/**
 * Plain TypeScript types for legacy rollout JSONL lines from codex-rs/protocol
 * `RolloutLine`.
 *
 * These lines are tagged by `type` with payload under `payload`:
 * - session_meta
 * - response_item
 * - compacted
 * - turn_context
 * - event_msg
 */

import type { Dirent } from "node:fs";

type StringRecord = Record<string, unknown>;

// `session_meta.source` for a spawned subagent thread.
export type SubagentSource = {
  subagent: {
    thread_spawn: {
      parent_thread_id?: string;
      depth?: number;
      agent_path?: string | null;
      agent_nickname?: string | null;
      agent_role?: string | null;
    };
  };
};

export type SessionMetaPayload = {
  id: string;
  forked_from_id?: string;
  timestamp: string;
  cwd: string;
  originator: string;
  cli_version: string;
  source: string | StringRecord;
  parent_thread_id?: string;
  thread_source?: string;
  agent_nickname?: string;
  agent_role?: string;
  agent_path?: string;
  multi_agent_version?: string;
  model_provider?: string | null;
  base_instructions?: { text: string } | null;
  dynamic_tools?: unknown[];
  memory_mode?: string;
};

export type SessionMetaLine = {
  timestamp: string;
  type: "session_meta";
  payload: SessionMetaPayload;
};

type ResponseItemMessage = {
  type: "message";
  role: string;
  content: Record<string, unknown>[];
  end_turn?: boolean;
  phase?: unknown;
};

type ResponseItemReasoning = {
  type: "reasoning";
  summary: unknown[];
  content?: unknown[];
  encrypted_content: string | null;
};

type ResponseItemLocalShellCall = {
  type: "local_shell_call";
  call_id: string | null;
  status: unknown;
  action: unknown;
};

type ResponseItemFunctionCall = {
  type: "function_call";
  name: string;
  namespace?: string;
  arguments: string;
  call_id: string;
};

type ResponseItemToolSearchCall = {
  type: "tool_search_call";
  call_id: string | null;
  status?: string;
  execution: string;
  arguments: unknown;
};

type ResponseItemFunctionCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: unknown;
};

type ResponseItemCustomToolCall = {
  type: "custom_tool_call";
  status?: string;
  call_id: string;
  name: string;
  input: string;
};

type ResponseItemCustomToolCallOutput = {
  type: "custom_tool_call_output";
  call_id: string;
  name?: string;
  output: unknown;
};

type ResponseItemToolSearchOutput = {
  type: "tool_search_output";
  call_id: string | null;
  status: string;
  execution: string;
  tools: unknown[];
};

type ResponseItemWebSearchCall = {
  type: "web_search_call";
  id?: string;
  status?: string;
  action?: unknown;
};

type ResponseItemImageGenerationCall = {
  type: "image_generation_call";
  id: string;
  status: string;
  revised_prompt?: string;
  result: string;
};

type ResponseItemGhostSnapshot = {
  type: "ghost_snapshot";
  ghost_commit: unknown;
};

type ResponseItemCompaction = {
  type: "compaction";
  encrypted_content: string;
};

type ResponseItemAgentMessage = {
  type: "agent_message";
  author: string;
  recipient: string;
  content: Record<string, unknown>[];
};

type ResponseItemOther = {
  type: "other";
  [key: string]: unknown;
};

export type ResponseItem =
  | ResponseItemMessage
  | ResponseItemReasoning
  | ResponseItemLocalShellCall
  | ResponseItemFunctionCall
  | ResponseItemToolSearchCall
  | ResponseItemFunctionCallOutput
  | ResponseItemCustomToolCall
  | ResponseItemCustomToolCallOutput
  | ResponseItemToolSearchOutput
  | ResponseItemWebSearchCall
  | ResponseItemImageGenerationCall
  | ResponseItemGhostSnapshot
  | ResponseItemCompaction
  | ResponseItemAgentMessage
  | ResponseItemOther;

type ResponseItemPayload = ResponseItem;

type ResponseItemLine = {
  timestamp: string;
  type: "response_item";
  payload: ResponseItemPayload;
};

type CompactedPayload = {
  message: string;
  replacement_history?: ResponseItemPayload[];
};

type CompactedLine = {
  timestamp: string;
  type: "compacted";
  payload: CompactedPayload;
};

type TurnContextPayload = {
  turn_id?: string;
  trace_id?: string;
  cwd: string;
  current_date?: string;
  timezone?: string;
  approval_policy: string | StringRecord;
  sandbox_policy: string | StringRecord;
  permission_profile?: unknown;
  network?: {
    allowed_domains: string[];
    denied_domains: string[];
  };
  file_system_sandbox_policy?: unknown;
  model: string;
  personality?: unknown;
  collaboration_mode?: unknown;
  realtime_active?: boolean;
  effort?: unknown;
  summary: unknown;
  user_instructions?: string;
  developer_instructions?: string;
  final_output_json_schema?: unknown;
  truncation_policy?: unknown;
};

type TurnContextLine = {
  timestamp: string;
  type: "turn_context";
  payload: TurnContextPayload;
};

type HttpStatusCodeInfo = { http_status_code?: number | null };

type CodexErrorInfo =
  | "context_window_exceeded"
  | "usage_limit_exceeded"
  | "server_overloaded"
  | "cyber_policy"
  | "internal_server_error"
  | "unauthorized"
  | "bad_request"
  | "sandbox_error"
  | "thread_rollback_failed"
  | "other"
  | { http_connection_failed: HttpStatusCodeInfo }
  | { response_stream_connection_failed: HttpStatusCodeInfo }
  | { response_stream_disconnected: HttpStatusCodeInfo }
  | { response_too_many_failed_attempts: HttpStatusCodeInfo }
  | { active_turn_not_steerable: { turn_kind: "review" | "compact" } }
  | unknown;

type TaskStartedPayload = {
  type: "task_started";
  turn_id: string;
  started_at?: number;
  model_context_window?: number | null;
  collaboration_mode_kind?: unknown;
  [key: string]: unknown;
};

type TurnCompletePayload = {
  type: "turn_complete";
  turn_id: string;
  last_agent_message?: string | null;
  error?: unknown;
  completed_at?: number;
  duration_ms?: number;
  time_to_first_token_ms?: number;
  [key: string]: unknown;
};

type TaskCompletePayload = {
  type: "task_complete";
  turn_id: string;
  last_agent_message?: string | null;
  error?: unknown;
  completed_at?: number;
  duration_ms?: number;
  time_to_first_token_ms?: number;
  [key: string]: unknown;
};

type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens: number;
  reasoning_output_tokens: number;
};

type TokenCountPayload = {
  type: "token_count";
  info?: {
    total_token_usage: TokenUsage;
    last_token_usage: TokenUsage;
    model_context_window: number;
  } | null;
  rate_limits?: unknown | null;
  [key: string]: unknown;
};

type StreamErrorPayload = {
  type: "stream_error";
  message: string;
  codex_error_info?: CodexErrorInfo;
  additional_details?: string;
  [key: string]: unknown;
};

type TurnAbortedPayload = {
  type: "turn_aborted";
  turn_id?: string | null;
  reason: "interrupted" | "replaced" | "review_ended" | string;
  completed_at?: number;
  duration_ms?: number;
  [key: string]: unknown;
};

type ItemCompletedPayload = {
  type: "item_completed";
  thread_id: string;
  turn_id: string;
  item: unknown;
  [key: string]: unknown;
};

type OpenTurnEndPayload = {
  type: "langsmith_open_turn_end";
  [key: string]: unknown;
};

type SubAgentActivityPayload = {
  type: "sub_agent_activity";
  event_id: string;
  agent_thread_id: string;
  agent_path?: string;
  kind: string;
  [key: string]: unknown;
};

type CollabAgentSpawnEndPayload = {
  type: "collab_agent_spawn_end";
  call_id: string;
  sender_thread_id: string;
  new_thread_id?: string | null;
  new_agent_nickname?: string;
  new_agent_role?: string;
  prompt: string;
  model: string;
  reasoning_effort: unknown;
  status: unknown;
  [key: string]: unknown;
};

export type EventMsgPayload =
  | TaskStartedPayload
  | TurnCompletePayload
  | TaskCompletePayload
  | TokenCountPayload
  | StreamErrorPayload
  | TurnAbortedPayload
  | ItemCompletedPayload
  | OpenTurnEndPayload
  | SubAgentActivityPayload
  | CollabAgentSpawnEndPayload;

export type EventMsgLine = {
  timestamp: string;
  type: "event_msg";
  payload: EventMsgPayload;
};

type LegacyRolloutLine =
  | SessionMetaLine
  | ResponseItemLine
  | CompactedLine
  | TurnContextLine
  | EventMsgLine;

export type LineSchema = LegacyRolloutLine;

export type Session = {
  session_id: string;
  model_provider: string | undefined;
  base_instructions: string | undefined;
  cli_version: string;
  cwd?: string;
  // Derived from `session_meta.source` (root vs spawned subagent thread).
  is_subagent?: boolean;
  // Parent (root, for depth-1) thread that this subagent groups under.
  parent_thread_id?: string;
  agent_role?: string;
  agent_nickname?: string;
};

export type TokenCount = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  reasoning_output_tokens?: number;
};

export type AggregateMessage<TMessage> = {
  timestamp: number;
  message: TMessage;
  tokenCount: TokenCount | undefined;
  subagentThreads: string[];
};

export type MergedMessage<TMessage> = {
  message: TMessage;
  timestamp: { start: number; end: number };
  tokenCount: TokenCount | undefined;
  subagentThreads: string[];
};

export type TypedSkill = { name: string; path: string; timestamp: number };

export type SkillRead = { name: string; paths: string[]; commands: string[] };

export type TypedSkillFragment = { name: string; path: string };

export type SkillOutcome = { name: string; success: boolean };

export type Task = {
  turnId: { id: string; timestamp: number } | undefined;
  // 1-based native turn index within the thread.
  turnNumber: number | undefined;
  messages: AggregateMessage<ResponseItem>[];
  userMessageIndex: number | undefined;
  context: { model: string; [key: string]: unknown } | undefined;
  tokenCount: { total_token_usage?: TokenCount; model_context_window?: number } | undefined;
  startTokenTotal: TokenCount | undefined;
  error: string | undefined;
  isErrorInterrupt: boolean;
  isReviewResult: boolean;
  typedSkills: TypedSkill[];
  subagentThreads: string[];
  toolCalls: {
    [callId: string]: {
      error: string | undefined;
      timings: number[];
      outputs: Record<string, unknown>;
    };
  };
};

export type ToolCallRecord = Task["toolCalls"][string];

export type StandardMessage = {
  role: string;
  content: { type: string; [key: string]: unknown }[];
  [key: string]: unknown;
};

export type DirectoryEntry = Dirent;

export type ResponseItemOf<T extends ResponseItem["type"]> = Extract<ResponseItem, { type: T }>;
