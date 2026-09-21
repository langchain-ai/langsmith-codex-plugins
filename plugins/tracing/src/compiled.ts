const BUNFS_PREFIX = "/$bunfs/";

export function runningCompiledBinary(): boolean {
  const main = (globalThis as { Bun?: { main?: unknown } }).Bun?.main;
  return typeof main === "string" && main.startsWith(BUNFS_PREFIX);
}
