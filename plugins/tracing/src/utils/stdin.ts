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
