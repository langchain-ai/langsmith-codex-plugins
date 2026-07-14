# Contributing

Thanks for contributing to the LangSmith Codex plugins repository.

## Prerequisites

- Node.js 22 or later
- [pnpm](https://pnpm.io/) 10.33.0 (the version declared in `package.json`)
- OpenAI Codex 0.128 or later
- A LangSmith account and API key for end-to-end testing

If your Codex installation does not recognize `codex plugin`, update it before continuing:

```bash
npm install --global @openai/codex@latest
```

## Set up the repository

```bash
git clone https://github.com/langchain-ai/langsmith-codex-plugins.git
cd langsmith-codex-plugins
corepack enable
pnpm install
pnpm build
```

The tracing plugin is built from `plugins/tracing/src/` into `plugins/tracing/dist/index.mjs`.

## Run the plugin locally

The repository contains a marketplace manifest at `.agents/plugins/marketplace.json`. Point Codex at your local clone instead of the GitHub marketplace by adding the following to `~/.codex/config.toml`. Replace the example path with the absolute path to your clone:

```toml
[marketplaces.langsmith-codex-plugins]
source_type = "local"
source = "/absolute/path/to/langsmith-codex-plugins"

[features]
plugin_hooks = true

[plugins."tracing@langsmith-codex-plugins"]
enabled = true
```

Using an absolute path ensures Codex can resolve the marketplace regardless of the directory from which it starts.

Configure LangSmith without committing credentials to the repository. For example:

```bash
export LANGSMITH_CODEX_API_KEY="lsv2_pt_..."
export LANGSMITH_CODEX_PROJECT="codex-local"
export TRACE_TO_LANGSMITH="true"
```

Alternatively, create `~/.codex/langsmith.json` or a project-local `.codex/langsmith.json` as described in the [README](README.md#setting-environment-variables).

Start a new Codex session from any project, complete a turn, and check the `codex-local` project in LangSmith. The tracing hook runs when the turn stops.

### Test local changes

Codex caches installed plugins by version. After each source change, rebuild the hooks and remove the local marketplace cache:

```bash
pnpm build
rm -rf ~/.codex/plugins/cache/langsmith-codex-plugins
```

Then start a new Codex session and complete another turn. Existing sessions do not reload rebuilt hooks.

For a release, bump `version` in `plugins/tracing/.codex-plugin/plugin.json` instead. A new version invalidates the plugin cache for everyone, so users do not need to remove it manually.

## Development commands

```bash
pnpm test          # Run the Vitest suite
pnpm format        # Format files with oxfmt
pnpm lint          # Check formatting, types, and the committed bundle
pnpm build         # Rebuild plugins/tracing/dist/index.mjs
```

Before submitting a pull request, run:

```bash
pnpm format
pnpm test
pnpm lint
```

The configuration tests verify environment-variable precedence. If you normally export `LANGSMITH_*`, `LANGSMITH_CODEX_*`, or `TRACE_TO_LANGSMITH`, run the tests from a shell where those variables are unset.

`plugins/tracing/dist/index.mjs` is committed. Include its updated output when a source change modifies the bundle. The `lint:dist` check rebuilds it and fails if the committed bundle is stale.

## Repository layout

- `.agents/plugins/marketplace.json` — local marketplace definition
- `plugins/tracing/.codex-plugin/plugin.json` — plugin metadata and version
- `plugins/tracing/hooks/hooks.json` — Codex lifecycle hook definition
- `plugins/tracing/src/` — TypeScript source
- `plugins/tracing/test/` — tests and transcript fixtures
- `plugins/tracing/dist/index.mjs` — bundled hook executed by Codex

The hook reads its event from standard input and is invoked by Codex with `PLUGIN_ROOT` pointing at the installed plugin directory. Keep runtime dependencies bundled or otherwise available from that directory.

## Making changes

- Follow the existing TypeScript style and keep strict type checking enabled.
- Add or update tests for behavior changes.
- Do not include real API keys, credentials, or sensitive transcript data in fixtures.
- Keep secret-redaction behavior enabled during end-to-end testing unless the test specifically covers its configuration.
- Update the README when changing installation, configuration, or user-visible behavior.
- Update the plugin version in `plugins/tracing/.codex-plugin/plugin.json` when preparing a release; the version is injected into the bundle at build time.

## Pull requests

Keep pull requests focused and describe:

1. What changed and why.
2. How the change was tested.
3. Any configuration, trace-shape, privacy, or compatibility impact.

By contributing, you agree that your contribution is provided under this repository's [MIT License](LICENSE).
