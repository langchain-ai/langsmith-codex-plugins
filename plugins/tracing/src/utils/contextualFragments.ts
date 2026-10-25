import type { ResponseItem } from "../models/rollout.js";
import {
  CONTEXTUAL_USER_FRAGMENTS,
  HOOK_PROMPT_PATTERN,
  QUESTION_REPLY_PATTERN,
  XML_ENTITIES,
  XML_ENTITY_PATTERN,
} from "../constants.js";
import { isRecord } from "./isRecord.js";

function isContextualFragment(part: Record<string, unknown>): boolean {
  if (part.type !== "input_text" || typeof part.text !== "string") return false;
  const text = part.text.trim();
  return CONTEXTUAL_USER_FRAGMENTS.some((pattern) => pattern.test(text));
}

function questionReplyText(body: string): string | undefined {
  try {
    const replies: unknown = JSON.parse(body);
    if (!Array.isArray(replies) || replies.length === 0) return undefined;
    const texts = replies.map((reply) => {
      if (!isRecord(reply) || typeof reply.answer !== "string") return undefined;
      const question = typeof reply.question === "string" ? reply.question : "";
      return question ? `> ${question}\n\n${reply.answer}` : reply.answer;
    });
    return texts.every((text) => text != null) ? texts.join("\n\n") : undefined;
  } catch {
    return undefined;
  }
}

function unwrappedText(text: string): string | undefined {
  const reply = QUESTION_REPLY_PATTERN.exec(text)?.[1];
  if (reply != null) return questionReplyText(reply);
  const hook = HOOK_PROMPT_PATTERN.exec(text)?.[1];
  return hook?.replace(XML_ENTITY_PATTERN, (entity) => XML_ENTITIES[entity] ?? entity);
}

function unwrapPart(part: Record<string, unknown>): Record<string, unknown> {
  if (part.type !== "input_text" || typeof part.text !== "string") return part;
  const text = unwrappedText(part.text.trim());
  return text == null ? part : { ...part, text };
}

export function withoutCodexMarkup(item: ResponseItem): ResponseItem | undefined {
  if (item.type !== "message" || item.role !== "user") return item;
  const content = item.content.filter((part) => !isContextualFragment(part)).map(unwrapPart);
  return content.length > 0 || item.content.length === 0 ? { ...item, content } : undefined;
}
