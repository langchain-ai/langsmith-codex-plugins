import * as fs from "node:fs/promises";
import * as path from "node:path";

async function existingMode(target: string): Promise<number | undefined> {
  try {
    return (await fs.stat(target)).mode & 0o777;
  } catch {
    return undefined;
  }
}

export async function writeFileAtomic(target: string, contents: string): Promise<void> {
  const directory = path.dirname(target);
  const partial = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`);
  const mode = await existingMode(target);
  try {
    await fs.writeFile(partial, contents);
    if (mode !== undefined) await fs.chmod(partial, mode);
    await fs.rename(partial, target);
  } catch (error) {
    await fs.unlink(partial).catch(() => undefined);
    throw error;
  }
}
