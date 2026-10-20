import {
  LOGIN_NOTICE_KIND,
  readLoginNotice,
  refusedLoginReplicas,
  resolveUploadCredential,
  type UploadCredential,
} from "@langchain/plugins-base/auth";
import { toSdkReplicas } from "@langchain/plugins-base/settings";
import { LOGIN_KEY_VARIABLES, NOTICE_KIND_CREDENTIAL, NOTICE_KIND_REPLICA } from "./constants.js";
import type { Config } from "./models/config.js";
import type { Notice } from "./models/notices.js";
import { engineStorageRoot } from "./tracing-engine.js";

function withoutKeys(): UploadCredential {
  const env = { ...process.env };
  for (const name of LOGIN_KEY_VARIABLES) delete env[name];
  return resolveUploadCredential({ env });
}

export function loginNotices(home: string, config: Config, credential: UploadCredential): Notice[] {
  if (!config.enabled) return [];
  if (credential.kind === "none") {
    const fallback = withoutKeys();
    const text = fallback.kind === "none" ? fallback.reason : credential.reason;
    return [{ kind: NOTICE_KIND_CREDENTIAL, text }];
  }
  const saved = readLoginNotice(
    engineStorageRoot(home),
    credential.kind === "api-key" ? {} : process.env,
  );
  const notices = saved === undefined ? [] : [{ kind: LOGIN_NOTICE_KIND, text: saved }];
  if (credential.kind === "api-key") return notices;
  const skipped = refusedLoginReplicas(toSdkReplicas(config.replicas), credential.apiUrl);
  return [
    ...notices,
    ...(skipped === undefined ? [] : [{ kind: NOTICE_KIND_REPLICA, text: skipped }]),
  ];
}
