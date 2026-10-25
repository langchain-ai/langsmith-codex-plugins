export function silenceWarnings<T>(run: () => T): T {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return run();
  } finally {
    console.warn = warn;
  }
}
