import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CODEX_PLUGIN_SELECTOR } from "./binary-constants.ts";

const PLUGIN_TABLE = /^\[\s*plugins\s*\.\s*(.+?)\s*\]\s*(?:#.*)?$/;
const ENABLED_KEY = /^enabled\s*=\s*(true|false)\s*(?:#.*)?$/;

function unquoted(key: string): string {
  const quote = key[0];
  const quoted = (quote === '"' || quote === "'") && key.length > 1 && key.endsWith(quote);
  return quoted ? key.slice(1, -1) : key;
}

export function pluginEnabledInToml(toml: string): boolean | undefined {
  let inOurTable = false;
  for (const raw of toml.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      const table = PLUGIN_TABLE.exec(line);
      inOurTable = table !== null && unquoted(table[1]) === CODEX_PLUGIN_SELECTOR;
      continue;
    }
    if (!inOurTable) continue;
    const enabled = ENABLED_KEY.exec(line);
    if (enabled) return enabled[1] === "true";
  }
  return undefined;
}

export function defaultConfigFile(projectScoped: boolean): string {
  if (projectScoped) return path.join(process.cwd(), ".codex", "config.toml");
  return path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml");
}

async function pluginEnabledIn(configFile: string): Promise<boolean | undefined> {
  try {
    return pluginEnabledInToml(await fs.readFile(configFile, "utf-8"));
  } catch {
    return undefined;
  }
}

export async function codexPluginEnabled(): Promise<boolean> {
  const projectConfig = defaultConfigFile(true);
  const userConfig = defaultConfigFile(false);
  for (const configFile of [projectConfig, userConfig]) {
    const enabled = await pluginEnabledIn(configFile);
    if (enabled !== undefined) return enabled;
  }
  return false;
}

export async function standDownNotice(): Promise<string[]> {
  if (!(await codexPluginEnabled())) return [];
  return [
    "",
    "LangSmith tracing is now installed twice, once as a Codex plugin and once as",
    "this binary. Only the binary traces. The plugin still starts on every hook,",
    "so remove it with:",
    `  codex plugin remove ${CODEX_PLUGIN_SELECTOR}`,
  ];
}

export async function printStandDownNotice(
  log: (line: string) => void = console.log,
): Promise<void> {
  try {
    for (const line of await standDownNotice()) log(line);
  } catch {
    return;
  }
}
