# Contributing

Thanks for contributing to the LangSmith tracing plugin for OpenAI Codex.

## Setup

You need Node 22 or newer, pnpm which `package.json` pins, and a LangSmith API key for end to end
testing. Codex has to be 0.153.4 or newer for the synchronous plugin hooks this depends on, so run
`npm install --global @openai/codex@latest` if your Codex does not recognize `codex plugin`.

```bash
corepack enable
pnpm install
pnpm build
```

## Layout

Everything ships from `plugins/tracing`, where `src/` is the TypeScript, `test/` holds the suites
and their transcript fixtures, `hooks/hooks.json` declares the Codex lifecycle hook and
`.codex-plugin/plugin.json` carries the plugin metadata and version. The hook reads its event from
standard input and Codex invokes it with `PLUGIN_ROOT` pointing at the installed plugin directory,
so keep runtime dependencies bundled rather than resolved from a `node_modules` that will not be
there. `src/shared-config.ts` is shared with the Claude Code plugin and has to stay byte for byte
identical to it, so report bugs in it upstream instead of forking it here.

## The committed bundle is what actually runs

`pnpm build` bundles the source into `plugins/tracing/dist/index.mjs`, which is committed and is
what Codex executes. Edit source, rebuild and commit the result, since `pnpm lint` regenerates the
bundle and compares it against the Git index so even a current and reproducible bundle fails that
gate while it is unstaged.

## Run it against a real session

Point Codex at your clone instead of the GitHub marketplace by putting the absolute path to it in
`~/.codex/config.toml`, which lets Codex resolve the marketplace whatever directory it starts from:

```toml
[marketplaces.langsmith-codex-plugins]
source_type = "local"
source = "/absolute/path/to/langsmith-codex-plugins"

[plugins."tracing@langsmith-codex-plugins"]
enabled = true
```

Trust the hooks when Codex prompts since enabling the plugin is not the same as trusting them, then
set `TRACE_TO_LANGSMITH`, `LANGSMITH_CODEX_API_KEY` and `LANGSMITH_CODEX_PROJECT` in your shell or
use one of the config files the README lists. Finish a turn in any project and the trace lands
there, since the hook runs when the turn stops.

Codex caches installed plugins by version, so after each source change rebuild and then run
`rm -rf ~/.codex/plugins/cache/langsmith-codex-plugins` before starting a fresh session. Existing
sessions never reload rebuilt hooks.

## Dev loop

```bash
pnpm build       # rebuild plugins/tracing/dist/index.mjs
pnpm test --run  # the full Vitest suite once
pnpm format      # oxfmt
pnpm lint        # formatting, types, install.sh and the committed bundle
```

Run all three before you open a pull request. The tests read real configuration, so run them from
a shell where `LANGSMITH_*`, `LANGSMITH_CODEX_*` and `TRACE_TO_LANGSMITH` are unset or they pick
your values up. Nothing automated covers a live Codex hook-trust check, so do not claim that
validation unless you performed it.

## Standalone binary

The build, the signing, the installer and the updater all come from
[langsmith-plugin-binary](https://github.com/langchain-ai/langsmith-plugin-binary) driven by
`binary.config.json`, so go to that repository for how any of it works, and change those settings
and rerun `pnpm installer` rather than editing `install.sh` by hand. Building needs
[Bun](https://bun.com). The Build Binary workflow pins that package by commit SHA while
`devDependencies` pins it by tag, so move both in one change or `build-binary.test.ts` fails.

Publishing is manual. Tag the release and run the Build Binary workflow from the Actions tab
against that tag and it attaches both macOS builds to that tag's GitHub Release as a draft.

## Pull requests

There is no publish step for the plugin itself, so merging to `main` is what ships it. Bump
`version` in `plugins/tracing/.codex-plugin/plugin.json` for a release since a new version is what
invalidates everyone's plugin cache.

Keep a pull request focused and say what changed and why, how you tested it, and any configuration,
trace shape, privacy or compatibility impact. Cover behaviour changes with tests, keep real
credentials and sensitive transcripts out of fixtures, and update the README when installation,
configuration or user-visible behaviour changes.

By contributing you agree that your contribution is provided under this repository's
[MIT License](LICENSE).
