# Contributing

Thanks for contributing to the LangSmith Codex plugins repository.

## Prerequisites

- Node.js 22 or later
- [pnpm](https://pnpm.io/) 10.33.0 (the version declared in `package.json`)
- OpenAI Codex 0.153.4 or later with enabled/trusted synchronous plugin hooks
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

Trust/enable the plugin hooks in Codex when prompted. See the README for exact non-slash controls, next-turn semantics, and the released hook-source contract; plugin enablement alone is not hook trust.

Using an absolute path ensures Codex can resolve the marketplace regardless of the directory from which it starts.

Configure LangSmith without committing credentials to the repository. For example:

```bash
export LANGSMITH_CODEX_API_KEY="lsv2_pt_..."
export LANGSMITH_CODEX_PROJECT="codex-local"
export TRACE_TO_LANGSMITH="true"
```

Alternatively, create `~/.langsmith-plugins.json`, `~/.codex/langsmith.json`, a project-root `langsmith-plugins.json`, or a project-local `.codex/langsmith.json` as described in the [README](README.md#setting-environment-variables).

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
pnpm test --run    # Run the full Vitest suite once
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

Privacy tests exercise actual concurrent processes, immutable launch evidence and replay, filesystem failures, and real LangSmith SDK HTTP serialization (non-batched, JSON batch, multipart, and replicas). They do not substitute for a live Codex hook-trust/control smoke test. Do not claim that manual validation unless you performed it.

The configuration tests verify uniform per-field **environment > project `.codex/langsmith.json` > project-root `langsmith-plugins.json` > user `~/.codex/langsmith.json` > home `~/.langsmith-plugins.json` > defaults** precedence for all shared settings. Both project paths are relative to the configured hook `cwd`, with no ancestor search. The shared root filename `langsmith-plugins.json` distinguishes plugin configuration from application tracing configuration. Project/home root `langsmith.json` is ignored (no legacy alias); project/user `.codex/langsmith.json` filenames remain unchanged. Home-root config supports all fields, including credentials, destinations, metadata, redaction, arrays, and independently validated `parent_headers`. The home baseline is read only from `~/.langsmith-plugins.json`; there is no fallback to the old nonhidden `~/langsmith-plugins.json`. This is a lookup rule, not a file blacklist: when the hook `cwd` is the home directory, `~/langsmith-plugins.json` is still the legitimate project-root config, above the hidden home baseline.

All files use the dependency-free canonical helper `plugins/tracing/src/shared-config.ts`, with the Codex adapter opting into `{ envFirst: true }`. The helper's default retains legacy file-first switch behavior for adapters that have not opted in. Metadata merges per key defaults → home root → user → project root → harness → environment, with nested replacement and no clearing via `{}`. Arrays replace; explicit replica `[]` suppresses SDK-only env discovery. Canonical replicas must pass through `toSdkReplicas` at the SDK boundary. Tests cover missing-field fallthrough, malformed/unreadable/dangling files restricting switches unless a higher-priority source sets the field, readable regular symlinks, non-regular files/FIFOs rejected without reading or blocking, invalid ordinary common fields discarding the entire common file layer, and invalid switches restricting only their own field. Environment switches override malformed files independently. Unknown extensions cannot affect common validation; Codex `parent_headers` is validated independently from `raw` and omitted when invalid.

Existing Codex env aliases/parsers (including ordinary whole-layer schema-failure fallback) stay adapter-owned; valid env metadata still merges per key. File switches require strict JSON booleans. Master `TRACE_TO_LANGSMITH` env tests preserve historical trimmed, case-insensitive `true/false`, `1/0`, `yes/no`, and `on/off` aliases (unknown/empty means off; unset falls through to files, then off), including true/false environment values winning over opposite file values. Default-mute env tests remain strict: case-insensitive `true/false`, no trimming or aliases, and any other present value means muted. The Codex-specific variable wins over the standard alias, even if invalid. Policy/hook/lifecycle tests cover absent overrides on new and existing threads, changing defaults, immutable full/metadata/off snapshots, explicit overrides, and descendant/replay safety. Configuration alone owns the default; do not persist or migrate a global default into privacy state. If you normally export `LANGSMITH_*`, `LANGSMITH_CODEX_*`, or `TRACE_TO_LANGSMITH`, run the tests from a shell where those variables are unset.

Keep the `shared-config.ts` contract aligned with the canonical Claude helper (baseline SHA-256 `5e2d0dc374f2311db290ee74c9d3c65b44592496f3d9c4801a6b3d8d9be3b9c0`). The local filesystem race fix opens with `O_NONBLOCK`, validates the opened descriptor with `fstatSync`, and reads that same descriptor; it and its regression fixtures need upstream synchronization. Non-regular files are opened nonblocking and rejected before reading; there is no separate path check before opening. Do not fork the configuration contract or revalidate common fields with a harness schema. Shared fields are `enabled`, `defaultMuted`, `api_key`, `api_url`, `project`, `replicas`, `metadata`, `redact`, and `redact_extra_rules`; harness-only parent settings remain separate.

`config-wire.test.ts` runs the built bundle and real SDK against a local HTTP server: root-file replica URL/auth/project, inherited defaults, empty-array suppression, full custom metadata overlaps, custom regex redaction, and muted metadata removal even with redaction off. It also verifies home-root-only credentials/defaults/metadata, environment switches beating opposite project values, and malformed project files overridden independently by environment switches while home credentials remain usable. Child processes strip inherited tracing variables and use only loopback destinations, never external uploads. Rebuild before running these tests; no trace topology or lifecycle changes belong in config integration.

`plugins/tracing/dist/index.mjs` is committed. Include its updated output when a source change modifies the bundle. The `lint:dist` check rebuilds it and compares against the Git index, so an intentionally unstaged regenerated bundle fails that gate even when current and reproducible. Report this distinctly from formatter/typecheck/test results; do not stage or commit someone else’s work to make the gate pass.

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
