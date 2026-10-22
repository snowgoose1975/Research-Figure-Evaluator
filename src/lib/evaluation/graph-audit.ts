import type { GraphAudit, GraphEdgeRecord, MemoryRecord } from "../schemas";

const NOTE = "This audit compares extracted A/B records only; it has no source-image ground truth. Opposing directed records are candidates only and may already both appear in the source image.";

function normalizeLabel(label: string): string {
  return label.normalize("NFKC").toLocaleLowerCase().replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-").trim().replace(/\s+/g, " ");
}

type NodeIndex = { unique: Map<string, string>; duplicateKeys: Set<string>; nodesById: Map<string, string>; unmatched: string[] };

function indexNodes(memory: MemoryRecord): NodeIndex {
  const labels = new Map<string, string[]>();
  const nodesById = new Map<string, string>();
  for (const node of memory.graph.nodes) {
    const key = normalizeLabel(node.label);
    nodesById.set(node.id, node.label);
    if (!key) continue;
    labels.set(key, [...(labels.get(key) ?? []), node.label]);
  }
  const unique = new Map<string, string>();
  const duplicateKeys = new Set<string>();
  const unmatched: string[] = [];
  for (const [key, names] of labels) {
    if (names.length === 1) unique.set(key, names[0]);
    else duplicateKeys.add(key);
  }
  for (const node of memory.graph.nodes) {
    const key = normalizeLabel(node.label);
    if (!key || duplicateKeys.has(key)) unmatched.push(node.label);
  }
  return { unique, duplicateKeys, nodesById, unmatched };
}

function edgeRecord(source: string, target: string, relation: MemoryRecord["graph"]["relations"][number]): GraphEdgeRecord {
  return { source, target, kind: relation.kind, direction: relation.direction, line_style: relation.line_style, evidence_status: relation.evidence_status };
}

function edgeKey(edge: GraphEdgeRecord): string {
  return JSON.stringify([edge.source, edge.target, edge.kind, edge.direction, edge.line_style, edge.evidence_status]);
}

function canonicalEdges(memory: MemoryRecord, index: NodeIndex, canonical: NodeIndex, matched?: Set<string>): GraphEdgeRecord[] {
  const result: GraphEdgeRecord[] = [];
  for (const relation of memory.graph.relations) {
    const sourceOriginal = index.nodesById.get(relation.source_id);
    const targetOriginal = index.nodesById.get(relation.target_id);
    if (sourceOriginal === undefined || targetOriginal === undefined) continue;
    const sourceKey = normalizeLabel(sourceOriginal);
    const targetKey = normalizeLabel(targetOriginal);
    const source = index.unique.get(sourceKey);
    const target = index.unique.get(targetKey);
    const canonicalSource = canonical.unique.get(sourceKey);
    const canonicalTarget = canonical.unique.get(targetKey);
    if (!source || !target || !canonicalSource || !canonicalTarget) continue;
    if (matched && (!matched.has(sourceKey) || !matched.has(targetKey))) continue;
    const endpoints = relation.direction === "undirected" && sourceKey > targetKey
      ? [canonicalTarget, canonicalSource] as const
      : [canonicalSource, canonicalTarget] as const;
    result.push(edgeRecord(endpoints[0], endpoints[1], relation));
  }
  return result;
}

function countEdges(edges: GraphEdgeRecord[]): Map<string, { edge: GraphEdgeRecord; count: number }> {
  const counts = new Map<string, { edge: GraphEdgeRecord; count: number }>();
  for (const edge of edges) {
    const key = edgeKey(edge);
    const found = counts.get(key);
    if (found) found.count += 1;
    else counts.set(key, { edge, count: 1 });
  }
  return counts;
}

function opposingEdges(edges: GraphEdgeRecord[]): GraphEdgeRecord[] {
  const byDirectedKind = new Set(edges
    .filter(edge => edge.direction === "directed")
    .map(edge => JSON.stringify([edge.source, edge.target, edge.kind])));
  const opposing = new Map<string, GraphEdgeRecord>();
  for (const edge of edges) {
    if (edge.direction !== "directed") continue;
    const reverseKey = JSON.stringify([edge.target, edge.source, edge.kind]);
    if (byDirectedKind.has(reverseKey)) opposing.set(edgeKey(edge), edge);
  }
  return [...opposing.values()];
}

export function auditGraph(a: MemoryRecord, b: MemoryRecord): GraphAudit {
  const aIndex = indexNodes(a);
  const bIndex = indexNodes(b);
  const matchedKeys = new Set([...aIndex.unique.keys()].filter(key => bIndex.unique.has(key)));
  const ambiguousKeys = new Set([...aIndex.duplicateKeys, ...bIndex.duplicateKeys]);
  const ambiguous_nodes = [...ambiguousKeys].sort();
  const matched_nodes = matchedKeys.size;
  const unmatched_a_nodes = aIndex.unmatched.concat([...aIndex.unique].filter(([key]) => !matchedKeys.has(key)).map(([, label]) => label));
  const unmatched_b_nodes = bIndex.unmatched.concat([...bIndex.unique].filter(([key]) => !matchedKeys.has(key)).map(([, label]) => label));
  const aOwnEdges = canonicalEdges(a, aIndex, aIndex);
  const bOwnEdges = canonicalEdges(b, bIndex, bIndex);
  const aDuplicates = [...countEdges(aOwnEdges).values()].filter(entry => entry.count >= 2).map(({ edge, count }) => ({ ...edge, count }));
  const bDuplicates = [...countEdges(bOwnEdges).values()].filter(entry => entry.count >= 2).map(({ edge, count }) => ({ ...edge, count }));
  const opposing_edges_a = opposingEdges(aOwnEdges);
  const opposing_edges_b = opposingEdges(bOwnEdges);
  const empty: GraphAudit = {
    executed: false,
    matched_nodes,
    unmatched_a_nodes,
    unmatched_b_nodes,
    unchanged_edges: 0,
    removed_edges: [],
    added_edges: [],
    ambiguous_nodes,
    note: NOTE,
    ...(aDuplicates.length ? { duplicate_edges_a: aDuplicates } : {}),
    ...(bDuplicates.length ? { duplicate_edges_b: bDuplicates } : {}),
    ...(opposing_edges_a.length ? { opposing_edges_a } : {}),
    ...(opposing_edges_b.length ? { opposing_edges_b } : {}),
  };
  if (a.graph.relations.length === 0 && b.graph.relations.length === 0) return empty;

  const aCounts = countEdges(canonicalEdges(a, aIndex, aIndex, matchedKeys));
  const bCounts = countEdges(canonicalEdges(b, bIndex, aIndex, matchedKeys));
  const removed_edges: GraphEdgeRecord[] = [];
  const added_edges: GraphEdgeRecord[] = [];
  let unchanged_edges = 0;
  for (const [key, aEntry] of aCounts) {
    if (bCounts.has(key)) unchanged_edges += 1;
    else removed_edges.push(aEntry.edge);
  }
  for (const [key, bEntry] of bCounts) {
    if (!aCounts.has(key)) added_edges.push(bEntry.edge);
  }
  return { ...empty, executed: aCounts.size + bCounts.size > 0, unchanged_edges, removed_edges, added_edges };
}
