import type { ToolCallEvidence } from "./models/tool-attribution.js";
import * as path from "node:path";
import { createSecretAnonymizer } from "langsmith/anonymizer";
import type { CaptureRedactor, ReconciliationMetadata } from "./models/tool-capture.js";
import type { Client } from "langsmith";
import { patchAndVerify, readAndValidate } from "./incremental-delivery.js";
import { identityFor } from "./incremental-run.js";
import { validateCheckpoint } from "./incremental-delivery-store.js";
import type {
  IncrementalDeliveryCheckpoint,
  RuntimeClientConfig,
} from "./models/incremental-delivery.js";
import type { StaleRecoveryGuard, StaleStateArtifactGroup } from "./models/stale-state-cleanup.js";
import { INCREMENTAL_DELIVERY_MAX_BYTES } from "./constants/incremental-delivery.js";
import {
  STALE_PLUGIN_INCREMENTAL_PATTERN,
  STALE_RECOVERY_ERROR,
  STALE_RECOVERY_LIMIT,
} from "./constants/stale-state-cleanup.js";
import { TURN_CAPTURE_PLAN } from "./tool-capture-constants.js";
import { readBoundedText, writePrivateFile } from "./utils/files.js";
import { asRecord } from "./utils/objects.js";
import { normalizedEndpoint } from "./utils/http.js";
import {
  prepareTurnCapture,
  reconciliationMetadata,
  turnCaptureDirectory,
} from "./tool-capture.js";
import { capturedAttributionMessages, proposedReconciliation } from "./tool-trace.js";
import { resolveTurnAttribution } from "./attribution.js";
import { codingAgentMetadata } from "./metadata.js";
import { convertToStandardMessages } from "./trace.js";
import { stableRunId } from "./trace-delivery.js";

async function checkpointFromFile(file: string) {
  const value = JSON.parse(await readBoundedText(file, INCREMENTAL_DELIVERY_MAX_BYTES));
  return validateCheckpoint(value, value);
}

function matchingClient(checkpoint: IncrementalDeliveryCheckpoint, clients: Client[]) {
  return clients.find((client) => {
    const runtime = client as unknown as RuntimeClientConfig;
    if (!runtime.apiUrl || normalizedEndpoint(runtime.apiUrl) !== checkpoint.endpoint) return false;
    const identity = identityFor(
      client,
      checkpoint.endpoint,
      checkpoint.projectName,
      checkpoint.runId,
    );
    return (
      identity.workspaceId === checkpoint.workspaceId &&
      identity.credentialHash === checkpoint.credentialHash
    );
  });
}

async function recoverMetadata(
  group: StaleStateArtifactGroup,
  checkpoint: IncrementalDeliveryCheckpoint,
  redact: CaptureRedactor,
) {
  const recovery = checkpoint.recovery!;
  if (recovery.metadata.ls_tracing_mode !== "full") return undefined;
  const capture = await prepareTurnCapture(
    group.transcript,
    recovery.turnKey,
    "full",
    undefined,
    true,
  );
  const evidence: Record<string, ToolCallEvidence> = {};
  let active = false;
  for (const event of capture.events) {
    if (event.type !== "event_msg") continue;
    const payload = event.payload;
    if (payload.type === "task_started") active = payload.turn_id === recovery.turnKey;
    if (!active || typeof payload.call_id !== "string") continue;
    const tool = (evidence[payload.call_id] ??= { error: undefined, timings: [], outputs: {} });
    if (payload.type === "exec_command_end" && typeof payload.cwd === "string")
      tool.executionCwd = payload.cwd;
    if (payload.type === "patch_apply_end")
      tool.changedPaths = Object.keys(asRecord(payload.changes));
  }
  const session = capture.events.find((event) => event.type === "session_meta");
  if (session?.type === "session_meta" && session.payload.id !== group.sessionId)
    throw new Error("Recovery transcript does not match its session");
  const metadata = recovery.metadata;
  const messages = convertToStandardMessages(
    capture.events.flatMap((event) =>
      event.type === "response_item"
        ? [
            {
              message: event.payload,
              timestamp: Date.parse(event.timestamp),
              tokenCount: undefined,
              subagentThreads: [],
            },
          ]
        : [],
    ),
  );
  const attribution = await resolveTurnAttribution({
    cwd: typeof metadata.cwd === "string" ? metadata.cwd : session?.payload.cwd,
    sessionCwd: session?.payload.cwd,
    sessionGit: session?.payload.git,
    sessionIdentifier: session?.payload.ls_attribution_identifier,
    existingMetadata: metadata,
    messages: [...messages, ...capturedAttributionMessages(capture.tools, messages)].sort(
      (a, b) => a.timestamp - b.timestamp,
    ),
    toolCalls: evidence,
  });
  const base = codingAgentMetadata(
    { agentType: "root", git: attribution.git, attributionIdentifier: attribution.identifier },
    metadata,
  );
  const plan = await reconciliationMetadata(
    group.transcript,
    recovery.turnKey,
    redact(proposedReconciliation(base, attribution)),
  );
  const planFile = path.join(
    turnCaptureDirectory(group.transcript, recovery.turnKey),
    TURN_CAPTURE_PLAN,
  );
  if (!group.artifacts.includes(planFile)) group.artifacts.push(planFile);
  return plan;
}

