export function rolloutText(sessionId: string, turnIds: string[]): string {
  const event = (type: string, payload: Record<string, unknown>) => ({
    timestamp: "2026-04-23T00:00:01.000Z",
    type,
    payload,
  });
  return [
    event("session_meta", {
      id: sessionId,
      source: "cli",
      model_provider: "test",
      cli_version: "0.153.4",
    }),
    ...turnIds.flatMap((turnId) => [
      event("event_msg", { type: "task_started", turn_id: turnId }),
      event("turn_context", { turn_id: turnId, model: "test-model" }),
      event("response_item", {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "PRIVATE_BODY ACME-123" }],
      }),
      event("response_item", {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "PRIVATE_BODY ACME-456" }],
      }),
      event("event_msg", { type: "turn_complete", turn_id: turnId }),
    ]),
  ]
    .map((line) => JSON.stringify(line))
    .join("\n");
}
