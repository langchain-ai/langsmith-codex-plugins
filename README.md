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

Create `~/.langsmith-plugins.json` (shared home baseline), `~/.codex/langsmith.json` (Codex user config), `<project>/langsmith-plugins.json` (shared plugin project config), or `<project>/.codex/langsmith.json` (Codex-specific project config):

```json
{
  "enabled": true,
  "api_key": "lsv2_pt_...",
  "project": "codex"
}
```

The shared project-root file is named `langsmith-plugins.json` to distinguish plugin configuration from application tracing configuration. A root `langsmith.json` is ignored, even if malformed; it is not a legacy alias. The Codex-specific project and user `.codex/langsmith.json` filenames are unchanged. The home baseline is read only from `~/.langsmith-plugins.json`; there is no fallback to the old nonhidden `~/langsmith-plugins.json`. This is a lookup rule, not a file blacklist: when the hook `cwd` is the home directory, `~/langsmith-plugins.json` is still the legitimate project-root config, above the hidden home baseline.

**All shared settings use the same precedence, resolved independently per field:**

1. Environment (including `TRACE_TO_LANGSMITH` for `enabled`).
2. `<hook cwd>/.codex/langsmith.json`.
3. `<hook cwd>/langsmith-plugins.json`.
4. User `~/.codex/langsmith.json`.
5. Home `~/.langsmith-plugins.json`.
6. Defaults (`enabled: false`, `defaultMuted: false`, `redact: true`, project `"codex"`).

All four files use the same common contract below; the home-root file supports the entire configuration, not just privacy switches. Missing fields fall through. Only JSON booleans are valid in files; an invalid present `enabled` restricts that file's value to false. Malformed/non-object JSON, invalid recognized ordinary common fields, or unreadable/non-regular files (including dangling symlinks, directories, devices, and FIFOs) discard that file’s ordinary common values and restrict its switches: enabled false and default muted. Readable symlinks to regular files are accepted; only a genuinely missing file is absent. Higher-priority sources, including environment values, override restricted switches independently.

The master environment switch `TRACE_TO_LANGSMITH` retains its historical parser: whitespace is trimmed and values are case-insensitive; `true`, `1`, `yes`, and `on` enable tracing, while `false`, `0`, `no`, and `off` disable it. Any other present value, including empty, means off. An unset variable falls through to files, then off. This differs from the strict default-mute environment parser below. `TRACE_TO_LANGSMITH=true` therefore overrides a project `{"enabled": false}`, and `TRACE_TO_LANGSMITH=false` overrides a project `{"enabled": true}`.

Arrays replace lower-priority arrays. Metadata is the exception to whole-value precedence: it shallow-merges per key in **defaults → home root → user `.codex` → project root → project `.codex` → environment** order. Higher-priority nested values replace rather than deep-merge, and `{}` does not clear inherited metadata. `LANGSMITH_CODEX_*` variables take precedence over matching `LANGSMITH_*` variables.

### Shared file contract and Codex extensions

> **Security: trust repository tracing configuration before using this plugin.** Project `langsmith-plugins.json` and `.codex/langsmith.json` can enable tracing, choose upload endpoints and replicas, supply credentials, and disable secret redaction. Full trace uploads may contain conversation messages, file contents, and tool arguments/results; a malicious configuration can send this content to a third party. Review these files before using the plugin in an unfamiliar repository. Also review project-native `.codex/config.toml` and `.codex/hooks.json`, which can configure environment settings and commands. Secret redaction is not a guarantee that uploaded content is safe to share. To prevent this plugin from uploading, disable it.

Common keys are `enabled`, `defaultMuted`, `api_key`, `api_url`, `project`, `replicas`, `metadata`, `redact`, and `redact_extra_rules`. Strings are preserved verbatim (including empty strings); metadata and replica `updates` must be non-null JSON objects, not arrays. `redact` must be a JSON boolean and defaults to true. Redaction rules are an array of `{ "pattern": "regex", "replace": "optional replacement" }` with valid regular expressions, compiled globally. Invalid `enabled`/`defaultMuted` restrict only that individual field; an invalid recognized ordinary common field discards **all common fields in that file** and restricts both switches. Ordinary settings can still fall back to lower files, and higher-priority files or environment values can independently override restricted switches.

