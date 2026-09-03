//#region src/index.d.ts
type CommonInput = {
  session_id?: string;
  thread_id?: string;
  transcript_path: string | null;
  turn_id?: string;
  prompt_id?: string;
};
type PromptInput = CommonInput & {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
};
declare function handleUserPromptSubmit(input: PromptInput): Promise<boolean>;
declare function runHook(): Promise<void>;
//#endregion
export { handleUserPromptSubmit, runHook };