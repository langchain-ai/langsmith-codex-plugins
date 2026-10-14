import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client as SDKClient, RunTreeConfig } from "langsmith";

// No SDK mocks: capture only the HTTP boundary, after SDK enrichment and anonymization.
type Status = "running" | "completed" | "error";
type Payload = Record<string, any>;
type Operation = { action: "post" | "patch"; payload: Payload };
type RequestBody = { url: URL; method: string; raw: string; operations: Operation[] };

const API = "http://privacy.test";
const FORBIDDEN = "FORBIDDEN_PRIVACY_MARKER";
const REVISION = `${FORBIDDEN}_revision`;
const WORKSPACE = `${FORBIDDEN}_workspace`;
const CI_SHA = `${FORBIDDEN}_ci`;
const SECRET = "custom-sensitive-model-name";
const REDACTED = "[private-model]";

let Client: typeof import("langsmith").Client;
let RunTree: typeof import("langsmith").RunTree;
let buildCodingAgentMetadata: typeof import("@langchain/plugins-base/metadata").buildCodingAgentMetadata;
let createRunTree: typeof import("../src/privacy.js").createRunTree;
let createSecretAnonymizer: typeof import("langsmith/anonymizer").createSecretAnonymizer;
let clients: Set<SDKClient>;
let requests: RequestBody[];

const allowedUsage = {
  input_tokens: 2,
  output_tokens: 3,
  total_tokens: 5,
  costs: { input: 0.25, total: 0.75, currency: "USD" },
  input_token_details: { cache_read: 1, video: { frames: 12, annotation: "estimated" } },
  output_token_details: { new_modality: { units: 4, empty: {} } },
  annotations: ["ALLOWED_USAGE_MARKER", false, null, { nested: [1, "note", {}] }],
  custom: "ALLOWED_USAGE_CUSTOM",
};

const allowedMetadata = {
  thread_id: "thread",
  turn_id: "turn",
  turn_number: 2,
  ls_agent_type: "root",
  ls_agent_purpose: "coding",
  ls_agent_runtime: "Codex",
  ls_agent_runtime_version: "test-runtime",
  ls_integration: "openai-codex",
  ls_integration_version: "test-integration",
  ls_trace_schema_version: "coding-agent-v1",
  ls_model_name: SECRET,
  ls_tool_name: "exec_command",
  ls_skill_name: "widget-report",
  usage_metadata: allowedUsage,
  ls_raw_aggregated_usage: allowedUsage,
  ls_subagent_id: "subagent",
  ls_subagent_type: "Explore",
};

function withTrustedMetadata(
  untrusted: Record<string, unknown>,
  structural: Record<string, unknown>,
): Record<string, unknown> {
  const source = { ...untrusted, ...structural };
  const providerMetadata = Object.fromEntries(
    [
      "ls_provider",
      "ls_model_type",
      "ls_message_format",
      "codex_cli_version",
      "ls_raw_aggregated_usage",
      "ls_invocation_params",
    ].flatMap((key) => (source[key] === undefined ? [] : [[key, source[key]]])),
  );
  const base = { ...source };
  for (const key of [
    "ls_agent_purpose",
    "ls_agent_type",
    "ls_integration",
    "ls_agent_runtime",
    "ls_trace_schema_version",
    "thread_id",
    "ls_integration_version",
    "ls_agent_runtime_version",
    "turn_id",
    "turn_number",
    "approval_policy",
    "ls_subagent_id",
    "ls_subagent_type",
    "ls_tool_name",
    "ls_skill_name",
    "ls_model_name",
    "usage_metadata",
    ...Object.keys(providerMetadata),
  ]) {
    delete base[key];
  }
  return buildCodingAgentMetadata({
    integration: "openai-codex",
    integrationVersion:
      typeof source.ls_integration_version === "string" ? source.ls_integration_version : undefined,
    runtimeVersion:
      typeof source.ls_agent_runtime_version === "string"
        ? source.ls_agent_runtime_version
        : undefined,
    threadId: typeof source.thread_id === "string" ? source.thread_id : "thread",
    turnId: typeof source.turn_id === "string" ? source.turn_id : undefined,
    turnNumber: typeof source.turn_number === "number" ? source.turn_number : undefined,
    agentType: source.ls_agent_type === "subagent" ? "subagent" : "root",
    runType: "root",
    approvalPolicy: typeof source.approval_policy === "string" ? source.approval_policy : undefined,
    subagentId: typeof source.ls_subagent_id === "string" ? source.ls_subagent_id : undefined,
    subagentType: typeof source.ls_subagent_type === "string" ? source.ls_subagent_type : undefined,
    toolName: typeof source.ls_tool_name === "string" ? source.ls_tool_name : undefined,
    runName: "openai.codex.tool",
    skillName: typeof source.ls_skill_name === "string" ? source.ls_skill_name : undefined,
    modelName: typeof source.ls_model_name === "string" ? source.ls_model_name : undefined,
    usageMetadata:
      source.usage_metadata != null && typeof source.usage_metadata === "object"
        ? (source.usage_metadata as Record<string, unknown>)
        : undefined,
    providerMetadata,
    base,
  });
}

const captureFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  expect(url.origin).toBe(API);
  if (url.pathname === "/info") return Response.json({});
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const raw = init?.body != null ? await new Response(init.body).text() : "";
  expect(method).toMatch(/^(POST|PATCH)$/);
  expect(url.pathname).toMatch(/\/runs(?:\/[\da-f-]+)?$/);
  requests.push({
    url,
    method,
    raw,
    operations: [{ action: method === "POST" ? "post" : "patch", payload: JSON.parse(raw) }],
  });
  return Response.json({});
};

beforeEach(async () => {
  // getRuntimeEnvironment/getShas and Client metadata are cached by the SDK.
  // Install markers BEFORE importing/constructing any real SDK objects, and
  // isolate its shared client/cache from other cases (and ambient tracing env).
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    if (/^(LANGCHAIN_|LANGSMITH_|CC_LANGSMITH_)|^TRACE_TO_LANGSMITH$/.test(key))
      vi.stubEnv(key, undefined);
  }
  vi.stubEnv("LANGCHAIN_REVISION_ID", REVISION);
  vi.stubEnv("LANGSMITH_WORKSPACE_ID", WORKSPACE);
  vi.stubEnv("CI_COMMIT_SHA", CI_SHA);
  vi.stubEnv("LANGSMITH_ENDPOINT", API);
  vi.stubEnv("LANGSMITH_API_KEY", "test-only-key");
  vi.stubEnv("LANGSMITH_TRACING_MODE", "langsmith");
  vi.stubEnv("LANGSMITH_TRACING_SAMPLING_RATE", "1");
  vi.stubEnv("LANGSMITH_CODEX_INTEGRATION_VERSION", "plugin-version");
  vi.stubGlobal("fetch", captureFetch);
  clients = new Set();
  requests = [];
  ({ Client, RunTree } = await import("langsmith"));
  ({ buildCodingAgentMetadata } = await import("@langchain/plugins-base/metadata"));
  ({ createRunTree } = await import("../src/privacy.js"));
  ({ createSecretAnonymizer } = await import("langsmith/anonymizer"));
});