Unknown fields and other harness extensions cannot change common validity. Codex’s `parent_headers` is a **separate extension**, validated independently from the raw file object: it requires string `langsmith-trace` and optional string `baggage`. Invalid parent headers are omitted, not a reason to disable common tracing. Parent headers replace as a whole with environment > project `.codex` > project root > user `.codex` > home root precedence.

Environment discovery retains Codex’s existing convention: `LANGSMITH_CODEX_<SUFFIX>` wins over `LANGSMITH_<SUFFIX>` (including `METADATA`, `PARENT_HEADERS`, `REDACT`, and `REDACT_EXTRA`); `enabled` uses only `TRACE_TO_LANGSMITH`. Ordinary JSON env values keep the legacy parser: malformed/empty JSON is ignored; decoded values that fail the existing schema discard the ordinary environment layer, not independently parsed privacy switches. Redaction env booleans accept trimmed, case-insensitive `true/false`, `1/0`, `yes/no`, and `on/off`. Valid environment metadata merges **per key**, rather than erasing unrelated file metadata. Full-mode custom metadata still follows existing structural builder precedence; muted mode drops arbitrary custom fields and collisions even with `redact: false`.

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

- **Mute** saves metadata-only tracing for subsequent turns in this native thread; **unmute** saves full tracing. Threads without an explicit override use the configured default (full when unset) when master tracing is enabled.
- Each submitted turn receives an immutable launch snapshot. Controls do not change active or already-snapshotted queued turns, or subagents they launched. All descendants inherit their launch mode, including direct child Stop hooks that arrive before the parent Stop.
- Controls also work while master tracing is off; neither command enables it or supplies credentials. Off launch snapshots remain off if tracing is later enabled.
- Wait for the local confirmation before submitting sensitive work. If no confirmation appears, do not assume mute worked: check version, hook enablement/trust, and installation cache.
- Mute affects LangSmith uploads, **not** what Codex/the model can read or retain locally. It does not delete earlier uploads or remove context. After unmute, future full turns can include earlier sensitive material if Codex repeats it or includes it in their context.

### Default mute configuration

To default to metadata-only tracing without muting each thread individually:

```bash
export LANGSMITH_CODEX_DEFAULT_MUTED="true"
# "false" restores the unmuted default.
```

Or set JSON booleans in project `.codex/langsmith.json`, project-root `langsmith-plugins.json`, user `~/.codex/langsmith.json`, or home `~/.langsmith-plugins.json`:

```json
{
  "enabled": true,
  "defaultMuted": true
}
```

Precedence is **`LANGSMITH_CODEX_DEFAULT_MUTED` > `LANGSMITH_DEFAULT_MUTED` > project `.codex` `defaultMuted` > project-root `defaultMuted` > user `.codex` `defaultMuted` > home-root `defaultMuted` > unmuted**. The standard alias follows this harness's existing `LANGSMITH_CODEX_*`/`LANGSMITH_*` convention; prefer the Codex-specific variable to avoid affecting other harnesses. A present Codex-specific value, even empty or invalid, wins over the alias.

Set `defaultMuted` to JSON `false` for full content. An `enabled`-only file does not hide a lower-priority `defaultMuted`; a `defaultMuted`-only file does not disable environment-enabled tracing. Both project paths use the hook payload's `cwd` (or the configured `cwd` when calling the config reader), not the plugin installation directory. There is no ancestor or Git-root search: a hook running in a nested directory only checks that directory's project files. Invalid present mute values (including strings/null), malformed or unreadable files conservatively restrict that file’s mute default unless a higher-priority source sets it. Default-mute environment values `true`/`false` are case-insensitive with **no trimming**; any other present value, including an empty string, means muted. When both variables are unset, resolution falls through to files, then unmuted. Credentials and master enablement remain separate.

Only threads **without an explicit saved mute/unmute override** follow the current configuration on each new submission, including existing threads. Saved unmute wins over default mute; saved mute wins over default unmute. Normal prompts save immutable turn evidence, not a default preference. Config reads do not write privacy state. Controls only set explicit thread overrides, never a global default, and still work with master tracing disabled.

Current/queued turn and descendant launch snapshots remain unchanged across config changes. Children inherit the parent's launch snapshot, not today's default. Stop/recovery paths without launch evidence stay metadata-only even when the current default or override is full; there is no unmute backfill.

### Persistence and replay

