# ls-codex

Utilities for turning OpenAI Codex rollout transcripts into LangSmith run trees.

## What This Repo Does

The code in `src/` reads Codex JSONL rollout files, validates each line with Zod, reconstructs turns, and uploads them to LangSmith in a message-oriented format.

Current behavior includes:

- Parsing `session_meta`, `turn_context`, `response_item`, `event_msg`, and related rollout records
- Converting Codex messages, tool calls, tool outputs, and reasoning items into LangSmith-compatible messages
- Grouping a task between `task_started` and `task_complete` or `turn_aborted`
- Attaching usage metadata from token count events
- Resolving spawned subagent threads by locating their rollout files and nesting them under the parent run

## Key Files

- `src/schema.mts`: Zod schemas for supported rollout line types
- `src/upload.mts`: rollout parser and LangSmith run tree conversion
- `src/hook.mts`: stdin hook entrypoint that receives a Codex hook payload and uploads the referenced transcript
- `codex-sample/`: sample rollout files for editing, attachments, and subagent scenarios

## Hook Input

`src/hook.mts` expects a JSON payload on stdin shaped like:

```json
{
  "session_id": "string",
  "turn_id": "string | null",
  "transcript_path": "/absolute/path/to/rollout.jsonl",
  "hook_event_name": "UserPromptSubmit"
}
```

The hook reads `transcript_path`, converts the transcript into one or more LangSmith runs, then flushes the queued uploads.

## Conversion Notes

- Developer messages are normalized to `system`
- Assistant messages are normalized to `ai`
- Function and custom tool calls are emitted as tool-call content blocks
- Tool outputs are emitted as `tool` role messages
- Multiple adjacent messages from the same role are merged
- The root run is named `openai.codex`, with per-response child runs named `openai.codex.turn`

## Repository Status

The source code in this repository is focused on transcript conversion, but the package metadata and scripts are still placeholder-level. In particular, `package.json` still describes a different sample app and does not yet provide a real build or run command for the `.mts` sources.

Use `codex-sample/` as the reference input set while wiring the execution flow and packaging around the converter.
