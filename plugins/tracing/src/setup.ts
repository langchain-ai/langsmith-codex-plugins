import type { UploadCredential } from "@langchain/plugins-base/auth";
import {
  describeSetup,
  parseSetupArguments,
  writeSetupConfig,
  type SetupOutcome,
} from "@langchain/plugins-base/settings";
import { getConfig } from "./config.js";
import {
  CODEX_CONFIG_DIRECTORY,
  DEFAULT_LANGSMITH_API_URL,
  MODE_METADATA,
  SETUP_COMMAND_PATTERN,
  STRICT_NOTICE_KINDS,
} from "./constants.js";
import { loginNotices } from "./login-notice.js";
import type { Config } from "./models/config.js";
import type { SetupCredential } from "./models/setup.js";
import { loginRefusal, uploadAuth, uploadCredential, uploadReplicas } from "./tracing-engine.js";
import { defaultPrivacyPath, previewTurnMode } from "./tracing-policy.js";
import { errorText } from "./utils/errorText.js";
import { homeDirectory } from "./utils/home.js";

export function parseSetupCommand(prompt: string): string | undefined {
  const match = SETUP_COMMAND_PATTERN.exec(prompt);
  return match ? (match[1] ?? "") : undefined;
}

function signInKind(kind: UploadCredential["kind"] | undefined): SetupOutcome["signIn"] {
  if (kind === undefined) return "none";
  return kind === "login" ? "login" : "api-key";
}

function setupCredential(config: Config): SetupCredential {
  const credential = uploadCredential(config);
  const auth = uploadAuth(config);
  const paused = loginNotices(homeDirectory(), config, credential).find(({ kind }) =>
    STRICT_NOTICE_KINDS.includes(kind),
  );
  const problem = config.managedConfigProblem ?? paused?.text ?? loginRefusal(config, credential);
  const replicas = auth === undefined ? undefined : uploadReplicas(config, auth);
  return {
    apiUrl: auth?.apiUrl ?? config.api_url ?? DEFAULT_LANGSMITH_API_URL,
    signIn: signInKind(auth?.kind),
    replicaCount: replicas?.length ?? 0,
    ...(problem === undefined ? {} : { credentialProblem: problem }),
  };
}

export async function runSetup(
  cwd: string,
  sessionId: string,
  argumentText: string,
): Promise<string> {
  try {
    const requested = parseSetupArguments(argumentText);
    const path = writeSetupConfig(homeDirectory(), CODEX_CONFIG_DIRECTORY, requested);
    const config = await getConfig({ home: homeDirectory(), cwd, env: process.env });
    return describeSetup({
      path,
      requested,
      enabled: config.enabled,
      muted: previewTurnMode(defaultPrivacyPath(), sessionId, config) === MODE_METADATA,
      project: config.project,
      ...(config.agent_id === undefined ? {} : { agentId: config.agent_id }),
      ...setupCredential(config),
    });
  } catch (error) {
    return errorText(error);
  }
}
