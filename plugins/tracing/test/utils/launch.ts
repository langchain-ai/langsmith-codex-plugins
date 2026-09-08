import { vol } from "memfs";
import { defaultPrivacyPath } from "../../src/tracing-policy.js";

export function seedFullLaunchEvidence() {
  const threads: Record<string, { preference: string; turns: Record<string, string> }> = {};
  for (const [file, content] of Object.entries(vol.toJSON())) {
    if (!file.endsWith(".jsonl") || !content) continue;
    const events = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const id = events.find((event) => event.type === "session_meta")?.payload.id;
    if (!id) continue;
    const turns = Object.fromEntries(
      events
        .filter((event) => event.type === "event_msg" && event.payload.turn_id)
        .map((event) => [event.payload.turn_id, "full"]),
    );
    threads[id] = { preference: "full", turns };
  }
  vol.fromJSON({ [defaultPrivacyPath()]: JSON.stringify({ version: 1, threads }) });
}
