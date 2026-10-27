import { RunTree } from "langsmith";
import { AGENT_ADDRESS_PATTERN, PARENT_PROJECT_PROBE } from "./constants.js";
import type { Config } from "./models/config.js";
import type { ParentDestination } from "./models/parent-destination.js";

export function parentDestination(config: Config): ParentDestination {
  if (!config.parent_headers) return {};
  const parent = RunTree.fromHeaders(config.parent_headers, {
    project_name: PARENT_PROJECT_PROBE,
  });
  const agentId =
    parent?.address === undefined ? undefined : AGENT_ADDRESS_PATTERN.exec(parent.address)?.[1];
  if (agentId !== undefined) return { agentId };
  const projectName = parent?.project_name;
  return projectName === undefined || projectName === PARENT_PROJECT_PROBE ? {} : { projectName };
}
