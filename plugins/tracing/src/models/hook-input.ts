import type { USER_PROMPT_SUBMIT_EVENT } from "../constants.js";
import type { Config } from "./config.js";

export interface CodexHookInput {
  session_id: string;
  turn_id: string;
  transcript_path: string;
  hook_event_name: "Stop" | "UserPromptSubmit" | "PostToolUse";
  cwd: string;
  prompt: string;
  tool_use_id?: string;
}

export type PromptSubmitInput = Pick<CodexHookInput, "session_id" | "turn_id" | "cwd" | "prompt">;

export interface PromptSubmitContext {
  hookEventName: typeof USER_PROMPT_SUBMIT_EVENT;
  additionalContext: string;
}

export interface PromptSubmitOutput {
  decision?: "block";
  reason?: string;
  systemMessage?: string;
  hookSpecificOutput?: PromptSubmitContext;
}

export interface TurnEvidence {
  config?: Config;
  reply?: string;
  failure?: string;
}
