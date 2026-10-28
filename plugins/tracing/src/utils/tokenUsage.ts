import type { TokenCount } from "../models/rollout.js";

export function usageSince(
  total: TokenCount | undefined,
  start: TokenCount | undefined,
): TokenCount | undefined {
  if (total == null || start == null) return total;
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [
      key,
      typeof value === "number" ? value - (start[key as keyof TokenCount] ?? 0) : value,
    ]),
  );
}
