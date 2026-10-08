import type { AggregateMessage, ResponseItem, StandardMessage } from "../types.js";

export function convertToStandardMessages(messages: AggregateMessage<ResponseItem>[]) {
  return messages.map(({ message, ...rest }): AggregateMessage<StandardMessage> => {
    if (message.type === "message") {
      const role = (() => {
        if (message.role === "developer") return "system";
        if (message.role === "assistant") return "ai";
        return message.role;
      })();

      const content = message.content.map((c) => {
        if (c.type === "input_text") return { type: "text", text: c.text };

        if (c.type === "output_text") return { type: "text", text: c.text };

        if (c.type === "text") {
          return { type: "text", text: c.text };
        }

        if (c.type === "input_image") {
          return {
            type: "image_url",
            image_url: c.image_url,
          };
        }

        return { type: "non_standard", value: c };
      });

      return { message: { role, content }, ...rest };
    }

    if (message.type === "function_call") {
      const name = message.name;
      const id = message.call_id;
      const args = message.arguments;

      try {
        return {
          message: {
            role: "ai",
            content: [{ type: "tool_call", name, id, args: JSON.parse(args) }],
          },
          ...rest,
        };
      } catch {
        return {
          message: {
            role: "ai",
            content: [{ type: "tool_call_chunk", name, id, args }],
          },
          ...rest,
        };
      }
    }

    if (message.type === "function_call_output") {
      const text =
        typeof message.output === "string" ? message.output : JSON.stringify(message.output);

      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "custom_tool_call") {
      const name = message.name;
      const id = message.call_id;

      return {
        message: {
          role: "ai",
          content: [{ type: "tool_call", name, id, args: message.input }],
        },
        ...rest,
      };
    }

    if (message.type === "custom_tool_call_output") {
      const text =
        typeof message.output === "string" ? message.output : JSON.stringify(message.output);

      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "tool_search_call") {
      return {
        message: {
          role: "ai",
          content: [
            {
              type: "tool_call",
              name: message.type,
              id: message.call_id,
              args: message.arguments,
            },
          ],
        },
        ...rest,
      };
    }

    if (message.type === "tool_search_output") {
      const text = JSON.stringify(message.tools);
      return {
        message: {
          role: "tool",
          content: [{ type: "text", text }],
          tool_call_id: message.call_id,
        },
        ...rest,
      };
    }

    if (message.type === "reasoning") {
      // Only include reasoning if it has non-encrypted content
      const { type: _, content: reasoningRaw, ...extras } = message;

      const reasoning = message.content
        ? typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content)
        : undefined;

      return {
        message: {
          role: "ai",
          content: [{ type: "reasoning", reasoning, extras }],
        },
        ...rest,
      };
    }

    return {
      message: {
        role: "unknown",
        content: [{ type: "non_standard", value: message }],
        _raw: message,
      },
      ...rest,
    };
  });
}
