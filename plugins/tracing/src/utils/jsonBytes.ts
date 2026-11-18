export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "");
}
