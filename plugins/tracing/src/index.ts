import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dispatchHookCommand } from "@langchain/plugins-base/plugin";
import { createCodexTracingSession, runCodexEngineWorker } from "./tracing-engine.js";
import { queueCodexTurns } from "./turn-queue.js";
import { getConfig } from "./config.js";
import { ENGINE_WORKER_FLAG, LS_INTEGRATION_VERSION } from "./constants.js";
import { binary } from "./binary.js";
import { tracingFailed, usage } from "./messages.js";
import type { CodexHookInput } from "./models/hook-input.js";
import { handlePromptSubmit } from "./user-prompt-submit.js";
import { homeDirectory } from "./utils/home.js";
import { showPendingWarning } from "./warnings.js";
import { readStdin } from "./utils/stdin.js";

async function runHook() {
  const content = await readStdin<CodexHookInput>();
  await showPendingWarning(homeDirectory());

  if (content.hook_event_name === "UserPromptSubmit") {
    const result = await handlePromptSubmit(content);
    if (result) console.log(JSON.stringify(result));
    return;
  }
  if (content.hook_event_name !== "Stop") return;
  const config = await getConfig({ home: homeDirectory(), cwd: content.cwd, env: process.env });

  // Skip entirely if tracing is disabled
  if (!config.enabled) return;

  if (!content.session_id || !content.turn_id || !content.transcript_path) return;
  await access(content.transcript_path, fsConstants.R_OK);
  const session = createCodexTracingSession(config, content.session_id, content.cwd);
  if (!session) return;
  await queueCodexTurns(session, config, {
    transcriptPath: content.transcript_path,
    turnId: content.turn_id,
    cwd: content.cwd,
  });
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
    version: LS_INTEGRATION_VERSION ?? "development",
    hooks: {},
    worker: {
      command: ENGINE_WORKER_FLAG,
      run: ([sessionId, cwd]) => {
        if (!sessionId || !cwd) {
          throw new Error("shared trace worker needs a session ID and working directory");
        }
        return runCodexEngineWorker(sessionId, cwd);
      },
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
