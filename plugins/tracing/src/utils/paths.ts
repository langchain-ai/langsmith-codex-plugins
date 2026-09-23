import * as os from "node:os";
import * as path from "node:path";

export function underHome(target: string, home = os.homedir()): string {
  if (target === home) return "~";
  return target.startsWith(`${home}${path.sep}`)
    ? `~${path.sep}${target.slice(home.length + 1)}`
    : target;
}

export function codexFile(filename: string, projectScoped: boolean): string {
  if (projectScoped) return path.join(process.cwd(), ".codex", filename);
  return path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), filename);
}
