export function tracingFailed(error: unknown): string {
  return `LangSmith tracing failed for this turn: ${error}`;
}

export function usage(executableName: string): string {
  return `Usage:
  ${executableName} --version

Options:
  --help, -h     Show this help and exit
  --version, -v  Print the version this build carries and exit`;
}
