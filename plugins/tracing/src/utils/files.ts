import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PrivateFileWriteOptions } from "../models/files.js";

export async function writePrivateFile(
  file: string,
  value: string,
  options: PrivateFileWriteOptions = {},
) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(value, "utf8");
      if (options.sync) await handle.sync();
    } finally {
      await handle.close();
    }
    if (options.firstWriteWins) {
      try {
        await fs.link(temporary, file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    } else {
      await fs.rename(temporary, file);
    }
  } finally {
    await fs.unlink(temporary).catch(ignoreMissingFile);
  }
}

export async function readBoundedText(file: string, maxBytes: number): Promise<string> {
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw new Error("File exceeds its size limit");
    return buffer.toString("utf8", 0, length);
  } finally {
    await handle.close();
  }
}

export function ignoreMissingFile(error: unknown): undefined {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
