import type { CapturedTool } from "./models/tool-capture.js";
import type { CapturedToolRunInput } from "./models/tool-trace.js";
import type { AggregateMessage, StandardMessage } from "./types.js";
import { REPOSITORY_METADATA_KEYS } from "./metadata-constants.js";
import type { TurnAttribution } from "./metadata-models.js";
import type { ReconciliationMetadata } from "./models/tool-capture.js";
import { toolRepositoryMetadata, withTrustedMetadata } from "./metadata.js";
import { stableRunId } from "./trace-delivery.js";
import { createRunTree } from "./privacy.js";

export function capturedAttributionMessages(
  tools: CapturedTool[],
  messages: AggregateMessage<StandardMessage>[],
): AggregateMessage<StandardMessage>[] {
  const existing = new Set(
    messages.flatMap(({ message }) =>
      message.role === "ai"
        ? message.content.flatMap((part) => (part.type === "tool_call" ? [part.id] : []))
        : [],
    ),
  );
  return tools
    .filter((tool) => !existing.has(tool.id))
    .map((tool) => ({
      message: {
        role: "ai",
        content: [{ type: "tool_call", id: tool.id, name: tool.name, args: tool.input }],
      },
      timestamp: tool.startedAt,
      tokenCount: undefined,
      subagentThreads: [],
    }));
}

export async function postCapturedTools(input: CapturedToolRunInput) {
  if (input.mode === "off") return;
  for (const tool of input.tools) {
    if (tool.endedAt == null || input.postedToolIds.has(tool.id)) continue;
    const call = input.messages
      .flatMap(({ message }) => (message.role === "ai" ? message.content : []))
      .find((part) => part.type === "tool_call" && part.id === tool.id);
    const args = call?.type === "tool_call" ? call.args : tool.input;
    const metadata = input.reconciliation?.tools[tool.id];
    const run = createRunTree(
      {
        id: stableRunId(input.sessionId, input.rolloutFile, input.turnKey, `tool:${tool.id}`),
        name: call?.type === "tool_call" && typeof call.name === "string" ? call.name : tool.name,
        run_type: "tool",
        start_time: tool.startedAt,
        end_time: tool.endedAt,
        inputs: { input: args },
        outputs: { output: tool.output },
        extra: {
          metadata: withTrustedMetadata(
            {},
            {
              ...input.base,
              ...(metadata ? repositoryFields(metadata) : {}),
              approval_policy: undefined,
              ls_subagent_id: undefined,
              ls_subagent_type: undefined,
            },
          ),
        },
      },
      input.mode,
      input.parent,
    );
    await run.postRun();
  }
}

export function repositoryFields(metadata: Record<string, unknown>) {
  return Object.fromEntries(REPOSITORY_METADATA_KEYS.map((key) => [key, metadata[key]]));
}

export function proposedReconciliation(
  base: Record<string, unknown>,
  attribution?: TurnAttribution,
): ReconciliationMetadata {
  return {
    root: repositoryFields(base),
    tools: Object.fromEntries(
      [...(attribution?.tools ?? [])].map(([id, tool]) => [
        id,
        tool.resolved
          ? {
              ...toolRepositoryMetadata(tool.resolved),
              ls_attribution_identifier: tool.resolved.identifier ?? base.ls_attribution_identifier,
            }
          : repositoryFields(base),
      ]),
    ),
  };
}
