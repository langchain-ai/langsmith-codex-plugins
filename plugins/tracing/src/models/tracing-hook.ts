export interface TracingHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: "Stop" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse";
  cwd: string;
  prompt: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
}
