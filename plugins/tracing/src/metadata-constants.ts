export const GIT_COMMAND_TIMEOUT_MS = 2000;
export const GIT_LOCATION_ENV_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_CEILING_DIRECTORIES",
];

export const TOOL_WORKING_DIRECTORY_KEYS = ["cwd", "workdir"] as const;
export const TOOL_PATH_KEYS = ["file_path", "notebook_path", "path"] as const;
export const REPOSITORY_METADATA_KEYS = [
  "repository_url",
  "repository_provider",
  "repository_name",
  "git_branch",
  "git_commit_sha",
  "ls_attribution_identifier",
] as const;
export const GITHUB_HOSTS_FILE = "hosts.yml";
export const GITHUB_CONFIG_DIRECTORY = ".config/gh";
export const GITHUB_CONFIG_ENV = "GH_CONFIG_DIR";
export const GITHUB_HOST_NAME = "github.com";
export const GITHUB_HOST_ENTRY = /^([^\s:#][^:]*):\s*(?:#.*)?$/;
export const GITHUB_USER_ENTRY = /^\s+user:\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))\s*(?:#.*)?$/;
export const GIT_SCP_REMOTE = /^[^/@]+@([^:/]+):(.+)$/;
export const GIT_SUFFIX = /\.git$/;
