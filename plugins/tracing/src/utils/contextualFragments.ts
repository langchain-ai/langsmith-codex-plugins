import type { ResponseItem } from "../models/rollout.js";
import { CONTEXTUAL_USER_FRAGMENTS } from "../constants.js";

function isContextualFragment(part: Record<string, unknown>): boolean {
  if (part.type !== "input_text" || typeof part.text !== "string") return false;
  const text = part.text.trim();
  return CONTEXTUAL_USER_FRAGMENTS.some((pattern) => pattern.test(text));
}

export function withoutContextualFragments(item: ResponseItem): ResponseItem | undefined {
  if (item.type !== "message" || item.role !== "user") return item;
  const content = item.content.filter((part) => !isContextualFragment(part));
  if (content.length === item.content.length) return item;
  return content.length > 0 ? { ...item, content } : undefined;
}
