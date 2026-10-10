import { describe, expect, it } from "vitest";
import { trustedCodingAgentMetadata } from "@langchain/plugins-base/metadata";
import { metadataFixture } from "./utils/metadata.js";
import { METADATA_FIXTURE_IDENTITY } from "./utils/metadata-constants.js";
import { metadataForMode } from "../src/privacy.js";

describe("trusted metadata provenance", () => {
  it("keeps provenance non-enumerable and out of serialized metadata", () => {
    const metadata = metadataFixture({ custom: "private" }, { thread_id: "thread" });
    const symbols = Object.getOwnPropertySymbols(metadata);
    expect(symbols).toHaveLength(1);
    expect(Object.getOwnPropertyDescriptor(metadata, symbols[0]!)?.enumerable).toBe(false);
    expect(Object.keys(metadata).sort()).toEqual(
      ["custom", ...Object.keys(METADATA_FIXTURE_IDENTITY)].sort(),
    );
    expect(JSON.parse(JSON.stringify(metadata))).toEqual({
      custom: "private",
      ...METADATA_FIXTURE_IDENTITY,
    });
    expect(trustedCodingAgentMetadata(metadata)).toEqual(METADATA_FIXTURE_IDENTITY);
    expect(trustedCodingAgentMetadata({ ...metadata })).toBeUndefined();
    expect(trustedCodingAgentMetadata(JSON.parse(JSON.stringify(metadata)))).toBeUndefined();
    expect(trustedCodingAgentMetadata(undefined)).toBeUndefined();
  });

  it("does not trust custom collisions or later merged-object mutations", () => {
    const structural = { thread_id: "thread" };
    const metadata = metadataFixture({ ls_model_name: "private" }, structural);
    structural.thread_id = "changed";
    metadata.thread_id = "private";
    expect(metadataForMode(metadata, "metadata")).toEqual({
      ...METADATA_FIXTURE_IDENTITY,
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
    const metadata = metadataFixture(
      { custom: "PRIVATE_CUSTOM", [key]: { annotation: "PRIVATE_COLLISION" } },
      { [key]: usage, cwd: "PRIVATE_CWD" },
    );
    const projected = metadataForMode(metadata, "metadata");
    expect(projected).toEqual({
      ...METADATA_FIXTURE_IDENTITY,
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
      expect(metadataForMode(metadataFixture({}, { [key]: usage }), "metadata")).toEqual({
        ...METADATA_FIXTURE_IDENTITY,
        status: "running",
        ls_tracing_mode: "metadata",
      });
    },
  );
});
