import {
  LOGIN_NOTICE_KIND,
  readLoginNotice,
  refusedLoginReplicas,
  sdkSetting,
  type UploadCredential,
} from "@langchain/plugins-base/auth";
import { toSdkReplicas } from "@langchain/plugins-base/settings";
import { NOTICE_KIND_CREDENTIAL, NOTICE_KIND_REPLICA } from "./constants.js";
import type { Config } from "./models/config.js";
import type { Notice } from "./models/notices.js";
import { engineStorageRoot } from "./tracing-engine.js";

export function loginNotices(home: string, config: Config, credential: UploadCredential): Notice[] {
  if (!config.enabled) return [];
  if (credential.kind === "none") {
    const keyedReplica = config.replicas?.some((replica) => sdkSetting(replica.api_key));
    return keyedReplica ? [] : [{ kind: NOTICE_KIND_CREDENTIAL, text: credential.reason }];
  }
  const saved = readLoginNotice(
    engineStorageRoot(home),
    process.env,
    credential.kind === "api-key" ? (config.api_key ?? credential.apiKey) : undefined,
  );
  const notices = saved === undefined ? [] : [{ kind: LOGIN_NOTICE_KIND, text: saved }];
  if (credential.kind === "api-key") return notices;
  const skipped = refusedLoginReplicas(toSdkReplicas(config.replicas), credential.apiUrl);
  return [
    ...notices,
    ...(skipped === undefined ? [] : [{ kind: NOTICE_KIND_REPLICA, text: skipped }]),
  ];
}
