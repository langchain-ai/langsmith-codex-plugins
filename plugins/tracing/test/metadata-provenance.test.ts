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

describe.each(["usage_metadata", "ls_raw_aggregated_usage"])("muted %s", (key) => {
  it.each([
    {},
    { annotation: "ALLOWED_USAGE_ANNOTATION", empty: {} },
    {
      input_tokens: 2,
      output_tokens: -1,
      total_tokens: Number.POSITIVE_INFINITY,
      costs: { input: 0.25, currency: "USD" },
      input_token_details: { video: { frames: 12, annotation: "estimated" } },
      output_token_details: { new_modality: [1, "annotation", null, false, {}] },
      custom: { nested: { empty: {} } },
    },
  ])("preserves the entire trusted usage object unchanged: %j", (usage) => {
    const metadata = withTrustedMetadata(
      { custom: "PRIVATE_CUSTOM", [key]: { annotation: "PRIVATE_COLLISION" } },
      { [key]: usage, cwd: "PRIVATE_CWD" },
    );
    const projected = metadataForMode(metadata, "metadata");
    expect(projected).toEqual({
      [key]: usage,
      status: "running",
      ls_tracing_mode: "metadata",
    });
    expect(projected?.[key]).toBe(usage);
    expect(metadataForMode({ [key]: usage }, "metadata")).toEqual({
      status: "running",
      ls_tracing_mode: "metadata",
    });
  });

  it.each([undefined, null, [], [{ input_tokens: 2 }], "annotation", 2, false])(
    "rejects non-object or array outer usage: %j",
    (usage) => {
      expect(metadataForMode(withTrustedMetadata({}, { [key]: usage }), "metadata")).toEqual({
        status: "running",
        ls_tracing_mode: "metadata",
      });
    },
  );
});