Preferences and immutable per-turn/descendant evidence live in `~/.codex/langsmith-state.privacy.json` (using the hook process’s `HOME`), shared across hook processes and projects, keyed by native thread ID. Resuming the same thread after restart keeps its preference. This file is separate from each rollout’s `.langsmith` upload-dedup sidecar and is not pruned with it.

The strict privacy schema is `{ "version": 1, "threads": { "thread-id": { "turns": { "turn-id": "metadata" } } } }`. Each thread requires `turns` (values `"off"`, `"full"`, or `"metadata"`), and may have an explicit `preference` (`"full"` or `"metadata"`) and an `inherited` launch snapshot (`"off"`, `"full"`, or `"metadata"`). No other top-level or thread fields are allowed. A missing file means no overrides or evidence. **Configuration alone owns the default**; no persisted global default or migration/compatibility format is supported. Invalid state fails closed and writers refuse to overwrite it.

Stop replays the whole rollout. Historical muted/off snapshots are never upgraded by unmute, even after dedup sidecar deletion. Missing native launch evidence, missing/ambiguous child ancestry, and corrupt/unreadable privacy state fall back to metadata-only uploads rather than today’s full preference. Ordinary prompts are blocked if their launch evidence cannot be saved; corrupt files are not silently overwritten.

Writes use a private `0700` directory lock, a two-second acquisition deadline with 10–30 ms retry jitter, and a `0600` temporary file followed by fsync/atomic rename and directory fsync. A post-rename durability/cleanup failure reports that the preference was saved with a warning. A crashed writer’s lock is never stolen: remove `~/.codex/langsmith-state.privacy.json.lock` only after confirming no preference writer is running. Repair corrupt state/permissions and retry; do not delete the privacy file as a routine reset. Deletion loses sticky preferences and new submissions use the configured default, although historical turns without evidence remain metadata-only. The evidence file currently grows with thread/turn count; there is no automatic retention policy.

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

Tracing is disabled by default; the master-switch precedence above determines enablement independently of per-thread privacy preferences.

| Variable                                                     | Required | Default                           | Description                                                                                  |
| ------------------------------------------------------------ | -------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `TRACE_TO_LANGSMITH`                                         | No       | `false`                           | Overrides file `enabled`; trimmed, case-insensitive `true`/`1`/`yes`/`on` enable             |
| `LANGSMITH_CODEX_DEFAULT_MUTED`, `LANGSMITH_DEFAULT_MUTED`   | No       | `false`                           | Default metadata-only mode without a thread override; environment-first; invalid values mute |
| `LANGSMITH_CODEX_API_KEY`, `LANGSMITH_API_KEY`               | Yes\*    | —                                 | LangSmith API key. \*Required unless `LANGSMITH_CODEX_RUNS_ENDPOINTS` is set                 |
| `LANGSMITH_CODEX_PROJECT`, `LANGSMITH_PROJECT`               | No       | `"codex"`                         | LangSmith project name                                                                       |
| `LANGSMITH_CODEX_ENDPOINT`, `LANGSMITH_ENDPOINT`             | No       | `https://api.smith.langchain.com` | LangSmith API base URL                                                                       |
| `LANGSMITH_CODEX_METADATA`, `LANGSMITH_METADATA`             | No       | —                                 | JSON object of custom metadata to attach to all runs                                         |
| `LANGSMITH_CODEX_RUNS_ENDPOINTS`, `LANGSMITH_RUNS_ENDPOINTS` | No       | —                                 | JSON array of replica destinations for multi-project tracing                                 |
| `LANGSMITH_CODEX_PARENT_HEADERS`                             | No       | —                                 | JSON object containing LangSmith distributed-tracing parent headers                          |
| `LANGSMITH_CODEX_REDACT`                                     | No       | `"true"`                          | Set to a falsy value (`false`/`0`/`no`/`off`) to disable secret redaction                    |
| `LANGSMITH_CODEX_REDACT_EXTRA`                               | No       | —                                 | JSON array of `{ pattern, replace }` custom redaction rules                                  |

## JSON config reference

