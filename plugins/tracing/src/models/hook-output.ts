import type { USER_PROMPT_SUBMIT_EVENT } from "../constants.js";

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
