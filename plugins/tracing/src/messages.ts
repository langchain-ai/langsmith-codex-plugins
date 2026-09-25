import { binary } from "./binary.ts";
import { PLATFORM_NAMES } from "./constants.ts";

function publishedHosts(): string {
  return Object.entries(binary.target.publishedTargets)
    .map(([platform, arches]) => `${PLATFORM_NAMES[platform] ?? platform} ${arches.join(" and ")}`)
    .join(", ");
}

export function unsupportedHost(platform: string, arch: string): string {
  return `The standalone binary only runs on ${publishedHosts()}, not ${platform}-${arch}. Use the Codex plugin instead.`;
}

export function standaloneBinaryWarning(installedPath: string): string {
  return `LangSmith tracing: the standalone binary at ${installedPath} is still registered in ~/.codex/hooks.json, so it is doing the tracing and the plugin is standing aside. Delete that file and drop its entries to let the plugin take over. You only see this once.`;
}

export function usage(executableName: string): string {
  return `Usage:
  ${executableName} --install [--project] [--tag VERSION]
  ${executableName} --print [--project]
  ${executableName} --update
  ${executableName} --version

Options:
  --help, -h     Show this help and exit
  --version, -v  Print the installed version and exit
  --install      Install this binary and register the Codex hooks
  --print        Print the hooks file --install would write, and change nothing
  --project      Use .codex/hooks.json in the current directory
  --tag VERSION  Install a published release instead of this binary
  --update       Replace the installed binary with the newest release`;
}