| Config key           | Environment variable                                         | Default           | Description                                       |
| -------------------- | ------------------------------------------------------------ | ----------------- | ------------------------------------------------- |
| `defaultMuted`       | `LANGSMITH_CODEX_DEFAULT_MUTED`, `LANGSMITH_DEFAULT_MUTED`   | `false`           | Default metadata-only tracing without an override |
| `enabled`            | `TRACE_TO_LANGSMITH`                                         | `false`           | Enable tracing                                    |
| `api_key`            | `LANGSMITH_CODEX_API_KEY`, `LANGSMITH_API_KEY`               | unset             | LangSmith API key                                 |
| `api_url`            | `LANGSMITH_CODEX_ENDPOINT`, `LANGSMITH_ENDPOINT`             | LangSmith default | API endpoint                                      |
| `project`            | `LANGSMITH_CODEX_PROJECT`, `LANGSMITH_PROJECT`               | `"codex"`         | Project name                                      |
| `metadata`           | `LANGSMITH_CODEX_METADATA`, `LANGSMITH_METADATA`             | unset             | Custom metadata object                            |
| `replicas`           | `LANGSMITH_CODEX_RUNS_ENDPOINTS`, `LANGSMITH_RUNS_ENDPOINTS` | unset             | Replica destinations                              |
| `parent_headers`     | `LANGSMITH_CODEX_PARENT_HEADERS`                             | unset             | Distributed-tracing parent headers                |
| `redact`             | `LANGSMITH_CODEX_REDACT`                                     | `true`            | Redact secrets before upload                      |
| `redact_extra_rules` | `LANGSMITH_CODEX_REDACT_EXTRA`                               | unset             | Extra `{ pattern, replace }` redaction rules      |

## Tracing to multiple destinations (Replicas)

You can trace to multiple LangSmith projects or workspaces simultaneously using `LANGSMITH_CODEX_RUNS_ENDPOINTS`. This is useful for:

- Sending traces to both a production and staging project
- Tracing to multiple workspaces with different API keys
- Attaching extra metadata to specific replica destinations

Set `LANGSMITH_CODEX_RUNS_ENDPOINTS` to a JSON array of replica configurations. When nonempty, this selects the replica destinations instead of an additional primary upload; omitted destination fields inherit the client/project defaults.

**Option 1: JSON config file (recommended)**

In `~/.langsmith-plugins.json`, `~/.codex/langsmith.json`, `<project>/langsmith-plugins.json`, or `<project>/.codex/langsmith.json`:

```json
{
  "enabled": true,
  "replicas": [
    {
      "api_url": "https://api.smith.langchain.com",
      "api_key": "lsv2_pt_workspace_a",
      "project": "project-prod"
    },
    {
      "api_url": "https://api.smith.langchain.com",
      "api_key": "lsv2_pt_workspace_b",
      "project": "project-staging",
      "updates": { "extra": { "metadata": { "environment": "staging" } } }
    }
  ]
}
```

**Option 2: Shell environment variable**

```bash
export LANGSMITH_CODEX_RUNS_ENDPOINTS='[{"api_url":"https://api.smith.langchain.com","api_key":"lsv2_pt_workspace_a","project":"project-prod"},{"api_url":"https://api.smith.langchain.com","api_key":"lsv2_pt_workspace_b","project":"project-staging","updates":{"extra":{"metadata":{"environment":"staging"}}}}]'
```

> **Tip:** To generate the escaped JSON string, use: `echo '[{"api_url":"...","api_key":"...","project":"..."}]' | jq -c .`

### Replica format

| Field     | Required | Description                                                                   |
| --------- | -------- | ----------------------------------------------------------------------------- |
| `api_url` | No       | Destination API URL; inherits the client URL when omitted                     |
| `api_key` | No       | Destination API key; inherits the client key when omitted                     |
| `project` | No       | Destination project; inherits the configured project when omitted             |
| `updates` | No       | JSON object of run-field overrides on replica updates (removed in muted mode) |

File replicas accept SDK-style `apiUrl`, `apiKey`, and `projectName` aliases, but canonical own keys win even when empty; an invalid canonical value cannot fall back to an alias. Unknown replica fields are ignored. File tuples are not accepted. The adapter stores canonical keys and converts to SDK camelCase only at the upload boundary. Replica arrays replace, not concatenate; an explicit `[]` disables inherited replicas and SDK-only environment discovery while still uploading to the primary client destination. An explicit plugin-supported environment replica array retains ordinary env-first precedence. `{}` entries inherit client/project defaults. `redact_extra_rules: []` similarly clears inherited extra rules.

## Troubleshooting

- **No runs appear**: confirm `plugin_hooks = true`, plugin hooks are trusted, the plugin is enabled, and the master-switch precedence permits tracing. A present `TRACE_TO_LANGSMITH` overrides file enablement; when unset, check all four config files.
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
