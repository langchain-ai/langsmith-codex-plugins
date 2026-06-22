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

type StringRecord = Record<string, unknown>;

export type GitInfo = {
  commit_hash?: string;
  branch?: string;
  repository_url?: string;
};

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
  agent_nickname?: string;
  agent_role?: string;
  agent_path?: string;
  model_provider?: string | null;
  base_instructions?: { text: string } | null;
  dynamic_tools?: unknown[];
  memory_mode?: string;
  git?: GitInfo;
};

export type SessionMetaLine = {
  timestamp: string;
  type: "session_meta";
  payload: SessionMetaPayload;
};

export type ResponseItemMessage = {
  type: "message";
  role: string;
  content: Record<string, unknown>[];
  end_turn?: boolean;
  phase?: unknown;
};

export type ResponseItemReasoning = {
  type: "reasoning";
  summary: unknown[];
  content?: unknown[];
  encrypted_content: string | null;
};

export type ResponseItemLocalShellCall = {
  type: "local_shell_call";
  call_id: string | null;
  status: unknown;
  action: unknown;
};

export type ResponseItemFunctionCall = {
  type: "function_call";
  name: string;
  namespace?: string;
  arguments: string;
  call_id: string;
};

export type ResponseItemToolSearchCall = {
  type: "tool_search_call";
  call_id: string | null;
  status?: string;
  execution: string;
  arguments: unknown;
};

export type ResponseItemFunctionCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: unknown;
};

export type ResponseItemCustomToolCall = {
  type: "custom_tool_call";
  status?: string;
  call_id: string;
  name: string;
  input: string;
};

export type ResponseItemCustomToolCallOutput = {
  type: "custom_tool_call_output";
  call_id: string;
  name?: string;
  output: unknown;
};

export type ResponseItemToolSearchOutput = {
  type: "tool_search_output";
  call_id: string | null;
  status: string;
  execution: string;
  tools: unknown[];
};

export type ResponseItemWebSearchCall = {
  type: "web_search_call";
  status?: string;
  action?: unknown;
};

export type ResponseItemImageGenerationCall = {
  type: "image_generation_call";
  id: string;
  status: string;
  revised_prompt?: string;
  result: string;
};

export type ResponseItemGhostSnapshot = {
  type: "ghost_snapshot";
  ghost_commit: unknown;
};

export type ResponseItemCompaction = {
  type: "compaction";
  encrypted_content: string;
};

