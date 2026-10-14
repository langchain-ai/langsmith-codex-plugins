export interface CodexHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: "Stop" | "UserPromptSubmit";
  cwd: string;
  prompt: string;
}

export type PromptSubmitInput = Pick<CodexHookInput, "session_id" | "turn_id" | "cwd" | "prompt">;
