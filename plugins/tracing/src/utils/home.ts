import * as os from "node:os";

export function homeDirectory(): string {
  return process.env.HOME ?? os.homedir();
}
