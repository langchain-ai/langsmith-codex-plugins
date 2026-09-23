import { defineBinaryTarget } from "@langchain/langsmith-plugin-binary";
import config from "../../../binary.config.json" with { type: "json" };

export const binary = defineBinaryTarget({
  executableName: config.executableName,
  repository: config.repository,
  userAgent: "langsmith-codex",
  releasesApiOverrideEnvVar: "LANGSMITH_CODEX_RELEASE_API",
});
