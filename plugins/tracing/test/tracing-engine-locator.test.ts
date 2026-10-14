import * as path from "node:path";
import { expect, it } from "vitest";
import {
  contextDigestFromRef,
  contextSourceRef,
  reconstructionEventId,
  transcriptPathFromRef,
  transcriptSourceRef,
} from "../src/tracing-engine-locator.js";

const transcript = path.resolve("/work/rollout.jsonl");

it("round-trips an absolute transcript path through its locator", () => {
  expect(transcriptPathFromRef(transcriptSourceRef(transcript))).toBe(transcript);
});

it.each([
  ["a wrong prefix", "other:" + Buffer.from(transcript).toString("base64url")],
  ["a relative path", "codex-transcript:" + Buffer.from("rollout.jsonl").toString("base64url")],
  ["a non-canonical encoding", "codex-transcript:" + Buffer.from(transcript).toString("base64")],
])("rejects a transcript locator with %s", (_name, ref) => {
  expect(() => transcriptPathFromRef(ref)).toThrow(/locator/);
});

it("rejects a context locator whose digest is not a hash", () => {
  expect(() => contextDigestFromRef("codex-context:../../etc/passwd")).toThrow("invalid");
  expect(() => contextDigestFromRef("codex-transcript:" + "a".repeat(64))).toThrow("invalid");
});

it("derives distinct job identities per session, turn and mode, and one digest for both ids", () => {
  const ref = transcriptSourceRef(transcript);
  const ids = [
    reconstructionEventId("s", "t", ref, "full"),
    reconstructionEventId("s", "t", ref, "metadata"),
    reconstructionEventId("s", "u", ref, "full"),
    reconstructionEventId("z", "t", ref, "full"),
  ];
  expect(new Set(ids).size).toBe(4);
  expect(ids[0]).toBe(reconstructionEventId("s", "t", ref, "full"));
  expect(contextDigestFromRef(contextSourceRef("s", "t", ref, "full"))).toBe(
    ids[0].replace("codex-reconstruction:", ""),
  );
});
