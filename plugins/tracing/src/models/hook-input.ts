import type { PROMPT_COMMANDS } from "../constants.js";
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

export type PromptCommandName = (typeof PROMPT_COMMANDS)[number]["name"];

export type TurnEvidence =
  | { config: Config; warning?: string; failure?: undefined }
  | { config?: Config; failure: string };

export interface CommandContext {
  input: PromptSubmitInput;
  turn: TurnEvidence;
}
