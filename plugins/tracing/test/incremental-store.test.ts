import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { withIncrementalDeliveryCheckpoint } from "../src/incremental-delivery-store.js";
import { INCREMENTAL_DELIVERY_MAX_BYTES } from "../src/constants/incremental-delivery.js";

it("rejects oversized incremental state without replacing the retry evidence", async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "incremental-store-bounds-"));
  const rollout = path.join(directory, "rollout.jsonl");
  const identity = { endpoint: "http://localhost", projectName: "test", runId: "run" };
  try {
    await withIncrementalDeliveryCheckpoint(rollout, "turn", identity, async (store) => {
      await store.save({
        ...identity,
        createAttempted: true,
        topology: { parentRunId: null, startTime: 1, name: "tool", runType: "tool" },
      });
      const filename = (await fs.readdir(directory)).find((name) => name.endsWith(".json"))!;
      const file = path.join(directory, filename);
      const original = " ".repeat(INCREMENTAL_DELIVERY_MAX_BYTES + 1);
      await fs.writeFile(file, original);
      await expect(store.load()).rejects.toThrow("exceeds its size limit");
      expect(await fs.readFile(file, "utf8")).toBe(original);
    });
  } finally {
    for (const filename of await fs.readdir(directory))
      await fs.unlink(path.join(directory, filename));
    await fs.rmdir(directory);
  }
});
