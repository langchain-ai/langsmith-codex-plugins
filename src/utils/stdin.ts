export function readStdin<T>() {
  let buffer = "";
  return new Promise<T>((resolve, reject) => {
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (data) => (buffer += data.toString("utf-8")));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(buffer));
      } catch (error) {
        reject(new Error(`Error parsing hook stdin: ${error.message}`));
      }
    });
    process.stdin.once("error", reject);
  });
}
