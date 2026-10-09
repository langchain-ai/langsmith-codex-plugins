import { createHash } from "node:crypto";
import { asRecord } from "./objects.js";

export function copyExtraThroughJson<T extends { extra?: unknown }>(run: T): T {
  const copy = { ...run };
  const extra = run.extra;
  if (extra != null && typeof extra === "object") {
    const serialized = JSON.stringify(extra);
    if (serialized === undefined) delete copy.extra;
    else copy.extra = JSON.parse(serialized);
  }
  return copy;
}

export function sortedJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
    .join(",")}}`;
}

export function digestFor(value: unknown) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error("Incremental delivery payload is not serializable");
  return createHash("sha256")
    .update(sortedJson(JSON.parse(json)))
    .digest("hex");
}

export function containsExpected(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (Array.isArray(expected))
    return Array.isArray(actual) && digestFor(actual) === digestFor(expected);
  const record = asRecord(actual);
  return Object.entries(expected).every(([key, value]) => containsExpected(record[key], value));
}
