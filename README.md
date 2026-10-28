# LangSmith Tracing Plugin for OpenAI Codex

Sends your Codex turns, tool calls and subagent threads to [LangSmith](https://smith.langchain.com) so you can see what the agent actually did.

## What you need

- **On a Mac:** nothing. The plugin carries its own build and runs it directly.
- **On Windows and Linux:** Node.js 22 or newer.
- Codex 0.153.4 or newer.
- A LangSmith account.

Node is still worth having on a Mac because the plugin hands the turn to it if its own build can't start.

## Install

### Install for yourself

Add the marketplace and install the plugin:

```bash
codex plugin marketplace add langchain-ai/langsmith-codex-plugins
codex plugin add tracing@langsmith-codex-plugins
```

You can also install it from the plugin browser by running `/plugins` inside Codex.

**You also need to trust the plugin's hooks** with `/hooks` or when Codex's plugin UI asks. Nothing traces until you do. Codex only asks in the interactive interface, so `codex exec` skips the hooks until you've trusted them once. Restart Codex afterwards.

### Install for your organization

ChatGPT workspace admins can install the plugin for everyone by importing this repository as a marketplace. See [Plugin management](https://developers.openai.com/codex/enterprise/plugin-management) for how. Each user still has to trust the plugin's hooks before anything traces. Then use the managed file below to switch tracing on and set the project for everyone.

### Lock settings with a managed file

An admin can lock any setting in the [Settings](#settings) table except `profile` with a managed file at `~/.langsmith-plugins/managed.json` in each user's home folder. It overrides every other file and environment variable and works on macOS and Linux. Admins usually install it on each machine with an MDM tool, which manages company laptops (such as Jamf, Kandji or Microsoft Intune).

The plugin only trusts the file when:

- Root owns the file and its folder
- No other user can write to either
- Neither is a symlink

If the file is broken or fails these checks then tracing stops and Codex explains why. See [the settings guide](https://github.com/langchain-ai/langsmith-plugin-binary/blob/main/docs/settings.md) to set it up.

## Authenticate

The simplest option is to sign in once with the LangSmith CLI, which you can [install from its docs](https://docs.langchain.com/langsmith/langsmith-cli#install) if you don't have it yet:

```bash
langsmith auth login
```

If you use the CLI sign-in and have more than one profile set `profile` to the one the plugin should use. Your own `api_key` ignores this setting, but a generic `LANGSMITH_API_KEY` isn't used as a fallback while `profile` is set.

You can use an API key instead by setting `api_key` in your config file. Create one at [smith.langchain.com](https://smith.langchain.com) under **Settings** then **API Keys**.

If more than one credential is set the plugin uses the first one it finds:

1. The plugin's own key from `api_key` or `LANGSMITH_CODEX_API_KEY`
2. Your `langsmith auth login` sign-in
3. A generic `LANGSMITH_API_KEY` in your shell

When your sign-in expires, your key is rejected or you sign out the plugin stops uploading but still lets your prompts through. Turns from that gap are never uploaded, and Codex shows a notice in the chat at most every 2 minutes until you fix it. Use `notice_cooldown` to change that interval or set it to `off` to hide the notices.

### Strict auth

Strict auth refuses every prompt until your sign-in or key works again, even if no credentials were ever set. Turn it on by setting `strict_auth` to `true`. It's off by default and has no effect while tracing is off.

> **Strict auth also blocks `codex exec`.** Leave it off in CI unless a failed sign-in should fail the job.

## Turn on tracing

Tracing is off until you switch it on in `~/.codex/langsmith.json`, unless your admin already turned it on with a [managed file](#lock-settings-with-a-managed-file). Send traces to an agent with `agent_id`:

```json
{ "enabled": true, "agent_id": "shared-codex" }
```

Or send them to a project with `project`:

```json
{ "enabled": true, "project": "shared-codex" }
```

Use either one, and `agent_id` wins if you set both. With neither set traces go to the `codex` project. Complete a turn and look for it in LangSmith.

A project can override these settings in `<project>/.codex/langsmith.json` or `<project>/langsmith-plugins.json`. You can also share settings across LangSmith plugins in `~/.langsmith-plugins.json`. Your shell beats project files, which beat your own files, which beat the shared one.

> **Check a repository's tracing settings before you trust it.** A cloned repository can switch tracing on and send your conversations and files to someone else's server. Review its LangSmith config files along with `.codex/config.toml` and `.codex/hooks.json`.

### Send a trace to more than one place

Replicas send the same trace to more than one project or workspace, such as a staging copy. List each destination under `replicas` and any field you leave out is inherited:

```json
{
  "enabled": true,
  "replicas": [
    { "project": "project-prod" },
    { "api_key": "lsv2_pt_other_workspace", "project": "project-staging" }
  ]
}
```

Replicas replace the normal destination instead of adding to it. An empty list turns them off.

## What gets traced

Each model call includes the conversation so far and the reply along with the model name, provider, stop reason and token counts. Tool calls, shell commands, file reads and web searches include their inputs and outputs. Subagent threads appear under the turn that started them.

A tool call that touches a file inside a git repo is tagged with the repository name, branch, commit and author. A cancelled turn still uploads.

## Hide a conversation

Send either of these as a normal message with no leading slash and nothing else on the line:

```text
langsmith-tracing:mute
```

```text
langsmith-tracing:unmute
```

The confirmation appears as a prompt blocked by a hook. That's how Codex shows a plugin's reply, so nothing went wrong and the message never reaches the model.

A muted thread keeps its structure in LangSmith but leaves out the content. Muting starts from your next turn, so wait for the confirmation before you send anything sensitive. If no confirmation appears then assume it didn't work.

Muting only changes what reaches LangSmith and doesn't delete earlier uploads. Set `defaultMuted` to `true` to mute every thread by default. A thread you mute or unmute by hand keeps that choice.

## When nothing shows up

- **No runs at all.** Check that the plugin is enabled, its hooks are trusted with `/hooks` and tracing is on. A `TRACE_TO_LANGSMITH` in your shell overrides your config files.
- **Tracing is paused.** Your sign-in expired or your key was rejected. Run `langsmith auth login` again or replace the key and tracing resumes from the next prompt.
- **Stopped after an update.** Codex asks you to trust a hook again whenever a release changes it. Run `/hooks` and approve it.
- **Runs in the wrong project.** Check `project` in your config file and `LANGSMITH_CODEX_PROJECT` in your shell.
- **Still stuck.** The background uploader logs to `~/.codex/langsmith_engine/worker.log`.

## Privacy

With tracing on each turn uploads your messages, tool inputs and outputs, metadata, token usage and subagent structure. A muted turn uploads only the structure.

Secrets are stripped before upload unless you turn `redact` off. This covers API keys, JWTs, PEM blocks and common credential patterns in variables, headers and URLs. Redaction isn't a guarantee, so keep tracing off if none of this can leave your machine.

## Settings

Each setting has a config file key and an environment variable. The `LANGSMITH_CODEX_` name wins over the plain `LANGSMITH_` one.

| Config key           | Environment variable              | Default                           | What it does                            |
| -------------------- | --------------------------------- | --------------------------------- | --------------------------------------- |
| `enabled`            | `TRACE_TO_LANGSMITH`              | `false`                           | Whether to trace at all                 |
| `api_key`            | `LANGSMITH_CODEX_API_KEY`         | none                              | Your LangSmith key                      |
| `project`            | `LANGSMITH_CODEX_PROJECT`         | `codex`                           | Where runs land                         |
| `agent_id`           | `LANGSMITH_AGENT_ID`              | none                              | Agent to trace to, instead of project   |
| `api_url`            | `LANGSMITH_CODEX_ENDPOINT`        | `https://api.smith.langchain.com` | Which server to send to                 |
| `defaultMuted`       | `LANGSMITH_CODEX_DEFAULT_MUTED`   | `false`                           | Leave content out unless told otherwise |
| `redact`             | `LANGSMITH_CODEX_REDACT`          | `true`                            | Strip secrets before upload             |
| `redact_extra_rules` | `LANGSMITH_CODEX_REDACT_EXTRA`    | none                              | Extra patterns to strip                 |
| `metadata`           | `LANGSMITH_CODEX_METADATA`        | none                              | Custom fields on every run              |
| `replicas`           | `LANGSMITH_CODEX_RUNS_ENDPOINTS`  | none                              | Send the same trace somewhere else too  |
| `strict_auth`        | `LANGSMITH_CODEX_STRICT_AUTH`     | `false`                           | Refuse prompts until you sign in again  |
| `notice_cooldown`    | `LANGSMITH_CODEX_NOTICE_COOLDOWN` | `2`                               | Minutes between notices, or `off`       |
| `profile`            | none                              | the CLI's current one             | Which CLI login to use                  |
| `workspace_id`       | none                              | the login's own                   | Workspace for a login's traces          |

`profile` is personal so the managed file can't lock it. `LANGSMITH_PROFILE` and `LANGSMITH_WORKSPACE_ID` are only used when no `profile` or `workspace_id` is set in a settings file.

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
