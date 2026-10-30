export interface CodexHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: string;
  cwd: string;
  prompt: string;
  tool_use_id?: string;
}

export type PromptSubmitInput = Pick<CodexHookInput, "session_id" | "turn_id" | "cwd" | "prompt"> &
  Partial<Pick<CodexHookInput, "hook_event_name">>;

export interface HookPlacement {
  direction: "input" | "output";
  scope: "tool" | "turn";
}

export interface HookFiring {
  event: string | undefined;
  turn_id: string | null | undefined;
  tool_use_id: string | null | undefined;
  time: number;
}
