import { createHash } from "node:crypto";
import * as path from "node:path";
import {
  CONTEXT_DIGEST_PATTERN,
  CONTEXT_LOCATOR_PREFIX,
  RECONSTRUCTION_EVENT_PREFIX,
  TRANSCRIPT_LOCATOR_PREFIX,
} from "./constants.js";
import type { TracingMode } from "./models/tracing-policy.js";

export function transcriptSourceRef(transcriptPath: string): string {
  return `${TRANSCRIPT_LOCATOR_PREFIX}${Buffer.from(path.resolve(transcriptPath)).toString("base64url")}`;
}

export function transcriptPathFromRef(sourceRef: string): string {
  if (!sourceRef.startsWith(TRANSCRIPT_LOCATOR_PREFIX)) {
    throw new Error("Codex reconstruction source is not a transcript locator");
  }
  const value = Buffer.from(
    sourceRef.slice(TRANSCRIPT_LOCATOR_PREFIX.length),
    "base64url",
  ).toString("utf8");
  if (!path.isAbsolute(value) || transcriptSourceRef(value) !== sourceRef) {
    throw new Error("Codex transcript locator is invalid");
  }
  return value;
}

function reconstructionDigest(
  sessionId: string,
  turnId: string,
  sourceRef: string,
  mode: TracingMode,
): string {
  return createHash("sha256")
    .update(JSON.stringify([sessionId, turnId, sourceRef, mode]))
    .digest("hex");
}

export function reconstructionEventId(
  sessionId: string,
  turnId: string,
  sourceRef: string,
  mode: TracingMode,
): string {
  return `${RECONSTRUCTION_EVENT_PREFIX}${reconstructionDigest(sessionId, turnId, sourceRef, mode)}`;
}

export function contextSourceRef(
  sessionId: string,
  turnId: string,
  sourceRef: string,
  mode: TracingMode,
): string {
  return `${CONTEXT_LOCATOR_PREFIX}${reconstructionDigest(sessionId, turnId, sourceRef, mode)}`;
}

export function contextDigestFromRef(contextRef: string): string {
  const digest = contextRef.startsWith(CONTEXT_LOCATOR_PREFIX)
    ? contextRef.slice(CONTEXT_LOCATOR_PREFIX.length)
    : "";
  if (!CONTEXT_DIGEST_PATTERN.test(digest)) {
    throw new Error("Codex reconstruction context locator is invalid");
  }
  return digest;
}
