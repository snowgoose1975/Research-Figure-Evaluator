import type { GraphAudit, GraphEdgeRecord, MemoryRecord } from "../schemas";

const NOTE = "仅比较 A/B 提取记录中的图关系差异；没有原图标准答案，不能据此判断原图正确性。";

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

function comparableEdges(memory: MemoryRecord, index: NodeIndex, canonical: NodeIndex, matched: Set<string>): GraphEdgeRecord[] {
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
    if (!source || !target || !canonicalSource || !canonicalTarget || !matched.has(sourceKey) || !matched.has(targetKey)) continue;
    const endpoints = relation.direction === "undirected" && sourceKey > targetKey
      ? [canonicalTarget, canonicalSource] as const
      : [canonicalSource, canonicalTarget] as const;
    result.push(edgeRecord(endpoints[0], endpoints[1], relation));
  }
  return result;
}

export function auditGraph(a: MemoryRecord, b: MemoryRecord): GraphAudit {
  const aIndex = indexNodes(a);
  const bIndex = indexNodes(b);
  const aMatchedKeys = new Set([...aIndex.unique.keys()].filter(key => bIndex.unique.has(key)));
  const bMatchedKeys = new Set(aMatchedKeys);
  const ambiguousKeys = new Set([...aIndex.duplicateKeys, ...bIndex.duplicateKeys]);
  const ambiguous_nodes = [...ambiguousKeys].sort();
  const matched_nodes = aMatchedKeys.size;
  const unmatched_a_nodes = aIndex.unmatched.concat([...aIndex.unique].filter(([key]) => !bMatchedKeys.has(key)).map(([, label]) => label));
  const unmatched_b_nodes = bIndex.unmatched.concat([...bIndex.unique].filter(([key]) => !aMatchedKeys.has(key)).map(([, label]) => label));
  const empty: GraphAudit = { executed: false, matched_nodes, unmatched_a_nodes, unmatched_b_nodes, unchanged_edges: 0, removed_edges: [], added_edges: [], ambiguous_nodes, note: NOTE };
  if (a.graph.relations.length === 0 && b.graph.relations.length === 0) return empty;

  const aEdges = comparableEdges(a, aIndex, aIndex, aMatchedKeys);
  const bEdges = comparableEdges(b, bIndex, aIndex, aMatchedKeys);
  const aCounts = new Map<string, { edge: GraphEdgeRecord; count: number }>();
  const bCounts = new Map<string, { edge: GraphEdgeRecord; count: number }>();
  for (const [edges, counts] of [[aEdges, aCounts], [bEdges, bCounts]] as const) {
    for (const edge of edges) {
      const key = edgeKey(edge);
      const found = counts.get(key);
      if (found) found.count += 1;
      else counts.set(key, { edge, count: 1 });
    }
  }
  const removed_edges: GraphEdgeRecord[] = [];
  const added_edges: GraphEdgeRecord[] = [];
  let unchanged_edges = 0;
  for (const [key, aEntry] of aCounts) {
    const bCount = bCounts.get(key)?.count ?? 0;
    unchanged_edges += Math.min(aEntry.count, bCount);
    for (let i = bCount; i < aEntry.count; i += 1) removed_edges.push(aEntry.edge);
  }
  for (const [key, bEntry] of bCounts) {
    const aCount = aCounts.get(key)?.count ?? 0;
    for (let i = aCount; i < bEntry.count; i += 1) added_edges.push(bEntry.edge);
  }
  return { ...empty, executed: aEdges.length + bEdges.length > 0, unchanged_edges, removed_edges, added_edges };
}
