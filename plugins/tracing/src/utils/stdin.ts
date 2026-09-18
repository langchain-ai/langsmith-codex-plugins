export const DRAIN_TIMEOUT_MS = 2_000;

export function drainStdin(timeoutMs = DRAIN_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(timer);
      process.stdin.pause();
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    process.stdin.once("end", finish);
    process.stdin.once("error", finish);
    process.stdin.resume();
  });
}

export function readStdin<T>() {
  let buffer = "";
  return new Promise<T>((resolve, reject) => {
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (data) => (buffer += data.toString("utf-8")));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(buffer));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reject(new Error(`Error parsing hook stdin: ${errorMessage}`));
      }
    });
    process.stdin.once("error", reject);
  });
}