afterEach(async () => {
  try {
    await Promise.all([...clients].map((client) => client.flush()));
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

function makeClient(): SDKClient {
  const client = new Client({
    apiUrl: API,
    apiKey: "test-only-key",
    autoBatchTracing: false,
    blockOnRootRunFinalization: false,
    tracingSamplingRate: 1,
    hideMetadata: createSecretAnonymizer({ extraRules: [{ pattern: SECRET, replace: REDACTED }] }),
    anonymizer: createSecretAnonymizer({ extraRules: [{ pattern: SECRET, replace: REDACTED }] }),
    fetchImplementation: captureFetch,
  });
  clients.add(client);
  return client;
}

function config(
  client?: SDKClient,
  status: Status = "running",
  id: string = randomUUID(),
): RunTreeConfig {
  return {
    client,
    id,
    trace_id: id,
    dotted_order: `20250101T000000000000Z${id}`,
    name: "privacy integration",
    run_type: "chain",
    project_name: "primary",
    start_time: "2025-01-01T00:00:00Z",
    ...(status !== "running" ? { end_time: "2025-01-01T00:00:01Z" } : {}),
    ...(status === "error" ? { error: `${FORBIDDEN}_raw_error` } : {}),
    inputs: { prompt: `${FORBIDDEN}_input` },
    outputs: { answer: `${FORBIDDEN}_output` },
    tags: [`${FORBIDDEN}_tag`],
    serialized: { private: `${FORBIDDEN}_serialized` },
    extra: {
      private: `${FORBIDDEN}_extra`,
      runtime: { custom: `${FORBIDDEN}_runtime` },
      metadata: withTrustedMetadata(
        {
          ...allowedMetadata,
          cwd: `${FORBIDDEN}_cwd`,
          repository_name: `${FORBIDDEN}_repository`,
          user_id: `${FORBIDDEN}_identity`,
          ls_invocation_params: { private: FORBIDDEN },
          custom: FORBIDDEN,
        },
        allowedMetadata,
      ),
    },
  };
}

async function flush(): Promise<void> {
  await Promise.all([...clients].map((client) => client.flush()));
}

function expectOperations(expectedRequests: number): Operation[] {
  expect(requests).toHaveLength(expectedRequests);
  return requests.flatMap((request) => request.operations);
}

function expectMutedContent(payload: Payload, excludeInputs = false): void {
  if (excludeInputs) {
    expect.soft(payload.inputs).toBeUndefined();
  } else {
    expect.soft(payload.inputs).toEqual({
      messages: [
        {
          role: "user",
          content: "[LangSmith system notice: content omitted because tracing is muted.]",
        },
      ],
    });
  }
  expect.soft(payload.outputs).toEqual({
    messages: [
      {
        role: "assistant",
        content: "[LangSmith system notice: content omitted because tracing is muted.]",
      },
    ],
  });
}

describe("real SDK privacy for run trees the plugin creates", () => {
  it("rejects custom allowlist collisions and parent baggage at the wire", async () => {
    const client = makeClient();
    const parent = new RunTree({
      name: "external",
      client,
      extra: { metadata: { ls_model_name: FORBIDDEN, ls_subagent_type: FORBIDDEN } },
    });
    const initial = config(client);
    initial.extra = {
      metadata: buildCodingAgentMetadata({
        integration: "openai-codex",
        threadId: "trusted-thread",
        agentType: "root",
        runType: "root",
        base: { ls_subagent_type: FORBIDDEN },
      }),
    };
    const run = createRunTree(initial, "metadata", parent);
    await run.postRun();
    await flush();
    const [operation] = expectOperations(1);
    expect(operation.payload.parent_run_id).toBe(parent.id);
    expect(operation.payload.extra).toEqual({
      metadata: {
        ls_agent_purpose: "coding",
        ls_agent_type: "root",
        ls_integration: "openai-codex",
        ls_agent_runtime: "Codex",
        ls_trace_schema_version: "coding-agent-v1",
        thread_id: "trusted-thread",
        status: "running",
        ls_tracing_mode: "metadata",
      },
    });
    expect(JSON.stringify(operation)).not.toContain(FORBIDDEN);
  });

  it("keeps a metadata child private under a full-mode parent", async () => {
    const client = makeClient();
    const parent = createRunTree(config(client), "full");
    const child = createRunTree(config(client), "metadata", parent);
    await child.postRun();
    await flush();
    const [operation] = expectOperations(1);
    expectMutedContent(operation.payload);
    expect(operation.payload.extra.metadata).toMatchObject({
      ls_agent_purpose: "coding",
      ls_integration: "openai-codex",
      thread_id: "thread",
      ls_tracing_mode: "metadata",
    });
    expect(JSON.stringify(operation)).not.toContain(FORBIDDEN);
    expect(JSON.stringify(operation)).not.toContain(SECRET);
    const serializedChild = parent.toJSON().child_runs?.[0];
    expect(serializedChild).toBeDefined();
    expectMutedContent(serializedChild!);
    expect(JSON.stringify(serializedChild!)).not.toContain(FORBIDDEN);
  });

  it("keeps patch inputs and outputs muted", async () => {
    await createRunTree(config(makeClient(), "completed"), "metadata").patchRun();
    await flush();
    const [operation] = expectOperations(1);
    expect(operation.action).toBe("patch");
    expectMutedContent(operation.payload);
    expect(requests[0].raw).not.toContain(FORBIDDEN);
  });
});
