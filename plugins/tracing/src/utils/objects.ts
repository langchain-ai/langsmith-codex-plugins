export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export function stripUndefinedDeep<T>(value: T): T {
  return stripNestedUndefined(value, new WeakMap()) as T;
}

function stripNestedUndefined(value: unknown, copies: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const previous = copies.get(value);
  if (previous) return previous;
  const copy = Object.create(prototype) as Record<PropertyKey, unknown>;
  copies.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (
      typeof key === "string" &&
      descriptor.enumerable &&
      "value" in descriptor &&
      descriptor.value === undefined
    ) {
      continue;
    }
    Object.defineProperty(
      copy,
      key,
      "value" in descriptor
        ? { ...descriptor, value: stripNestedUndefined(descriptor.value, copies) }
        : descriptor,
    );
  }
  return copy;
}
