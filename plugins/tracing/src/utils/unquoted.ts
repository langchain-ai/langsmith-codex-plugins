export function unquoted(key: string): string {
  const quote = key[0];
  const quoted = (quote === '"' || quote === "'") && key.length > 1 && key.endsWith(quote);
  return quoted ? key.slice(1, -1) : key;
}
