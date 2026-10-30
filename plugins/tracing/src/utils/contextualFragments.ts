import type { ResponseItem, TypedSkillFragment } from "../models/rollout.js";
import {
  CONTEXTUAL_USER_FRAGMENTS,
  HOOK_PROMPT_PATTERN,
  QUESTION_REPLY_PATTERN,
  REALTIME_DELEGATION_PATTERN,
  REVIEW_RESULT_PATTERN,
  TYPED_SKILL_FRAGMENT,
  TYPED_SKILL_NAME,
  USER_SHELL_COMMAND_PATTERN,
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
  const action = REVIEW_RESULT_PATTERN.exec(text)?.[1];
  if (action != null) return `/${action.trim()}`;
  const shell = USER_SHELL_COMMAND_PATTERN.exec(text);
  if (shell != null) return `${shell[1]}\n\n${shell[2]}`;
  const escaped =
    HOOK_PROMPT_PATTERN.exec(text)?.[1] ?? REALTIME_DELEGATION_PATTERN.exec(text)?.[1];
  return escaped?.replace(XML_ENTITY_PATTERN, (entity) => XML_ENTITIES[entity] ?? entity);
}

function unwrapPart(part: Record<string, unknown>): Record<string, unknown> {
  if (part.type !== "input_text" || typeof part.text !== "string") return part;
  const text = unwrappedText(part.text.trim());
  return text == null ? part : { ...part, text };
}

export function typedSkillFragments(item: ResponseItem): TypedSkillFragment[] {
  if (item.type !== "message" || item.role !== "user") return [];
  return item.content.flatMap((part) => {
    if (typeof part.text !== "string") return [];
    const [, name, path] = TYPED_SKILL_FRAGMENT.exec(part.text.trim()) ?? [];
    return name != null && TYPED_SKILL_NAME.test(name) ? [{ name, path }] : [];
  });
}

export function isReviewResult(item: ResponseItem): boolean {
  return (
    item.type === "message" &&
    item.role === "user" &&
    item.content.some(
      (part) => typeof part.text === "string" && REVIEW_RESULT_PATTERN.test(part.text.trim()),
    )
  );
}

export function withoutCodexMarkup(item: ResponseItem): ResponseItem | undefined {
  if (item.type !== "message" || item.role !== "user") return item;
  const content = item.content.filter((part) => !isContextualFragment(part)).map(unwrapPart);
  return content.length > 0 || item.content.length === 0 ? { ...item, content } : undefined;
}
