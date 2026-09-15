// Frozen literals for the Codex integration (see validator.json).

/** What the traced agent is for, per the coding-agent-v1 contract. */
export const LS_AGENT_PURPOSE = "coding";

/** Identifies this plugin as the trace source. */
export const LS_INTEGRATION = "openai-codex";

/** Display name of the harness the trace came from. */
export const LS_AGENT_RUNTIME = "Codex";

/** Metadata contract the emitted runs conform to. */
export const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";

// Plugin version, injected at build time via bundler `define`.
// `typeof` guards the case where the define was not applied.
declare const __LS_INTEGRATION_VERSION__: string;

/** Plugin version, or undefined outside a bundled build. */
export const LS_INTEGRATION_VERSION: string | undefined =
  typeof __LS_INTEGRATION_VERSION__ === "string" && __LS_INTEGRATION_VERSION__.length > 0
    ? __LS_INTEGRATION_VERSION__
    : undefined;
