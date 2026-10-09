import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import type {
  CapturedTraceRequest,
  LocalTraceServer,
  LocalTraceServerOptions,
  TraceServerRun,
} from "./models/incremental-trace.js";
import { INCREMENTAL_TRACE_TEST, TRACE_WRITE_METHODS } from "./constants/incremental-trace.js";

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : undefined;
}

export async function createIncrementalTraceServer(
  options: LocalTraceServerOptions = {},
): Promise<LocalTraceServer> {
  const requests: CapturedTraceRequest[] = [];
  const runs = new Map<string, TraceServerRun>();
  const runAttempts = new Map<string, TraceServerRun[]>();
  const projects = new Map<string, string>();
  const projectId = randomUUID();
  const projectReads: string[] = [];
  const conflicts: string[] = [];
  const pendingNotFoundReads = new Map<string, number>();
  const staleRunReads = new Map<string, TraceServerRun>();
  const staleRunReadCounts = new Map<string, number>();
  const failPatchRunIds = new Set<string>();
  let failWrites = false;
  let delayMs = 0;
  const getProjectId = (name: string) => {
    const id = projects.get(name) ?? options.projectIdForName?.(name) ?? projectId;
    projects.set(name, id);
    return id;
  };
  const storeRun = (value: Record<string, unknown>, projectName: string) => {
    const id = String(value.id);
    const run = {
      ...value,
      id,
      name: String(value.name),
      run_type: String(value.run_type),
      session_id: getProjectId(projectName),
    } as TraceServerRun;
    runs.set(id, run);
    return run;
  };
  const findRun = (id: string) => {
    const run = runs.get(id);
    const pendingNotFound = pendingNotFoundReads.get(id) ?? 0;
    if (run === undefined || pendingNotFound > 0) {
      if (pendingNotFound > 0) pendingNotFoundReads.set(id, pendingNotFound - 1);
      return undefined;
    }
    const stale = staleRunReads.get(id);
    if (stale === undefined) return run;
    const remaining = staleRunReadCounts.get(id) ?? 1;
    if (remaining <= 1) {
      staleRunReads.delete(id);
      staleRunReadCounts.delete(id);
    } else {
      staleRunReadCounts.set(id, remaining - 1);
    }
    return stale;
  };
  const server = createServer((request, response) => {
    void (async () => {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const url = new URL(request.url ?? "/", "http://localhost");
      const body = await readBody(request);
      requests.push({
        method: request.method ?? "GET",
        pathname: url.pathname,
        ...(body === undefined ? {} : { body }),
      });

      if (request.method === "GET" && url.pathname === "/sessions") {
        const name =
          url.searchParams.get("name") ??
          options.defaultProjectName ??
          INCREMENTAL_TRACE_TEST.projectName;
        projectReads.push(name);
        sendJson(response, 200, { id: getProjectId(name), name });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        const run = findRun(id);
        sendJson(response, run === undefined ? 404 : 200, run ?? { detail: "missing" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/runs") {
        const id = String(body?.id);
        const attempts = runAttempts.get(id) ?? [];
        attempts.push(body as TraceServerRun);
        runAttempts.set(id, attempts);
        if (result.failNextPost || failWrites) {
          result.failNextPost = false;
          sendJson(response, 400, { detail: "synthetic create failure" });
          return;
        }
        if (runs.has(id)) {
          conflicts.push(id);
          sendJson(response, 409, { detail: "duplicate" });
          return;
        }
        const projectName = String(
          body?.session_name ??
            body?.project_name ??
            options.defaultProjectName ??
            INCREMENTAL_TRACE_TEST.projectName,
        );
        storeRun(body ?? {}, projectName);
        sendJson(response, options.postStatus ?? 200, {});
        return;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        const failNextPatch = result.failNextPatch;
        result.failNextPatch = false;
        if (failNextPatch || failPatchRunIds.delete(id)) {
          sendJson(response, 400, { detail: "synthetic patch failure" });
          return;
        }
        const current = runs.get(id);
        if (current === undefined) {
          sendJson(response, 404, { detail: "missing" });
          return;
        }
        const updated = { ...current, ...body, id };
        if (result.loseNextPatchAck) {
          result.loseNextPatchAck = false;
          staleRunReads.set(id, { ...updated, extra: current.extra });
          staleRunReadCounts.set(id, 1);
          runs.set(id, updated);
          sendJson(response, 409, { detail: "acknowledgement lost" });
          return;
        }
        if (result.staleNextSuccessfulPatchReads > 0) {
          staleRunReads.set(id, current);
          staleRunReadCounts.set(id, result.staleNextSuccessfulPatchReads);
          result.staleNextSuccessfulPatchReads = 0;
        }
        runs.set(id, updated);
        sendJson(response, 200, {});
        return;
      }

      sendJson(response, 404, { detail: "unknown route" });
    })().catch((error: unknown) => {
      response.destroy(error instanceof Error ? error : undefined);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo | null;
  if (address == null) throw new Error("Local trace server did not bind an address");

  const result: LocalTraceServer = {
    apiUrl: `http://127.0.0.1:${address.port}`,
    requests,
    requestsFor: (method, pathname) =>
      requests.filter(
        (request) =>
          (method === undefined
            ? TRACE_WRITE_METHODS.some((writeMethod) => request.method === writeMethod)
            : request.method === method) &&
          (pathname === undefined || request.pathname === pathname),
      ),
    runs,
    runAttempts,
    projectId,
    projectReads,
    conflicts,
    failPatchRunIds,
    failNextPost: false,
    failNextPatch: false,
    loseNextPatchAck: false,
    staleNextSuccessfulPatchReads: 0,
    hideRunReads(runId, count) {
      pendingNotFoundReads.set(runId, count);
    },
    seedRun(run, projectName) {
      return storeRun(run, projectName);
    },
    setFailWrites(value) {
      failWrites = value;
    },
    setDelayMs(value) {
      delayMs = value;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
  return result;
}
