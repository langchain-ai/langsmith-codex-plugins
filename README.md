# LangSmith Tracing for OpenAI Codex

Sends your Codex turns to [LangSmith](https://smith.langchain.com) so you can read back what the agent actually did.

## What you need

- **On a Mac, nothing.** The plugin carries its own build and runs it directly.
- **Everywhere else, including Windows,** Node.js 22 or newer.
- Codex 0.153.4 or newer, and a LangSmith account and API key.

If the carried Mac build cannot start, the plugin hands the turn to Node instead of losing it, so Node is still worth having.

## Install

Codex installs and updates the plugin for you, so there is nothing to download:

```bash
codex plugin marketplace add langchain-ai/langsmith-codex-plugins
```

Then turn it on, either globally in `~/.codex/config.toml` or for one project in `.codex/config.toml`:

```toml
[plugins."tracing@langsmith-codex-plugins"]
enabled = true
```

**Enabling it is not enough on its own.** You also have to trust its hooks with `/hooks`, and nothing traces until you do. Codex only asks in the interactive interface, so a session started with `codex exec` quietly skips the hooks until you have trusted them once. Restart Codex afterwards.

Codex remembers your answer against the exact wording of each hook, so any release that changes one asks you to trust it again, including after Codex updates the plugin on its own.

## Turn on tracing

Tracing is off until you give it a key and switch it on. Write both to `~/.codex/langsmith.json`:

```json
{ "enabled": true, "api_key": "lsv2_pt_...", "project": "codex" }
```

Get a key from [smith.langchain.com](https://smith.langchain.com) under **Settings** then **API Keys**. Complete a turn, then look for it in the `codex` project.

Settings can also live in a project, at `<project>/.codex/langsmith.json` or `<project>/langsmith-plugins.json`, or across every harness at `~/.langsmith-plugins.json`. A setting from your shell beats a project file, which beats a user file, which beats the shared one.

> **Check a repository's tracing settings before you trust it.** A project file can switch tracing on, point uploads at someone else's server, supply its own credentials and turn secret redaction off, and a full trace can carry your conversation, file contents and tool results. Review these files in an unfamiliar repository, along with `.codex/config.toml` and `.codex/hooks.json`.

## What gets traced

Each model call carries the conversation so far, the assistant's reply, and the model name, provider, stop reason and token counts. Tool calls, shell calls, file reads and web searches come with their inputs and outputs, subagent threads appear as children of the turn that started them, and a turn you cancel still uploads.

## Hide one thread

Send either of these as an ordinary message, with no leading slash and nothing else on the line:

```text
langsmith-tracing:mute
```

```text
langsmith-tracing:unmute
```

Muting keeps tracing the shape of the thread while leaving the content out, and it applies from the next turn rather than the one in flight. The turn you are in already has its mode locked, and so does anything it started. Wait for the confirmation before sending anything sensitive, and if none appears do not assume it worked.

Muting changes only what reaches LangSmith. Codex still reads and remembers everything locally, and earlier uploads are not deleted.

To mute by default instead of thread by thread, set `defaultMuted` to `true`. A thread you muted or unmuted by hand keeps that choice regardless.

## Settings

Every setting has a config key and an environment variable. The `LANGSMITH_CODEX_` form wins over the plain `LANGSMITH_` one.

| Config key           | Environment variable             | Default                           | What it does                            |
| -------------------- | -------------------------------- | --------------------------------- | --------------------------------------- |
| `enabled`            | `TRACE_TO_LANGSMITH`             | `false`                           | Whether to trace at all                 |
| `api_key`            | `LANGSMITH_CODEX_API_KEY`        | none                              | Your LangSmith key                      |
| `project`            | `LANGSMITH_CODEX_PROJECT`        | `codex`                           | Where runs land                         |
| `api_url`            | `LANGSMITH_CODEX_ENDPOINT`       | `https://api.smith.langchain.com` | Which server to send to                 |
| `defaultMuted`       | `LANGSMITH_CODEX_DEFAULT_MUTED`  | `false`                           | Leave content out unless told otherwise |
| `redact`             | `LANGSMITH_CODEX_REDACT`         | `true`                            | Strip secrets before upload             |
| `redact_extra_rules` | `LANGSMITH_CODEX_REDACT_EXTRA`   | none                              | Extra patterns to strip                 |
| `metadata`           | `LANGSMITH_CODEX_METADATA`       | none                              | Custom fields on every run              |
| `replicas`           | `LANGSMITH_CODEX_RUNS_ENDPOINTS` | none                              | Send the same trace somewhere else too  |

Secrets are stripped before anything is uploaded, covering API keys, JWTs, PEM blocks and common `NAME=value`, `Authorization` and URL-credential shapes. That is not a guarantee that what you upload is safe to share.

## When nothing shows up

- **No runs at all.** Check the plugin is enabled, its hooks are trusted with `/hooks`, and tracing is switched on. A `TRACE_TO_LANGSMITH` in your shell overrides whatever the files say.
- **It stopped after an update.** The hooks changed, so trust them again with `/hooks`.
- **Rejected key.** Check `LANGSMITH_CODEX_API_KEY` is set and still valid.
- **Runs in the wrong place.** Set `LANGSMITH_CODEX_PROJECT`, or the `project` key.

## What leaves your machine

With tracing on, a full turn uploads your messages, tool inputs and outputs, metadata, token usage and subagent structure. A muted turn uploads the structure and placeholders instead. Keep tracing off if none of that may leave your machine.

## Development

```bash
pnpm install
pnpm test
pnpm lint
pnpm build
```

Run `pnpm build` and start a new turn to pick up your changes.

## License

MIT
