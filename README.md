# langsmith-codex-plugins

Trace [OpenAI Codex](https://openai.com/codex/) transcripts to LangSmith. Inspect agent turns, tool calls, model metadata and subagent threads within LangSmith.

## Prerequisites

- Node >= 22.x

## Installation

First, add the marketplace to your Codex config, either through CLI or by updating your `~/.codex/config.toml` file.

```bash
codex plugin marketplace add langchain-ai/langsmith-codex-plugins
```

Enable the Tracing plugin and the `features.plugin_hooks` feature in `~/.codex/config.toml` or your project's `.codex/config.toml` file.

```toml
[features]
plugin_hooks = true

[plugins."tracing@langsmith-codex-plugins"]
enabled = true
```

Create a valid LangSmith API key and start tracing your Codex sessions.

```bash
export LANGSMITH_API_KEY=...
export TRACE_TO_LANGSMITH=true
```

### LangSmith API keys

To create an API key:

1. Go to [smith.langchain.com](https://smith.langchain.com).
2. Sign in or create an account.
3. Open **Settings** -> **API Keys**.
4. Click **Create API Key**.
5. Copy the key and set it as `LANGSMITH_API_KEY`, `LANGSMITH_CODEX_API_KEY`, or `api_key` in a local config file.


