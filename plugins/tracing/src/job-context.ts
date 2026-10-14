import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import { createStateStore, pruneStateEntries } from "@langchain/plugins-base/storage";
import type { StateStore } from "@langchain/plugins-base/storage";
import { CODEX_CONFIG_DIRECTORY, JOB_STATE_FILE_NAME, STATE_FILE_MAX_AGE_MS } from "./constants.js";
import type { CodexJobContext, CodexJobState } from "./models/tracing-engine.js";
import { contextDigestFromRef } from "./tracing-engine-locator.js";

function jobStore(home: string): StateStore<CodexJobState> {
  return createStateStore<CodexJobState>({
    path: path.join(home, CODEX_CONFIG_DIRECTORY, JOB_STATE_FILE_NAME),
  });
}

export async function saveJobContext(
  home: string,
  sessionId: string,
  contextRef: string,
  context: CodexJobContext,
): Promise<void> {
  const job = contextDigestFromRef(contextRef);
  await mkdir(path.join(home, CODEX_CONFIG_DIRECTORY), { recursive: true, mode: 0o700 });
  await jobStore(home).update((state) => {
    const fresh = pruneStateEntries(state, STATE_FILE_MAX_AGE_MS);
    const queued = Object.hasOwn(fresh, sessionId) ? fresh[sessionId].queued_jobs : {};
    return {
      ...fresh,
      [sessionId]: {
        updated: new Date().toISOString(),
        queued_jobs: { ...queued, [job]: context },
      },
    };
  });
}

export function readJobContext(
  home: string,
  sessionId: string,
  contextRef: string,
): CodexJobContext | undefined {
  const state = jobStore(home).read();
  const queued = Object.hasOwn(state, sessionId) ? state[sessionId].queued_jobs : {};
  const job = contextDigestFromRef(contextRef);
  return Object.hasOwn(queued, job) ? queued[job] : undefined;
}

export async function removeJobContext(
  home: string,
  sessionId: string,
  contextRef: string,
): Promise<void> {
  const job = contextDigestFromRef(contextRef);
  await jobStore(home).update((state) => {
    if (!Object.hasOwn(state, sessionId)) return state;
    const { [job]: _done, ...queued } = state[sessionId].queued_jobs;
    const { [sessionId]: session, ...others } = state;
    return Object.keys(queued).length === 0
      ? others
      : { ...others, [sessionId]: { ...session, queued_jobs: queued } };
  });
}
