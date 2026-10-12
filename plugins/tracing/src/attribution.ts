import type { ToolAttribution, TurnAttribution, TurnAttributionInput } from "./metadata-models.js";
import { mergeGitInfo, resolveGitAttribution } from "./metadata.js";
import { resolveToolAttribution } from "./tool-attribution.js";

export async function resolveTurnAttribution(
  input: TurnAttributionInput,
): Promise<TurnAttribution> {
  const cwdAttribution = await resolveGitAttribution(input.cwd);
  let rootAttribution = cwdAttribution;
  const sessionCwdChanged = input.sessionCwd != null && input.sessionCwd !== input.cwd;
  const sessionAttribution =
    input.sessionCwd != null
      ? input.sessionCwd === input.cwd
        ? rootAttribution
        : await resolveGitAttribution(input.sessionCwd)
      : undefined;
  const rootSessionGit =
    sessionCwdChanged && cwdAttribution != null && sessionAttribution?.root !== cwdAttribution.root
      ? undefined
      : input.sessionGit;
  let rootRepositoryKnown = [
    rootAttribution?.git.repository_url,
    rootSessionGit?.repository_url,
    input.existingMetadata.repository_url,
  ].some((repositoryUrl) => typeof repositoryUrl === "string" && repositoryUrl.trim().length > 0);
  let repositoryFallbackSelected = false;
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
        rootSessionGit,
      );
      tools.set(call.id, toolAttribution);
      const toolRepositoryUrl = toolAttribution.resolved?.git.repository_url;
      const toolResolved = toolAttribution.resolved;
      const toolHasRepository =
        typeof toolRepositoryUrl === "string" && toolRepositoryUrl.trim().length > 0;
      if (fallbackIdentifier == null && toolResolved?.identifier != null) {
        fallbackIdentifier = toolResolved.identifier;
      }
      if (!rootRepositoryKnown && toolAttribution.explicit && toolHasRepository && toolResolved) {
        rootAttribution = toolResolved;
        rootRepositoryKnown = true;
        repositoryFallbackSelected = true;
      }
    }
  }
  const git =
    repositoryFallbackSelected && cwdAttribution != null
      ? rootAttribution?.git
      : mergeGitInfo(rootAttribution?.git, rootSessionGit);
  const existingIdentifier = input.existingMetadata.ls_attribution_identifier;
  const identifier =
    input.sessionIdentifier ??
    (typeof existingIdentifier === "string" ? existingIdentifier : fallbackIdentifier);
  return { git, identifier, tools };
}