export type ResponseItemOther = {
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
  | ResponseItemOther;

export type ResponseItemPayload = ResponseItem;

export type ResponseItemLine = {
  timestamp: string;
  type: "response_item";
  payload: ResponseItemPayload;
};

export type CompactedPayload = {
  message: string;
  replacement_history?: ResponseItemPayload[];
};

export type CompactedLine = {
  timestamp: string;
  type: "compacted";
  payload: CompactedPayload;
};

export type TurnContextPayload = {
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

export type TurnContextLine = {
  timestamp: string;
  type: "turn_context";
  payload: TurnContextPayload;
};

type HttpStatusCodeInfo = { http_status_code?: number | null };

export type CodexErrorInfo =
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

type ExecSource = "agent" | "user_shell" | "unified_exec_startup" | "unified_exec_interaction";

export type ExecCommandOutputDeltaPayload = {
  type: "exec_command_output_delta";
  call_id: string;
  stream: "stdout" | "stderr";
  chunk: string;
  [key: string]: unknown;
};

export type ExecCommandBeginPayload = {
  type: "exec_command_begin";
  call_id: string;
  process_id?: string;
  turn_id: string;
  command: string[];
  cwd: string;
  parsed_cmd: unknown[];
  source?: ExecSource;
  interaction_input?: string;
  [key: string]: unknown;
};

export type ExecCommandEndPayload = {
  type: "exec_command_end";
  call_id: string;
  process_id?: string;
  turn_id: string;
  command: string[];
  cwd: string;
  parsed_cmd: unknown[];
  source?: ExecSource;
  interaction_input?: string;
  stdout: string;
  stderr: string;
  aggregated_output?: string;
  exit_code: number;
  duration: string;
  formatted_output: string;
  status: "completed" | "failed" | "declined";
  [key: string]: unknown;
};

export type TerminalInteractionPayload = {
  type: "terminal_interaction";
  call_id: string;
  process_id: string;
  stdin: string;
  [key: string]: unknown;
};

export type ErrorPayload = {
  type: "error";
  message: string;
  codex_error_info?: CodexErrorInfo;
  [key: string]: unknown;
};

export type WarningPayload = {
  type: "warning";
  message: string;
  [key: string]: unknown;
};

export type GuardianWarningPayload = {
  type: "guardian_warning";
  message: string;
  [key: string]: unknown;
};

export type RealtimeConversationStartedPayload = {
  type: "realtime_conversation_started";
  session_id?: string;
  version?: "v1" | "v2";
  [key: string]: unknown;
};

export type RealtimeConversationRealtimePayload = {
  type: "realtime_conversation_realtime";
  payload: unknown;
  [key: string]: unknown;
};

export type RealtimeConversationClosedPayload = {
  type: "realtime_conversation_closed";
  reason?: string;
  [key: string]: unknown;
};

export type RealtimeConversationSdpPayload = {
  type: "realtime_conversation_sdp";
  sdp: string;
  [key: string]: unknown;
};

export type ModelReroutePayload = {
  type: "model_reroute";
  from_model: string;
  to_model: string;
  reason: "high_risk_cyber_activity";
  [key: string]: unknown;
};

export type ModelVerificationPayload = {
  type: "model_verification";
  verifications: Array<"trusted_access_for_cyber">;
  [key: string]: unknown;
};

export type ContextCompactedPayload = {
  type: "context_compacted";
  [key: string]: unknown;
};

export type ThreadRolledBackPayload = {
  type: "thread_rolled_back";
  num_turns: number;
  [key: string]: unknown;
};

export type TurnStartedPayload = {
  type: "turn_started";
  turn_id: string;
  started_at?: number;
  model_context_window?: number | null;
  collaboration_mode_kind?: unknown;
  [key: string]: unknown;
};

export type TaskStartedPayload = {
  type: "task_started";
  turn_id: string;
  started_at?: number;
  model_context_window?: number | null;
  collaboration_mode_kind?: unknown;
  [key: string]: unknown;
};

export type TurnCompletePayload = {
  type: "turn_complete";
  turn_id: string;
  last_agent_message?: string | null;
  completed_at?: number;
  duration_ms?: number;
  time_to_first_token_ms?: number;
  [key: string]: unknown;
};

export type TaskCompletePayload = {
  type: "task_complete";
  turn_id: string;
  last_agent_message?: string | null;
  completed_at?: number;
  duration_ms?: number;
  time_to_first_token_ms?: number;
  [key: string]: unknown;
};

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens: number;
  reasoning_output_tokens: number;
};

export type TokenCountPayload = {
  type: "token_count";
  info?: {
    total_token_usage: TokenUsage;
    last_token_usage: TokenUsage;
    model_context_window: number;
  } | null;
  rate_limits?: unknown | null;
  [key: string]: unknown;
};

export type AgentMessagePayload = {
  type: "agent_message";
  message: string;
  phase?: unknown | null;
  memory_citation?: unknown | null;
  [key: string]: unknown;
};

export type UserMessagePayload = {
  type: "user_message";
  message: string;
  images?: string[] | null;
  local_images?: string[];
  text_elements?: unknown[];
  [key: string]: unknown;
};

export type AgentMessageDeltaPayload = {
  type: "agent_message_delta";
  delta: string;
  [key: string]: unknown;
};

export type AgentReasoningPayload = {
  type: "agent_reasoning";
  text: string;
  [key: string]: unknown;
};

export type AgentReasoningDeltaPayload = {
  type: "agent_reasoning_delta";
  delta: string;
  [key: string]: unknown;
};

export type AgentReasoningRawContentPayload = {
  type: "agent_reasoning_raw_content";
  text: string;
  [key: string]: unknown;
};

export type AgentReasoningRawContentDeltaPayload = {
  type: "agent_reasoning_raw_content_delta";
  delta: string;
  [key: string]: unknown;
};

export type AgentReasoningSectionBreakPayload = {
  type: "agent_reasoning_section_break";
  item_id?: string;
  summary_index?: number;
  [key: string]: unknown;
};

export type SessionConfiguredPayload = {
  type: "session_configured";
  session_id: string;
  forked_from_id?: string;
  thread_name?: string;
  model: string;
  model_provider_id: string;
  service_tier?: unknown | null;
  approval_policy: unknown;
  approvals_reviewer?: unknown;
  sandbox_policy: unknown;
  permission_profile?: unknown;
  cwd: string;
  reasoning_effort?: unknown;
  history_log_id: number;
  history_entry_count: number;
  initial_messages?: unknown[];
  network_proxy?: unknown;
  rollout_path?: string;
  [key: string]: unknown;
};

export type ThreadNameUpdatedPayload = {
  type: "thread_name_updated";
  thread_id: string;
  thread_name?: string;
  [key: string]: unknown;
};

export type McpInvocation = {
  server: string;
  tool: string;
  arguments?: unknown | null;
};

export type McpToolCallBeginPayload = {
  type: "mcp_tool_call_begin";
  call_id: string;
  invocation: McpInvocation;
  mcp_app_resource_uri?: string;
  [key: string]: unknown;
};

export type McpToolCallEndPayload = {
  type: "mcp_tool_call_end";
  call_id: string;
  invocation: McpInvocation;
  mcp_app_resource_uri?: string;
  duration: string;
  result: unknown;
  [key: string]: unknown;
};

export type WebSearchBeginPayload = {
  type: "web_search_begin";
  call_id: string;
  [key: string]: unknown;
};

export type WebSearchEndPayload = {
  type: "web_search_end";
  call_id: string;
  query: string;
  action: unknown;
  [key: string]: unknown;
};

export type ImageGenerationBeginPayload = {
  type: "image_generation_begin";
  call_id: string;
  [key: string]: unknown;
};

export type ImageGenerationEndPayload = {
  type: "image_generation_end";
  call_id: string;
  status: string;
  revised_prompt?: string;
  result: string;
  saved_path?: string;
  [key: string]: unknown;
};

export type ViewImageToolCallPayload = {
  type: "view_image_tool_call";
  call_id: string;
  path: string;
  [key: string]: unknown;
};

export type ExecApprovalRequestPayload = {
  type: "exec_approval_request";
  [key: string]: unknown;
};

export type RequestPermissionsPayload = {
  type: "request_permissions";
  [key: string]: unknown;
};

export type RequestUserInputPayload = {
  type: "request_user_input";
  [key: string]: unknown;
};

export type DynamicToolCallRequestPayload = {
  type: "dynamic_tool_call_request";
  [key: string]: unknown;
};

export type DynamicToolCallResponsePayload = {
  type: "dynamic_tool_call_response";
  call_id: string;
  turn_id: string;
  namespace?: string | null;
  tool: string;
  arguments: unknown;
  content_items: unknown[];
  success: boolean;
  error?: string | null;
  duration: string;
  [key: string]: unknown;
};

export type ElicitationRequestPayload = {
  type: "elicitation_request";
  [key: string]: unknown;
};

export type ApplyPatchApprovalRequestPayload = {
  type: "apply_patch_approval_request";
  [key: string]: unknown;
};

export type GuardianAssessmentPayload = {
  type: "guardian_assessment";
  [key: string]: unknown;
};

export type DeprecationNoticePayload = {
  type: "deprecation_notice";
  summary: string;
  details?: string;
  [key: string]: unknown;
};

export type BackgroundEventPayload = {
  type: "background_event";
  message: string;
  [key: string]: unknown;
};

export type UndoStartedPayload = {
  type: "undo_started";
  message?: string;
  [key: string]: unknown;
};

export type UndoCompletedPayload = {
  type: "undo_completed";
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

export type StreamErrorPayload = {
  type: "stream_error";
  message: string;
  codex_error_info?: CodexErrorInfo;
  additional_details?: string;
  [key: string]: unknown;
};

export type PatchApplyBeginPayload = {
  type: "patch_apply_begin";
  call_id: string;
  turn_id?: string;
  auto_approved: boolean;
  changes: Record<string, unknown>;
  [key: string]: unknown;
};

export type PatchApplyUpdatedPayload = {
  type: "patch_apply_updated";
  call_id: string;
  changes: Record<string, unknown>;
  [key: string]: unknown;
};

export type PatchApplyEndPayload = {
  type: "patch_apply_end";
  call_id: string;
  turn_id?: string;
  stdout: string;
  stderr: string;
  success: boolean;
  changes?: Record<string, unknown>;
  status: "completed" | "failed" | "declined";
  [key: string]: unknown;
};

export type TurnDiffPayload = {
  type: "turn_diff";
  unified_diff: string;
  [key: string]: unknown;
};

export type GetHistoryEntryResponsePayload = {
  type: "get_history_entry_response";
  offset: number;
  log_id: number;
  entry?: unknown | null;
  [key: string]: unknown;
};

export type McpListToolsResponsePayload = {
  type: "mcp_list_tools_response";
  tools: Record<string, unknown>;
  resources: Record<string, unknown[]>;
  resource_templates: Record<string, unknown[]>;
  auth_statuses: Record<
    string,
    "unsupported" | "not_logged_in" | "bearer_token" | "oauth" | string
  >;
  [key: string]: unknown;
};

export type McpStartupUpdatePayload = {
  type: "mcp_startup_update";
  server: string;
  status:
    | { state: "starting" }
    | { state: "ready" }
    | { state: "cancelled" }
    | { state: "failed"; error: string };
  [key: string]: unknown;
};

export type McpStartupCompletePayload = {
  type: "mcp_startup_complete";
  ready: string[];
  failed: Array<{ server: string; error: string }>;
  cancelled: string[];
  [key: string]: unknown;
};

export type ListSkillsResponsePayload = {
  type: "list_skills_response";
  skills: unknown[];
  [key: string]: unknown;
};

export type RealtimeConversationListVoicesResponsePayload = {
  type: "realtime_conversation_list_voices_response";
  voices: unknown;
  [key: string]: unknown;
};

export type SkillsUpdateAvailablePayload = {
  type: "skills_update_available";
  [key: string]: unknown;
};

export type PlanUpdatePayload = {
  type: "plan_update";
  [key: string]: unknown;
};

export type TurnAbortedPayload = {
  type: "turn_aborted";
  turn_id?: string | null;
  reason: "interrupted" | "replaced" | "review_ended" | string;
  completed_at?: number;
  duration_ms?: number;
  [key: string]: unknown;
};

export type ShutdownCompletePayload = {
  type: "shutdown_complete";
  [key: string]: unknown;
};

export type EnteredReviewModePayload = {
  type: "entered_review_mode";
  [key: string]: unknown;
};

export type ExitedReviewModePayload = {
  type: "exited_review_mode";
  review_output?: unknown | null;
  [key: string]: unknown;
};

export type RawResponseItemPayload = {
  type: "raw_response_item";
  item: ResponseItemPayload | unknown;
  [key: string]: unknown;
};

export type ItemStartedPayload = {
  type: "item_started";
  thread_id: string;
  turn_id: string;
  item: unknown;
  [key: string]: unknown;
};

export type ItemCompletedPayload = {
  type: "item_completed";
  thread_id: string;
  turn_id: string;
  item: unknown;
  [key: string]: unknown;
};

export type HookStartedPayload = {
  type: "hook_started";
  turn_id?: string | null;
  run: unknown;
  [key: string]: unknown;
};

export type HookCompletedPayload = {
  type: "hook_completed";
  turn_id?: string | null;
  run: unknown;
  [key: string]: unknown;
};

export type AgentMessageContentDeltaPayload = {
  type: "agent_message_content_delta";
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  [key: string]: unknown;
};

export type PlanDeltaPayload = {
  type: "plan_delta";
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  [key: string]: unknown;
};

export type ReasoningContentDeltaPayload = {
  type: "reasoning_content_delta";
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  summary_index?: number;
  [key: string]: unknown;
};

export type ReasoningRawContentDeltaPayload = {
  type: "reasoning_raw_content_delta";
  thread_id: string;
  turn_id: string;
  item_id: string;
  delta: string;
  content_index?: number;
  [key: string]: unknown;
};

export type CollabAgentSpawnBeginPayload = {
  type: "collab_agent_spawn_begin";
  call_id: string;
  sender_thread_id: string;
  prompt: string;
  model: string;
  reasoning_effort: unknown;
  [key: string]: unknown;
};

export type CollabAgentSpawnEndPayload = {
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

export type CollabAgentInteractionBeginPayload = {
  type: "collab_agent_interaction_begin";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  prompt: string;
  [key: string]: unknown;
};

export type CollabAgentInteractionEndPayload = {
  type: "collab_agent_interaction_end";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  prompt: string;
  status: unknown;
  [key: string]: unknown;
};

export type CollabWaitingBeginPayload = {
  type: "collab_waiting_begin";
  sender_thread_id: string;
  receiver_thread_ids: string[];
  receiver_agents?: unknown[];
  call_id: string;
  [key: string]: unknown;
};

export type CollabWaitingEndPayload = {
  type: "collab_waiting_end";
  sender_thread_id: string;
  call_id: string;
  agent_statuses?: unknown[];
  statuses: Record<string, unknown>;
  [key: string]: unknown;
};

export type CollabCloseBeginPayload = {
  type: "collab_close_begin";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  [key: string]: unknown;
};

export type CollabCloseEndPayload = {
  type: "collab_close_end";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  status: unknown;
  [key: string]: unknown;
};

export type CollabResumeBeginPayload = {
  type: "collab_resume_begin";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  [key: string]: unknown;
};

export type CollabResumeEndPayload = {
  type: "collab_resume_end";
  call_id: string;
  sender_thread_id: string;
  receiver_thread_id: string;
  receiver_agent_nickname?: string;
  receiver_agent_role?: string;
  status: unknown;
  [key: string]: unknown;
};

export type EventMsgPayload =
  | ErrorPayload
  | WarningPayload
  | GuardianWarningPayload
  | RealtimeConversationStartedPayload
  | RealtimeConversationRealtimePayload
  | RealtimeConversationClosedPayload
  | RealtimeConversationSdpPayload
  | ModelReroutePayload
  | ModelVerificationPayload
  | ContextCompactedPayload
  | ThreadRolledBackPayload
  | TurnStartedPayload
  | TaskStartedPayload
  | TurnCompletePayload
  | TaskCompletePayload
  | TokenCountPayload
  | AgentMessagePayload
  | UserMessagePayload
  | AgentMessageDeltaPayload
  | AgentReasoningPayload
  | AgentReasoningDeltaPayload
  | AgentReasoningRawContentPayload
  | AgentReasoningRawContentDeltaPayload
  | AgentReasoningSectionBreakPayload
  | SessionConfiguredPayload
  | ThreadNameUpdatedPayload
  | McpToolCallBeginPayload
  | McpToolCallEndPayload
  | WebSearchBeginPayload
  | WebSearchEndPayload
  | ImageGenerationBeginPayload
  | ImageGenerationEndPayload
  | ViewImageToolCallPayload
  | ExecApprovalRequestPayload
  | RequestPermissionsPayload
  | RequestUserInputPayload
  | DynamicToolCallRequestPayload
  | DynamicToolCallResponsePayload
  | ElicitationRequestPayload
  | ApplyPatchApprovalRequestPayload
  | GuardianAssessmentPayload
  | DeprecationNoticePayload
  | BackgroundEventPayload
  | UndoStartedPayload
  | UndoCompletedPayload
  | StreamErrorPayload
  | ExecCommandBeginPayload
  | ExecCommandOutputDeltaPayload
  | TerminalInteractionPayload
  | ExecCommandEndPayload
  | PatchApplyBeginPayload
  | PatchApplyUpdatedPayload
  | PatchApplyEndPayload
  | TurnDiffPayload
  | GetHistoryEntryResponsePayload
  | McpListToolsResponsePayload
  | McpStartupUpdatePayload
  | McpStartupCompletePayload
  | ListSkillsResponsePayload
  | RealtimeConversationListVoicesResponsePayload
  | SkillsUpdateAvailablePayload
  | PlanUpdatePayload
  | TurnAbortedPayload
  | ShutdownCompletePayload
  | EnteredReviewModePayload
  | ExitedReviewModePayload
  | RawResponseItemPayload
  | ItemStartedPayload
  | ItemCompletedPayload
  | HookStartedPayload
  | HookCompletedPayload
  | AgentMessageContentDeltaPayload
  | PlanDeltaPayload
  | ReasoningContentDeltaPayload
  | ReasoningRawContentDeltaPayload
  | CollabAgentSpawnBeginPayload
  | CollabAgentSpawnEndPayload
  | CollabAgentInteractionBeginPayload
  | CollabAgentInteractionEndPayload
  | CollabWaitingBeginPayload
  | CollabWaitingEndPayload
  | CollabCloseBeginPayload
  | CollabCloseEndPayload
  | CollabResumeBeginPayload
  | CollabResumeEndPayload;

export type EventMsgLine = {
  timestamp: string;
  type: "event_msg";
  payload: EventMsgPayload;
};

export type LegacyRolloutLine =
  | SessionMetaLine
  | ResponseItemLine
  | CompactedLine
  | TurnContextLine
  | EventMsgLine;

export type LineSchema = LegacyRolloutLine;

export type HookInput = {
  session_id: string;
  turn_id: string | null;
  transcript_path: string;
  hook_event_name: "Stop";
};

export type Session = {
  session_id: string;
  model_provider: string | undefined;
  base_instructions: string | undefined;
  cli_version: string;
  cwd?: string;
  git?: GitInfo;
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

export type Task = {
  turnId: { id: string; timestamp: number } | undefined;
  // 1-based native turn index within the thread.
  turnNumber: number | undefined;
  messages: AggregateMessage<ResponseItem>[];
  userMessageIndex: number | undefined;
  context: { model: string; [key: string]: unknown } | undefined;
  tokenCount: { total_token_usage?: TokenCount; model_context_window?: number } | undefined;
  toolCalls: {
    [callId: string]: {
      error: string | undefined;
      timings: number[];
      outputs: Record<string, unknown>;
    };
  };
};

export type StandardMessage = {
  role: string;
  content: { type: string; [key: string]: unknown }[];
  [key: string]: unknown;
};
