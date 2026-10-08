import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import type {
  CapturedRequest,
  LocalIncrementalServer,
  TestRunRecord,
} from "./models/incremental-delivery.js";
function serverAddress(server: Server) {
  const address = server.address() as AddressInfo | null;
  if (address == null) throw new Error("Local server did not bind an address");
  return `http://127.0.0.1:${address.port}`;
}

function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const contents = Buffer.concat(chunks).toString("utf8");
  return contents.length > 0 ? (JSON.parse(contents) as Record<string, unknown>) : undefined;
}

export async function createLocalServer(): Promise<LocalIncrementalServer> {
  const requests: CapturedRequest[] = [];
  const runs = new Map<string, TestRunRecord>();
  const projects = new Map<string, string>();
  const pendingNotFoundReads = new Map<string, number>();
  const staleRunReads = new Map<string, TestRunRecord>();
  const staleRunReadCounts = new Map<string, number>();
  const projectId = randomUUID();
  let failNextPost = false;
  let failNextPatch = false;
  let loseNextPatchAck = false;
  let staleNextSuccessfulPatchReads = 0;
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const body = await requestBody(request);
      const captured: CapturedRequest = {
        method: request.method ?? "GET",
        pathname: url.pathname,
        ...(body === undefined ? {} : { body }),
      };
      requests.push(captured);
      if (request.method === "GET" && url.pathname === "/sessions") {
        const name = url.searchParams.get("name") ?? "default";
        send(response, 200, { id: projects.get(name) ?? projectId, name });
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        const run = runs.get(id);
        const pendingNotFound = pendingNotFoundReads.get(id) ?? 0;
        if (run === undefined || pendingNotFound > 0) {
          if (pendingNotFound > 0) pendingNotFoundReads.set(id, pendingNotFound - 1);
          send(response, 404, { detail: "missing" });
          return;
        }
        const stale = staleRunReads.get(id);
        if (stale !== undefined) {
          const remaining = staleRunReadCounts.get(id) ?? 1;
          if (remaining <= 1) {
            staleRunReads.delete(id);
            staleRunReadCounts.delete(id);
          } else {
            staleRunReadCounts.set(id, remaining - 1);
          }
          send(response, 200, stale);
          return;
        }
        send(response, 200, run);
        return;
      }
      if (request.method === "POST" && url.pathname === "/runs") {
        if (failNextPost) {
          failNextPost = false;
          send(response, 400, { detail: "synthetic create failure" });
          return;
        }
        const id = String(body?.id);
        if (runs.has(id)) {
          send(response, 409, { detail: "duplicate" });
          return;
        }
        const projectName = String(body?.session_name ?? "default");
        const sessionId = projects.get(projectName) ?? projectId;
        projects.set(projectName, sessionId);
        runs.set(id, {
          ...body,
          id,
          name: String(body?.name),
          run_type: String(body?.run_type),
          session_id: sessionId,
        });
        send(response, 200, {});
        return;
      }
      if (request.method === "PATCH" && url.pathname.startsWith("/runs/")) {
        const id = url.pathname.slice("/runs/".length);
        if (failNextPatch) {
          failNextPatch = false;
          send(response, 400, { detail: "synthetic patch failure" });
          return;
        }
        const current = runs.get(id);
        if (current === undefined) {
          send(response, 404, { detail: "missing" });
          return;
        }
        const updated = { ...current, ...body, id };
        if (loseNextPatchAck) {
          loseNextPatchAck = false;
          staleRunReads.set(id, { ...updated, extra: current.extra });
          staleRunReadCounts.set(id, 1);
          runs.set(id, updated);
          send(response, 409, { detail: "acknowledgement lost" });
          return;
        }
        if (staleNextSuccessfulPatchReads > 0) {
          staleRunReads.set(id, current);
          staleRunReadCounts.set(id, staleNextSuccessfulPatchReads);
          staleNextSuccessfulPatchReads = 0;
        }
        runs.set(id, updated);
        send(response, 200, {});
        return;
      }
      send(response, 404, { detail: "unknown route" });
    })().catch((error: unknown) => {
      response.destroy(error instanceof Error ? error : undefined);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const result: LocalIncrementalServer = {
    apiUrl: serverAddress(server),
    requests,
    runs,
    projectId,
    get failNextPost() {
      return failNextPost;
    },
    set failNextPost(value: boolean) {
      failNextPost = value;
    },
    get failNextPatch() {
      return failNextPatch;
    },
    set failNextPatch(value: boolean) {
      failNextPatch = value;
    },
    get loseNextPatchAck() {
      return loseNextPatchAck;
    },
    set loseNextPatchAck(value: boolean) {
      loseNextPatchAck = value;
    },
    get staleNextSuccessfulPatchReads() {
      return staleNextSuccessfulPatchReads;
    },
    set staleNextSuccessfulPatchReads(value: number) {
      staleNextSuccessfulPatchReads = value;
    },
    hideRunReads(runId, count) {
      pendingNotFoundReads.set(runId, count);
    },
    seedRun(run, projectName) {
      const id = String(run.id);
      projects.set(projectName, projectId);
      const seeded = {
        ...run,
        id,
        name: String(run.name),
        run_type: String(run.run_type),
        session_id: projectId,
      } as TestRunRecord;
      runs.set(id, seeded);
      return seeded;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
  return result;
}
