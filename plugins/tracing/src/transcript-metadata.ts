import { constants as fsConstants } from "node:fs";
import * as fs from "node:fs/promises";
import {
  SESSION_META_READ_CHUNK_BYTES,
  SESSION_META_READ_MAX_BYTES,
} from "./constants/transcript-metadata.js";
import type { SessionMetaLine } from "./types.js";
import { isRecord } from "./utils/objects.js";

export async function readTranscriptSessionMetadata(
  file: string,
): Promise<SessionMetaLine | undefined> {
  const handle = await fs.open(
    file,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_NONBLOCK ?? 0),
  );
  try {
    if (!(await handle.stat()).isFile()) throw new Error("Transcript is not a regular file");
    const buffer = Buffer.alloc(SESSION_META_READ_MAX_BYTES + 1);
    let length = 0;
    let lineStart = 0;
    while (length < buffer.length) {
      const size = Math.min(SESSION_META_READ_CHUNK_BYTES, buffer.length - length);
      const { bytesRead } = await handle.read(buffer, length, size, length);
      if (bytesRead === 0) break;
      length += bytesRead;
      let relativeEnd = buffer.subarray(lineStart, length).indexOf(0x0a);
      let end = relativeEnd < 0 ? -1 : lineStart + relativeEnd;
      while (end >= 0) {
        if (end >= SESSION_META_READ_MAX_BYTES) {
          throw new Error("Transcript session metadata exceeds its size limit");
        }
        const metadata = parseSessionMetadata(buffer.toString("utf8", lineStart, end));
        if (metadata) return metadata;
        lineStart = end + 1;
        relativeEnd = buffer.subarray(lineStart, length).indexOf(0x0a);
        end = relativeEnd < 0 ? -1 : lineStart + relativeEnd;
      }
      if (length > SESSION_META_READ_MAX_BYTES) {
        throw new Error("Transcript session metadata exceeds its size limit");
      }
    }
    if (lineStart >= length) return undefined;
    return parseSessionMetadata(buffer.toString("utf8", lineStart, length));
  } finally {
    await handle.close();
  }
}

function parseSessionMetadata(line: string): SessionMetaLine | undefined {
  if (!line.trim()) return undefined;
  return sessionMetadata(JSON.parse(line));
}

function sessionMetadata(value: unknown): SessionMetaLine | undefined {
  if (!isRecord(value) || value.type !== "session_meta") return undefined;
  if (!isRecord(value.payload)) throw new Error("Transcript session metadata is invalid");
  return value as unknown as SessionMetaLine;
}
