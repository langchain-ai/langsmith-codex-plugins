export function omitKey(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([entry]) => entry !== key));
}
