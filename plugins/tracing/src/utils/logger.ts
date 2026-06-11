import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function debugLog(...args: unknown[]): void {
  const homeDir = process.env.HOME ?? os.homedir();

  fs.appendFileSync(
    path.resolve(homeDir, ".codex", "langsmith.log"),
    args
      .map((arg) => {
        if (
          typeof arg === "string" ||
          typeof arg === "number" ||
          typeof arg === "boolean" ||
          arg === null
        ) {
          return String(arg);
        }

        if (typeof arg === "undefined") return "undefined";
        return JSON.stringify(arg);
      })
      .join(" ") + "\n",
  );
}
