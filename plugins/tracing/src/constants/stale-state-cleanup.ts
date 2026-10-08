export const STALE_PLUGIN_TTL_MS = 24 * 60 * 60 * 1000;
export const STALE_PLUGIN_TOPOLOGY_TEMP_PATTERN =
  /^(.+\.jsonl)\.langsmith-topology-[a-f0-9]{64}\.json\.[a-f0-9-]{36}\.tmp$/;
export const STALE_PLUGIN_INCREMENTAL_TEMP_PATTERN =
  /^(.+\.jsonl)\.langsmith-incremental-[a-f0-9]{64}\.json\.[a-f0-9-]{36}\.tmp$/;
export const STALE_PLUGIN_STATE_PATTERN = /^(.+\.jsonl)\.langsmith$/;
export const STALE_PLUGIN_TOPOLOGY_PATTERN = /^(.+\.jsonl)\.langsmith-topology-[a-f0-9]{64}\.json$/;
export const STALE_PLUGIN_INCREMENTAL_PATTERN =
  /^(.+\.jsonl)\.langsmith-incremental-[a-f0-9]{64}\.json$/;
export const STALE_PLUGIN_INCREMENTAL_LOCK_PATTERN =
  /^(.+\.jsonl)\.langsmith-incremental-[a-f0-9]{64}\.json\.lock$/;
export const STALE_PLUGIN_LOCK_RECOVERY_PATTERN =
  /^(.+\.jsonl)(\.langsmith\.lock|\.langsmith-capture\.lock|\.langsmith-incremental-[a-f0-9]{64}\.json\.lock)\.recover-[0-9]+$/;
export const STALE_PLUGIN_CAPTURE_PATTERN = /^(.+\.jsonl)\.langsmith-capture-[a-f0-9]{64}$/;
export const STALE_PLUGIN_UUID_PATTERN =
  /^rollout-.+-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl(?:\.zst)?$/;
export const STALE_PLUGIN_NATIVE_ROLLOUT_PATTERN = /^rollout-.+\.jsonl(?:\.zst)?$/;
export const STALE_PLUGIN_NATIVE_LOCK_PATTERN =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.lock$/;
export const STALE_PLUGIN_COMPRESSED_SUFFIX_PATTERN = /\.zst$/;

export const STALE_PRIVACY_TEMP_PATTERN = /^(\d+)\.[a-f0-9-]{36}\.tmp$/;
export const CODEX_SESSIONS_DIRECTORY = "sessions";
export const CODEX_WRITER_LOCKS_DIRECTORY = "thread-writer-locks";
