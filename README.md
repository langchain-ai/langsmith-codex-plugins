# LangSmith Tracing Plugin for OpenAI Codex

A Codex plugin that traces agent turns, tool calls, model metadata, and subagent threads to [LangSmith](https://smith.langchain.com).

## Prerequisites

- Node.js >= 22.x
- Codex >= 0.153.4 with synchronous `UserPromptSubmit` plugin hooks enabled and trusted (see below)
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

Enable/trust this plugin’s hooks in Codex’s plugin UI when prompted; enabling the plugin alone is not sufficient. Restart Codex after installation or hook changes. The controls require hooks that can apply synchronous blocking decisions. An untrusted, disabled, asynchronous, or unsupported hook is **not** a privacy control.

Current support is based on the released [Codex 0.153.4 UserPromptSubmit implementation](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/hooks/src/events/user_prompt_submit.rs): native `session_id`, `turn_id`, `cwd`, and `prompt`, with synchronous stdout `{ "decision": "block", "reason": "..." }`. Older versions that only support Stop tracing are not sufficient. This is source/automated-test compatibility, not a live Codex smoke-test claim.

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

## Per-thread privacy controls

Submit exactly one of these as an ordinary chat message, **without a leading slash**, whitespace, arguments, or extra prose:

```text
langsmith-tracing:mute
```

```text
langsmith-tracing:unmute
```

The synchronous `UserPromptSubmit` hook consumes the control locally, does not invoke the model, and displays: **“Preference saved for the next turn; the current turn is unchanged.”** Additional feedback identifies the saved mode and any master-off or filesystem warning. No model skill is required. Codex’s TUI rejects unknown slash commands before they reach this hook, so `/langsmith-tracing:mute` is not supported.

- **Mute** saves metadata-only tracing for subsequent turns in this native thread; **unmute** saves full tracing. Threads without an explicit override use full tracing when master tracing is enabled.
- Each submitted turn receives an immutable launch snapshot. Controls do not change active or already-snapshotted queued turns, or subagents they launched. All descendants inherit their launch mode, including direct child Stop hooks that arrive before the parent Stop.
- Controls also work while master tracing is off; neither command enables it or supplies credentials. Off launch snapshots remain off if tracing is later enabled.
- Wait for the local confirmation before submitting sensitive work. If no confirmation appears, do not assume mute worked: check version, hook enablement/trust, and installation cache.
- Mute affects LangSmith uploads, **not** what Codex/the model can read or retain locally. It does not delete earlier uploads or remove context. After unmute, future full turns can include earlier sensitive material if Codex repeats it or includes it in their context.

### Persistence and replay

Preferences and immutable per-turn/descendant evidence live in `~/.codex/langsmith-state.privacy.json` (using the hook process’s `HOME`), shared across hook processes and projects, keyed by native thread ID. Resuming the same thread after restart keeps its preference. This file is separate from each rollout’s `.langsmith` upload-dedup sidecar and is not pruned with it.

The strict privacy schema is `{ "version": 1, "threads": { "thread-id": { "turns": { "turn-id": "metadata" } } } }`. Each thread requires `turns` (values `"off"`, `"full"`, or `"metadata"`), and may have an explicit `preference` (`"full"` or `"metadata"`) and an `inherited` launch snapshot (`"off"`, `"full"`, or `"metadata"`). No other top-level or thread fields are allowed. A missing file means no overrides or evidence. The default is full tracing; no persisted global default or migration/compatibility format is supported. Invalid state fails closed and writers refuse to overwrite it.

Stop replays the whole rollout. Historical muted/off snapshots are never upgraded by unmute, even after dedup sidecar deletion. Missing native launch evidence, missing/ambiguous child ancestry, and corrupt/unreadable privacy state fall back to metadata-only uploads rather than today’s full preference. Ordinary prompts are blocked if their launch evidence cannot be saved; corrupt files are not silently overwritten.

Writes use a private `0700` directory lock, a two-second acquisition deadline with 10–30 ms retry jitter, and a `0600` temporary file followed by fsync/atomic rename and directory fsync. A post-rename durability/cleanup failure reports that the preference was saved with a warning. A crashed writer’s lock is never stolen: remove `~/.codex/langsmith-state.privacy.json.lock` only after confirming no preference writer is running. Repair corrupt state/permissions and retry; do not delete the privacy file as a routine reset. Deletion loses sticky preferences and new submissions use full tracing when master tracing is enabled, although historical turns without evidence remain metadata-only. The evidence file currently grows with thread/turn count; there is no automatic retention policy.

## What gets traced

In full mode, each LLM run includes:

- **Inputs**: accumulated conversation messages
- **Outputs**: assistant response content
- **Metadata**: model provider, model name, stop reason, token usage

Subagent threads are resolved and uploaded as nested child runs under the parent turn. Tool calls (function calls, shell calls, computer calls, file reads, web searches) are included with inputs and outputs.

Interrupted turns (where the user cancels mid-response) are still uploaded upon session completion.

In metadata-only mode, root, model, and tool inputs/outputs are replaced by role-bearing placeholder messages containing `[LangSmith system notice: content omitted because tracing is muted.]`. Runs retain topology, parent IDs, trace ordering, timestamps, status, native IDs, model/tool identity, numeric token usage, and safe coding-agent schema fields. Metadata includes `ls_tracing_mode: "metadata"`. Message content, tool arguments/results, raw errors, attachments, arbitrary custom metadata (including allowlist-key collisions), paths/repository/user identity, SDK runtime/environment enrichment, and replica update overrides are excluded. Destination/auth configuration remains in use. Secret redaction still applies to retained values; turning redaction off does not disable the metadata-only projection.

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
| `LANGSMITH_CODEX_PARENT_HEADERS`                             | No       | —                                 | JSON object containing LangSmith distributed-tracing parent headers          |
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
| `parent_headers`     | `LANGSMITH_CODEX_PARENT_HEADERS`                             | unset             | Distributed-tracing parent headers           |
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

When master tracing is enabled, full launch snapshots upload transcript messages, tool inputs/outputs, metadata, usage, and subagent structure. Metadata-only snapshots upload the safe structure and placeholders described above; off snapshots upload nothing. Metadata-only still sends structural identifiers and usage to LangSmith. Keep master tracing off if none of that data may leave your machine.

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
