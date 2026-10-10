import {
  buildCodingAgentMetadata,
  type CodingAgentAgentType,
} from "@langchain/plugins-base/metadata";
import { METADATA_FIXTURE_IDENTITY, METADATA_FIXTURE_RUN_NAME } from "./metadata-constants.js";

export function metadataFixture(
  base: Record<string, unknown>,
  structural: Record<string, unknown>,
): Record<string, unknown> {
  return buildCodingAgentMetadata({
    integration: METADATA_FIXTURE_IDENTITY.ls_integration,
    agentType:
      (structural.ls_agent_type as CodingAgentAgentType) ?? METADATA_FIXTURE_IDENTITY.ls_agent_type,
    runType: METADATA_FIXTURE_IDENTITY.ls_agent_type,
    threadId: (structural.thread_id as string) ?? METADATA_FIXTURE_IDENTITY.thread_id,
    turnId: structural.turn_id as string | undefined,
    turnNumber: structural.turn_number as number | undefined,
    runtimeVersion: structural.ls_agent_runtime_version as string | undefined,
    integrationVersion: structural.ls_integration_version as string | undefined,
    subagentId: structural.ls_subagent_id as string | undefined,
    subagentType: structural.ls_subagent_type as string | undefined,
    toolName: structural.ls_tool_name as string | undefined,
    runName: METADATA_FIXTURE_RUN_NAME,
    skillName: structural.ls_skill_name as string | undefined,
    modelName: structural.ls_model_name as string | undefined,
    usageMetadata: structural.usage_metadata as Record<string, unknown> | undefined,
    providerMetadata: { ls_raw_aggregated_usage: structural.ls_raw_aggregated_usage },
    runSpecific: structural,
    base,
  });
}
