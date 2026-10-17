import {
  MODE_FULL,
  MODE_METADATA,
  MODE_OFF,
  POLICY_INVALID_MESSAGE,
  POLICY_THREAD_KEYS,
  POLICY_TOP_LEVEL_KEYS,
  POLICY_VERSION,
} from "../../constants.js";
import type { TracingMode, TracingPolicy, TurnMode } from "../../models/tracing-policy.js";
import { isRecord } from "../isRecord.js";

function isMode(value: unknown): value is TracingMode {
  return value === MODE_FULL || value === MODE_METADATA;
}

function isTurnMode(value: unknown): value is TurnMode {
  return isMode(value) || value === MODE_OFF;
}

function validThread(value: unknown): boolean {
  return (
    isRecord(value) &&
    (!Object.hasOwn(value, "preference") || isMode(value.preference)) &&
    isRecord(value.turns) &&
    Object.values(value.turns).every(isTurnMode) &&
    (value.inherited === undefined || isTurnMode(value.inherited)) &&
    Object.keys(value).every((key) => POLICY_THREAD_KEYS.includes(key))
  );
}

export function parsePolicy(value: unknown): TracingPolicy {
  if (
    !isRecord(value) ||
    value.version !== POLICY_VERSION ||
    !isRecord(value.threads) ||
    Object.values(value.threads).some((thread) => !validThread(thread)) ||
    Object.keys(value).some((key) => !POLICY_TOP_LEVEL_KEYS.includes(key))
  ) {
    throw new Error(POLICY_INVALID_MESSAGE);
  }
  return value as unknown as TracingPolicy;
}
