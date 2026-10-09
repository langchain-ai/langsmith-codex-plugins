import type { Client } from "langsmith";
import * as path from "node:path";
import { v5 as uuidv5 } from "uuid";
import {
  TRACE_RUN_ID_NAMESPACE,
  TRACE_RUN_ID_PREFIX,
  TRACE_UPLOAD_CONFLICT_STATUS,
  TRACE_UPLOAD_DEFAULT_PROJECT,
} from "./constants.js";

export function stableRunId(
  sessionId: string | undefined,
  rolloutFile: string,
  turnKey: string,
  runKey: string,
) {
  return uuidv5(
    `${TRACE_RUN_ID_PREFIX}${sessionId ?? path.resolve(rolloutFile)}:${turnKey}:${runKey}`,
    TRACE_RUN_ID_NAMESPACE,
  );
}

export function trackRunDelivery(client: Client, errors: unknown[]) {
  const createRun = client.createRun.bind(client);
  return new Proxy(client, {
    get(target, property) {
      if (property === "createRun") {
        return async (...args: Parameters<Client["createRun"]>) => {
          const run = args[0];
          const projectName =
            "session_name" in run && typeof run.session_name === "string"
              ? run.session_name
              : typeof run.project_name === "string"
                ? run.project_name
                : TRACE_UPLOAD_DEFAULT_PROJECT;
          try {
            return await createRun(...args);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              error.status === TRACE_UPLOAD_CONFLICT_STATUS
            ) {
              try {
                if (typeof run.id !== "string") throw error;
                const existing = await target.readRun(run.id);
                const project = await target.readProject({ projectName });
                if (
                  existing.id === run.id &&
                  existing.trace_id === run.trace_id &&
                  (existing.parent_run_id ?? undefined) === (run.parent_run_id ?? undefined) &&
                  existing.dotted_order === run.dotted_order &&
                  existing.name === run.name &&
                  existing.run_type === run.run_type &&
                  existing.session_id === project.id
                ) {
                  return;
                }
              } catch {}
            }
            errors.push(error);
            throw error;
          }
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
