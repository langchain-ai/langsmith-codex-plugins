import { KNOWN_FLAGS } from "../constants.ts";

export function wasInvokedWith(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function unknownFlags(argv: string[]): string[] {
  return argv.filter((arg) => arg.startsWith("-") && !KNOWN_FLAGS.has(arg));
}
