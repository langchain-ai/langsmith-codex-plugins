export function quoteForShell(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`;
}
