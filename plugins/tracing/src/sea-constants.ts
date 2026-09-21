export const SEA_EXECUTABLE_NAME = "langsmith-codex-tracing";
export const PUBLISHED_PLATFORM = "darwin";
export const PUBLISHED_ARCH = "arm64";

export const DEFAULT_RELEASE_API =
  "https://api.github.com/repos/langchain-ai/langsmith-codex-plugins/releases";
export const RELEASE_DOWNLOAD_PREFIX =
  "https://github.com/langchain-ai/langsmith-codex-plugins/releases/download/";
export const RELEASES_PER_PAGE = 100;

export const INSTALL_DIR_NAME = ".langsmith";
export const LOCK_FILE_NAME = ".update.lock";

export const ABANDONED_LOCK_MS = 10 * 60 * 1000;
export const MAX_BINARY_BYTES = 250 * 1024 * 1024;
export const MAX_CHECKSUM_BYTES = 1024;

export const LIST_TIMEOUT_MS = 15_000;
export const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
export const CODESIGN_TIMEOUT_MS = 120_000;

export const CODEX_PLUGIN_SELECTOR = "tracing@langsmith-codex-plugins";
