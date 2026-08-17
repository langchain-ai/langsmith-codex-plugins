import { Client, type Run } from "langsmith";

export async function getAssumedTreeFromCalls(
  calls: unknown[][],
  client: Client,
): Promise<{
  nodes: string[];
  edges: Array<[string, string]>;
  data: Record<string, Run>;
}> {
  await client.awaitPendingTraceBatches();

  const edges: Array<[string, string]> = [];

  const nodeMap: Record<string, Run> = {};
  const idMap: string[] = [];

  function upsertId(id: string) {
    const idx = idMap.indexOf(id);
    if (idx < 0) {
      idMap.push(id);
      return idMap.length - 1;
    }
    return idx;
  }

  for (let i = 0; i < calls.length; ++i) {
    const call = calls[i];

    const [url, fetchArgs] = call.slice(-2) as [string, { method: string; body: string }];
    const req = `${fetchArgs.method} ${new URL(url as string).pathname}`;
    let body: Run;
    if (typeof fetchArgs.body === "string") {
      body = JSON.parse(fetchArgs.body);
    } else {
      const decoded = new TextDecoder().decode(fetchArgs.body);
      if (decoded.trim().startsWith("{")) {
        body = JSON.parse(decoded);
      }
    }

    if (req === "POST /runs" || req === "POST /api/v1/runs") {
      const id = body!.id;
      upsertId(id);
      nodeMap[id] = { ...nodeMap[id], ...body! };
      if (nodeMap[id].parent_run_id) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        edges.push([nodeMap[id].parent_run_id!, nodeMap[id].id]);
      }
    } else if (req.startsWith("PATCH /runs/") || req.startsWith("PATCH /api/v1/runs/")) {
      const id = req.substring(
        req.startsWith("PATCH /api/v1/runs/")
          ? "PATCH /api/v1/runs/".length
          : "PATCH /runs/".length,
      );
      upsertId(id);
      nodeMap[id] = { ...nodeMap[id], ...body! };
    }
  }

  function getExecutionOrder(run: Run) {
    const order = run.dotted_order
      ?.split(".")
      .at(-1)
      ?.match(/^\d{8}T\d{9}(\d{3})Z/)?.[1];
    if (order == null) return undefined;
    const parsed = Number(order);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const orderedIds = [...idMap].sort((left, right) => {
    const leftOrder = getExecutionOrder(nodeMap[left]);
    const rightOrder = getExecutionOrder(nodeMap[right]);
    if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
    if (leftOrder != null) return -1;
    if (rightOrder != null) return 1;
    return idMap.indexOf(left) - idMap.indexOf(right);
  });
  const orderedIdMap = new Map(orderedIds.map((id, index) => [id, index]));

  function getId(id: string) {
    const name = nodeMap[id].name;
    return [name, orderedIdMap.get(id)].join(":");
  }

  return {
    nodes: orderedIds.map(getId),
    edges: [...edges]
      .sort(([, left], [, right]) => (orderedIdMap.get(left) ?? 0) - (orderedIdMap.get(right) ?? 0))
      .map(([source, target]) => [getId(source), getId(target)]),
    data: Object.fromEntries(orderedIds.map((id) => [getId(id), nodeMap[id]] as const)),
  };
}

type MagicRunResult = {
  name: string;
  [key: string]: unknown;
};

type MagicRun = (
  rawName: TemplateStringsArray,
) => (props: Record<string, unknown>, ...children: string[]) => string;

export function asTree(cb: (run: MagicRun) => void): {
  nodes: string[];
  edges: Array<[string, string]>;
  data: Record<string, unknown>;
} {
  const acc: {
    nodes: string[];
    edges: Array<[string, string]>;
    data: Record<string, MagicRunResult>;
  } = { nodes: [], edges: [], data: {} };

  function run(rawId: TemplateStringsArray) {
    const id = rawId.join("");
    const name = id.split(":")[0];

    acc.nodes.push(id);
    return (props: Record<string, unknown>, ...children: string[]): string => {
      for (const childId of children) acc.edges.push([id, childId]);
      acc.data[id] = { name, ...props };
      return id;
    };
  }

  cb(run);
  const nodeOrder = new Map(acc.nodes.map((id, idx) => [id, idx]));

  return {
    ...acc,
    edges: [...acc.edges].sort(
      ([, left], [, right]) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0),
    ),
  };
}
