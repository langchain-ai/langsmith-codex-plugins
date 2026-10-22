export interface CodexHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: "Stop" | "UserPromptSubmit" | "PostToolUse";
  cwd: string;
  prompt: string;
  tool_use_id?: string;
}

export type PromptSubmitInput = Pick<CodexHookInput, "session_id" | "turn_id" | "cwd" | "prompt"> &
  Partial<Pick<CodexHookInput, "transcript_path">>;
