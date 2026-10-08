import type { ToolAttribution, TurnAttribution, TurnAttributionInput } from "./metadata-models.js";
import { mergeGitInfo, resolveGitAttribution } from "./git.js";
import { resolveToolAttribution } from "./tool-attribution.js";

export async function resolveTurnAttribution(
  input: TurnAttributionInput,
): Promise<TurnAttribution> {
  let rootAttribution = await resolveGitAttribution(input.cwd);
  const sessionCwdChanged = input.sessionCwd != null && input.sessionCwd !== input.cwd;
  const sessionAttribution =
    input.sessionCwd != null
      ? input.sessionCwd === input.cwd
        ? rootAttribution
        : await resolveGitAttribution(input.sessionCwd)
      : undefined;
  const sessionGitForCurrentRoot = () => {
    if (
      sessionCwdChanged &&
      rootAttribution != null &&
      sessionAttribution?.root !== rootAttribution.root
    ) {
      return undefined;
    }
    return input.sessionGit;
  };
  let fallbackIdentifier = rootAttribution?.identifier;
  const tools = new Map<string, ToolAttribution>();
  for (const { message } of input.messages) {
    if (message.role !== "ai") continue;
    for (const call of message.content) {
      if (call.type !== "tool_call" || typeof call.id !== "string") continue;
      const toolAttribution = await resolveToolAttribution(
        call.args,
        input.toolCalls[call.id],
        input.cwd,
        sessionGitForCurrentRoot(),
      );
      tools.set(call.id, toolAttribution);
      if (fallbackIdentifier == null && toolAttribution.resolved?.identifier != null) {
        fallbackIdentifier = toolAttribution.resolved.identifier;
      }
      if (rootAttribution == null && toolAttribution.explicit && toolAttribution.resolved != null) {
        rootAttribution = toolAttribution.resolved;
      }
    }
  }
  const git = mergeGitInfo(rootAttribution?.git, sessionGitForCurrentRoot());
  const existingIdentifier = input.existingMetadata.ls_attribution_identifier;
  const identifier =
    input.sessionIdentifier ??
    (typeof existingIdentifier === "string" ? existingIdentifier : fallbackIdentifier);
  return { git, identifier, tools };
}
