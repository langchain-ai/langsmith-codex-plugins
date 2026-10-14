import { createCodingAgentRunTree } from "@langchain/plugins-base/privacy";
import { LS_INTEGRATION, MODE_FULL, MODE_METADATA, RESETTABLE_METADATA_KEYS } from "./constants.js";
import type { TracingMode } from "./models/tracing-policy.js";
import type { RunTree, RunTreeConfig } from "langsmith";

const metadataProtectedRunTrees = new WeakSet<RunTree>();

function applyMetadataResets(run: RunTree, config: RunTreeConfig): void {
  const source = config.extra?.metadata;
  if (!source) return;
  const resets: Record<string, undefined> = {};
  for (const key of RESETTABLE_METADATA_KEYS) {
    if (Object.hasOwn(source, key) && source[key] === undefined) resets[key] = undefined;
  }
  if (Object.keys(resets).length === 0) return;
  run.extra = { ...run.extra, metadata: { ...run.extra?.metadata, ...resets } };
}

function protectedChildRunTree(
  config: RunTreeConfig,
  mode: TracingMode,
  parent: RunTree,
  child: RunTree,
): RunTree {
  const safeChild = createCodingAgentRunTree(
    {
      ...config,
      client: child.client,
      id: child.id,
      parent_run: parent,
      parent_run_id: child.parent_run_id,
      project_name: child.project_name,
      replicas: child.replicas,
      trace_id: child.trace_id,
      dotted_order: child.dotted_order,
      start_time: child.start_time,
      end_time: child.end_time,
    },
    LS_INTEGRATION,
    mode,
  );
  applyMetadataResets(safeChild, config);
  safeChild.execution_order = child.execution_order;
  safeChild.child_execution_order = child.child_execution_order;
  parent.child_runs[parent.child_runs.indexOf(child)] = safeChild;
  metadataProtectedRunTrees.add(safeChild);
  return safeChild;
}

function createChildRunTree(config: RunTreeConfig, mode: TracingMode, parent: RunTree): RunTree {
  const child = parent.createChild(config);
  applyMetadataResets(child, config);
  if (mode !== MODE_METADATA || metadataProtectedRunTrees.has(parent)) {
    if (mode === MODE_METADATA) metadataProtectedRunTrees.add(child);
    return child;
  }
  return protectedChildRunTree(config, mode, parent, child);
}

export function createRunTree(
  config: RunTreeConfig,
  mode: TracingMode = MODE_FULL,
  parent?: RunTree,
): RunTree {
  if (parent) return createChildRunTree(config, mode, parent);
  const run = createCodingAgentRunTree(config, LS_INTEGRATION, mode);
  if (mode === MODE_METADATA) metadataProtectedRunTrees.add(run);
  return run;
}
