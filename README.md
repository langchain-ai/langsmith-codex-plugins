# LangSmith Tracing Plugin for OpenAI Codex

A Codex plugin that traces agent turns, tool calls, model metadata, and subagent threads to [LangSmith](https://smith.langchain.com).

## Prerequisites

- Node.js >= 22.x
- Codex >= 0.128
- A LangSmith account and API key

## Installation

### As a Codex plugin

Add the marketplace via Codex CLI:

```bash
codex plugin marketplace add langchain-ai/langsmith-codex-plugins
```

Then enable plugin hooks and the Tracing plugin globally in `~/.codex/config.toml` or only for a specific project in `.codex/config.toml`:

```toml
[features]
plugin_hooks = true

[plugins."tracing@langsmith-codex-plugins"]
enabled = true
```

### Setting environment variables

**Option 1: Shell environment (recommended)**

Add to your `~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`:

```bash
export LANGSMITH_CODEX_API_KEY="lsv2_pt_..."
export LANGSMITH_CODEX_PROJECT="codex"
export TRACE_TO_LANGSMITH="true"
```

**Option 2: JSON config file**

Create `~/.codex/langsmith.json` (global) or `<project>/.codex/langsmith.json` (per-project):

```json
{
  "enabled": true,
  "api_key": "lsv2_pt_...",
  "project": "codex"
}
```

Config files are loaded from `~/.codex/langsmith.json` first, then `<project>/.codex/langsmith.json`. Environment variables take precedence over both. `LANGSMITH_CODEX_*` variables take precedence over the matching standard `LANGSMITH_*` variables.

### Getting your LangSmith API key

1. Go to [smith.langchain.com](https://smith.langchain.com)
2. Sign in or create an account
3. Navigate to **Settings** → **API Keys**
4. Click **Create API Key**
5. Copy the key (starts with `lsv2_pt_...`)

Complete a Codex turn, then look for runs in the `codex` project in LangSmith.

## What gets traced

Each LLM run includes:

- **Inputs**: accumulated conversation messages
- **Outputs**: assistant response content
- **Metadata**: model provider, model name, stop reason, token usage

Subagent threads are resolved and uploaded as nested child runs under the parent turn. Tool calls (function calls, shell calls, computer calls, file reads, web searches) are included with inputs and outputs.

Interrupted turns (where the user cancels mid-response) are still uploaded upon session completion.

## Secret redaction

By default, the plugin strips common secrets — provider API keys, JWTs, PEM blocks, and structural `NAME=value`, `Authorization`, and URL-credential shapes — from run inputs, outputs, and metadata **before they are uploaded** to LangSmith.

- Set `LANGSMITH_CODEX_REDACT` to a falsy value (`false`, `0`, `no`, or `off`) to turn redaction off.
- Set `LANGSMITH_CODEX_REDACT_EXTRA` to a JSON array of `{ "pattern": "...", "replace": "..." }` rules to redact additional custom patterns. `pattern` is a regular-expression string; `replace` (optional) is the replacement text.

## Environment variables

Tracing is disabled unless `TRACE_TO_LANGSMITH` or `enabled` is set to `true`.

| Variable                                                     | Required | Default                           | Description                                                                  |
| ------------------------------------------------------------ | -------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `TRACE_TO_LANGSMITH`                                         | Yes      | —                                 | Set to `"true"` to enable tracing                                            |
| `LANGSMITH_CODEX_API_KEY`, `LANGSMITH_API_KEY`               | Yes\*    | —                                 | LangSmith API key. \*Required unless `LANGSMITH_CODEX_RUNS_ENDPOINTS` is set |
| `LANGSMITH_CODEX_PROJECT`, `LANGSMITH_PROJECT`               | No       | `"codex"`                         | LangSmith project name                                                       |
| `LANGSMITH_CODEX_ENDPOINT`, `LANGSMITH_ENDPOINT`             | No       | `https://api.smith.langchain.com` | LangSmith API base URL                                                       |
| `LANGSMITH_CODEX_METADATA`, `LANGSMITH_METADATA`             | No       | —                                 | JSON object of custom metadata to attach to all runs                         |
| `LANGSMITH_CODEX_RUNS_ENDPOINTS`, `LANGSMITH_RUNS_ENDPOINTS` | No       | —                                 | JSON array of replica destinations for multi-project tracing                 |
| `LANGSMITH_CODEX_REDACT`                                     | No       | `"true"`                          | Set to a falsy value (`false`/`0`/`no`/`off`) to disable secret redaction    |
| `LANGSMITH_CODEX_REDACT_EXTRA`                               | No       | —                                 | JSON array of `{ pattern, replace }` custom redaction rules                  |

## JSON config reference

| Config key           | Environment variable                                         | Default           | Description                                  |
| -------------------- | ------------------------------------------------------------ | ----------------- | -------------------------------------------- |
| `enabled`            | `TRACE_TO_LANGSMITH`                                         | `false`           | Enable tracing                               |
| `api_key`            | `LANGSMITH_CODEX_API_KEY`, `LANGSMITH_API_KEY`               | unset             | LangSmith API key                            |
| `api_url`            | `LANGSMITH_CODEX_ENDPOINT`, `LANGSMITH_ENDPOINT`             | LangSmith default | API endpoint                                 |
| `project`            | `LANGSMITH_CODEX_PROJECT`, `LANGSMITH_PROJECT`               | `"codex"`         | Project name                                 |
| `metadata`           | `LANGSMITH_CODEX_METADATA`, `LANGSMITH_METADATA`             | unset             | Custom metadata object                       |
| `replicas`           | `LANGSMITH_CODEX_RUNS_ENDPOINTS`, `LANGSMITH_RUNS_ENDPOINTS` | unset             | Replica destinations                         |
| `redact`             | `LANGSMITH_CODEX_REDACT`                                     | `true`            | Redact secrets before upload                 |
| `redact_extra_rules` | `LANGSMITH_CODEX_REDACT_EXTRA`                               | unset             | Extra `{ pattern, replace }` redaction rules |

## Tracing to multiple destinations (Replicas)

You can trace to multiple LangSmith projects or workspaces simultaneously using `LANGSMITH_CODEX_RUNS_ENDPOINTS`. This is useful for:

- Sending traces to both a production and staging project
- Tracing to multiple workspaces with different API keys
- Attaching extra metadata to specific replica destinations

Set `LANGSMITH_CODEX_RUNS_ENDPOINTS` to a JSON array of replica configurations. When set, this overrides other client settings.

**Option 1: JSON config file (recommended)**

In `~/.codex/langsmith.json` or `<project>/.codex/langsmith.json`:

```json
{
  "enabled": true,
  "replicas": [
    {
      "apiUrl": "https://api.smith.langchain.com",
      "apiKey": "lsv2_pt_workspace_a",
      "projectName": "project-prod"
    },
    {
      "apiUrl": "https://api.smith.langchain.com",
      "apiKey": "lsv2_pt_workspace_b",
      "projectName": "project-staging",
      "updates": { "metadata": { "environment": "staging" } }
    }
  ]
}
```

**Option 2: Shell environment variable**

```bash
export LANGSMITH_CODEX_RUNS_ENDPOINTS='[{"apiUrl":"https://api.smith.langchain.com","apiKey":"lsv2_pt_workspace_a","projectName":"project-prod"},{"apiUrl":"https://api.smith.langchain.com","apiKey":"lsv2_pt_workspace_b","projectName":"project-staging","updates":{"metadata":{"environment":"staging"}}}]'
```

> **Tip:** To generate the escaped JSON string, use: `echo '[{"apiUrl":"...","apiKey":"...","projectName":"..."}]' | jq -c .`

### Replica format

| Field         | Required | Description                                                     |
| ------------- | -------- | --------------------------------------------------------------- |
| `apiUrl`      | Yes      | LangSmith API URL (typically `https://api.smith.langchain.com`) |
| `apiKey`      | Yes      | API key for the destination workspace                           |
| `projectName` | Yes      | Project name in the destination workspace                       |
| `updates`     | No       | Optional metadata/fields to override on the replicated runs     |

## Troubleshooting

- **No runs appear**: confirm `plugin_hooks = true`, the plugin is enabled, and `TRACE_TO_LANGSMITH=true` is visible to the Codex process.
- **Authentication fails**: check that `LANGSMITH_CODEX_API_KEY` or `LANGSMITH_API_KEY` is set and valid.
- **Runs appear in the wrong project**: set `LANGSMITH_CODEX_PROJECT` or the `project` config key.
- **Custom endpoint not used**: set `LANGSMITH_CODEX_ENDPOINT` or the `api_url` config key.

## Data sent to LangSmith

When enabled, the plugin uploads completed Codex transcript data to LangSmith, including messages, tool call inputs and outputs, model metadata, token usage, and subagent thread structure. Do not enable tracing for sessions that contain data you do not want stored in LangSmith.

## Development

```bash
pnpm install
pnpm test        # Run tests
pnpm lint        # Run linter
pnpm build       # Production build
```

After making changes, run `pnpm build` and complete a new Codex turn to pick up the updated hooks.

## License

MIT
