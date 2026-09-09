import { describe, expect, it } from "vitest";
import { trustedCodingAgentMetadata, withTrustedMetadata } from "../src/metadata.js";
import { metadataForMode } from "../src/privacy.js";

describe("trusted metadata provenance", () => {
  it("keeps provenance non-enumerable and out of serialized metadata", () => {
    const metadata = withTrustedMetadata({ custom: "private" }, { thread_id: "thread" });
    const symbols = Object.getOwnPropertySymbols(metadata);
    expect(symbols).toHaveLength(1);
    expect(Object.getOwnPropertyDescriptor(metadata, symbols[0]!)?.enumerable).toBe(false);
    expect(Object.keys(metadata)).toEqual(["custom", "thread_id"]);
    expect(JSON.parse(JSON.stringify(metadata))).toEqual({
      custom: "private",
      thread_id: "thread",
    });
    expect(trustedCodingAgentMetadata(metadata)).toEqual({ thread_id: "thread" });
    expect(trustedCodingAgentMetadata({ ...metadata })).toBeUndefined();
    expect(trustedCodingAgentMetadata(JSON.parse(JSON.stringify(metadata)))).toBeUndefined();
    expect(trustedCodingAgentMetadata(undefined)).toBeUndefined();
  });

  it("does not trust custom collisions or later merged-object mutations", () => {
    const structural = { thread_id: "thread" };
    const metadata = withTrustedMetadata({ ls_model_name: "private" }, structural);
    structural.thread_id = "changed";
    metadata.thread_id = "private";
    expect(metadataForMode(metadata, "metadata")).toEqual({
      thread_id: "thread",
      status: "running",
      ls_tracing_mode: "metadata",
    });
    expect(metadataForMode({ ...metadata }, "metadata")).toEqual({
      status: "running",
      ls_tracing_mode: "metadata",
    });
    expect(metadataForMode(metadata, "full")).toBe(metadata);
  });
});
