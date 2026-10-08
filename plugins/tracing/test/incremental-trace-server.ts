import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import type {
  CapturedTraceRequest,
  LocalTraceServer,
  TraceServerRun,
} from "./models/incremental-trace.js";
import { INCREMENTAL_TRACE_TEST } from "./constants/incremental-trace.js";

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

export async function createIncrementalTraceServer(): Promise<LocalTraceServer> {
  const requests: CapturedTraceRequest[] = [];
  const runs = new Map<string, TraceServerRun>();
  const projects = new Map<string, string>();
  const projectId = randomUUID();
  const failPatchRunIds = new Set<string>();
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const body = await readBody(request);
      requests.push({
        method: request.method ?? "GET",
        pathname: url.pathname,
        ...(body === undefined ? {} : { body }),
      });

      if (request.method === "GET" && url.pathname === "/sessions") {
        const name = url.searchParams.get("name") ?? INCREMENTAL_TRACE_TEST.projectName;
        sendJson(response, 200, { id: projects.get(name) ?? projectId, name });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        const run = runs.get(id);
        if (run === undefined) sendJson(response, 404, { detail: "missing" });
        else sendJson(response, 200, run);
        return;
      }

      if (request.method === "POST" && url.pathname === "/runs") {
        const id = String(body?.id);
        if (runs.has(id)) {
          sendJson(response, 409, { detail: "duplicate" });
          return;
        }
        const projectName = String(body?.session_name ?? INCREMENTAL_TRACE_TEST.projectName);
        const sessionId = projects.get(projectName) ?? projectId;
        projects.set(projectName, sessionId);
        runs.set(id, {
          ...body,
          id,
          name: String(body?.name),
          run_type: String(body?.run_type),
          session_id: sessionId,
        });
        sendJson(response, 200, {});
        return;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        if (failPatchRunIds.delete(id)) {
          sendJson(response, 400, { detail: "synthetic patch failure" });
          return;
        }
        const current = runs.get(id);
        if (current === undefined) {
          sendJson(response, 404, { detail: "missing" });
          return;
        }
        runs.set(id, { ...current, ...body, id });
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

  return {
    apiUrl: `http://127.0.0.1:${address.port}`,
    requests,
    runs,
    failPatchRunIds,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
