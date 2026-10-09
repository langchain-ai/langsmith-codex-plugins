export interface FileLockOwner {
  pid: number;
  token: string;
}

export type FileLockOwnerReadResult =
  | { status: "valid"; owner: FileLockOwner }
  | { status: "missing" }
  | { status: "malformed" }
  | { status: "unsafe" };

export type FileLockRecoveryOwnerState = "live" | "dead" | "unknown";

export type TryFileLockResult<T> = { acquired: false } | { acquired: true; value: T };
