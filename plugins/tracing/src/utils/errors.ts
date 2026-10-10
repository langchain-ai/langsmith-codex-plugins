import { FileLockTimeoutError } from "@langchain/plugins-base/storage";

export function hasFileLockTimeoutError(error: unknown): boolean {
  if (error instanceof FileLockTimeoutError) return true;
  return error instanceof AggregateError && error.errors.some(hasFileLockTimeoutError);
}
