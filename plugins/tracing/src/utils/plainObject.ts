export function toPlainObject<T extends object = Record<string, unknown>>(value: object): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
