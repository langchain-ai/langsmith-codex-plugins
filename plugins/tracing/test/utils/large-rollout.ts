import { rolloutText } from "./rollout.js";

/** Synthetic fan-out: one model call followed by many independently captured tools. */
export function largeRollout(toolCount: number): string[] {
  const rows = rolloutText("thread-1", ["turn-1"]).split("\n");
  const usage = {
    input_tokens: 100,
    cached_input_tokens: 20,
    output_tokens: 40,
    reasoning_output_tokens: 10,
    total_tokens: 140,
  };
  const event = (payload: Record<string, unknown>, type = "response_item") =>
    JSON.stringify({ timestamp: "2026-04-23T00:00:01.000Z", type, payload });
  return [
    ...rows.slice(0, 4),
    ...Array.from({ length: toolCount }, (_, index) =>
      event({
        type: "function_call",
        name: "exec_command",
        call_id: `call_${index}`,
        arguments: JSON.stringify({ cmd: `echo synthetic-${index}` }),
      }),
    ),
    ...Array.from({ length: toolCount }, (_, index) =>
      event({
        type: "function_call_output",
        call_id: `call_${index}`,
        output: `synthetic-result-${index}`,
      }),
    ),
    event(
      {
        type: "token_count",
        info: {
          total_token_usage: usage,
          last_token_usage: usage,
        },
      },
      "event_msg",
    ),
    ...rows.slice(4),
  ];
}