export function staleTurnRecovery(
  clients: Client[],
  redact: CaptureRedactor = createSecretAnonymizer(),
  redactionPolicy?: string,
) {
  let remaining = STALE_RECOVERY_LIMIT;
  return async (
    group: StaleStateArtifactGroup,
    guard: StaleRecoveryGuard = async () => true,
  ): Promise<boolean> => {
    const files = group.artifacts.filter((file) =>
      STALE_PLUGIN_INCREMENTAL_PATTERN.test(path.basename(file)),
    );
    const checkpoints = await Promise.all(files.map(checkpointFromFile));
    const matches = checkpoints.map((checkpoint) => matchingClient(checkpoint, clients));
    if (
      checkpoints.some(
        (checkpoint, index) =>
          !checkpoint.finalized &&
          (!matches[index] ||
            !checkpoint.recovery ||
            checkpoint.recovery.redactionPolicy !== redactionPolicy ||
            (checkpoint.recovery.sessionId ?? checkpoint.recovery.metadata.thread_id) !==
              group.sessionId ||
            checkpoint.recovery.metadata.turn_id !== checkpoint.recovery.turnKey),
      )
    )
      return false;
    const plans = new Map<IncrementalDeliveryCheckpoint, ReconciliationMetadata | undefined>();
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (checkpoint.finalized) continue;
      if (!(await guard())) return false;
      if (remaining-- <= 0) return false;
      const client = matches[index]!;
      const existing = await readAndValidate(client, undefined, checkpoint);
      if (!(await guard(true))) return false;
      const recovery = checkpoint.recovery!;
      const rootId = stableRunId(group.sessionId, group.transcript, recovery.turnKey, "root");
      const root = checkpoints.find(
        (candidate) =>
          candidate.runId === rootId &&
          candidate.endpoint === checkpoint.endpoint &&
          candidate.projectName === checkpoint.projectName &&
          candidate.workspaceId === checkpoint.workspaceId &&
          candidate.credentialHash === checkpoint.credentialHash,
      );
      if (!root) return false;
      if (!plans.has(root)) plans.set(root, await recoverMetadata(group, root, redact));
      if (!(await guard())) return false;
      const plan = plans.get(root);
      const toolId = Object.keys(plan?.tools ?? {}).find(
        (id) =>
          stableRunId(group.sessionId, group.transcript, recovery.turnKey, `tool:${id}`) ===
          checkpoint.runId,
      );
      const metadata: Record<string, unknown> = {
        ...asRecord(asRecord(existing.extra).metadata),
        ...recovery.metadata,
        ...(toolId ? plan?.tools[toolId] : plan?.root),
      };
      const endTime =
        recovery.endTime ??
        Math.max(
          ...checkpoints
            .filter((item) => item.recovery?.turnKey === recovery.turnKey)
            .map((item) => new Date(item.recovery?.endTime ?? item.topology.startTime).getTime()),
        );
      const interrupted = recovery.endTime === undefined;
      metadata.status = interrupted ? "error" : "completed";
      if (!(await guard(true))) return false;
      await patchAndVerify(
        client,
        {
          inputs: existing.inputs,
          outputs: existing.outputs,
          error: interrupted ? STALE_RECOVERY_ERROR : existing.error,
          end_time: endTime,
          extra: { ...asRecord(existing.extra), metadata },
        },
        undefined,
        checkpoint,
      );
      if (!(await guard(true))) return false;
      await writePrivateFile(files[index], JSON.stringify({ ...checkpoint, finalized: true }));
    }
    return true;
  };
}
