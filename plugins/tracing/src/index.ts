import { dispatchHookCommand } from "@langchain/plugins-base/plugin";
import {
  ENGINE_WORKER_FLAG,
  PLUGIN_VERSION,
  POST_TOOL_USE_EVENT,
  STOP_EVENT,
  USER_PROMPT_SUBMIT_EVENT,
} from "./constants.js";
import { binary } from "./binary.js";
import { tracingFailed, usage } from "./messages.js";
import type { CodexHookInput } from "./models/hook-input.js";
import { runTracerWorker, sendTracerNote } from "./tracer-hooks.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import { homeDirectory } from "./utils/home.js";
import { showPendingWarning } from "./warnings.js";
import { readStdin } from "./utils/stdin.js";

async function runHook() {
  const content = await readStdin<CodexHookInput>();
  if (content.hook_event_name === POST_TOOL_USE_EVENT) {
    await sendTracerNote(content);
    return;
  }
  await showPendingWarning(homeDirectory());

  if (content.hook_event_name === USER_PROMPT_SUBMIT_EVENT) {
    const result = await handlePromptSubmit(content);
    if (result) console.log(JSON.stringify(result));
    await sendTracerNote(content);
    return;
  }
  if (content.hook_event_name === STOP_EVENT) await sendTracerNote(content);
}

const USAGE = usage(binary.target.executableName);
const args = process.argv.slice(2);

if (args.length === 0) {
  runHook().catch((error: unknown) => {
    console.error(tracingFailed(error));
  });
} else {
  await dispatchHookCommand(args, {
    usage: USAGE,
    version: PLUGIN_VERSION,
    hooks: {},
    worker: {
      command: ENGINE_WORKER_FLAG,
      run: ([cwd]) => runTracerWorker(cwd ?? process.cwd()),
    },
    onHookError: (_name, error) => {
      console.error(tracingFailed(error));
      process.exitCode = 1;
    },
    onUnknown: (argument) => {
      console.error(`unknown option: ${argument}`);
      console.error(USAGE);
      process.exitCode = 1;
    },
  });
}
