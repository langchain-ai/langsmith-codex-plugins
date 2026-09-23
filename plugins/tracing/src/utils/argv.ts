import { KNOWN_FLAGS } from "../constants.ts";

export function flagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  const value = index < 0 ? undefined : argv[index + 1];
  return value === undefined || value.startsWith("-") ? undefined : value;
}

export function wasInvokedWith(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function unknownFlags(argv: string[]): string[] {
  return argv.filter((arg) => arg.startsWith("-") && !KNOWN_FLAGS.has(arg));
}
