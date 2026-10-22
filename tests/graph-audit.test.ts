import { describe, expect, it } from "vitest";
import { MemorySchema, type MemoryRecord } from "../src/lib/schemas";
import { auditGraph } from "../src/lib/evaluation/graph-audit";

type NodeInput = { id: string; label: string };
type EdgeInput = { id: string; source_id: string; target_id: string; kind?: string; direction?: string; line_style?: string; evidence_status?: string };

function memory(nodes: NodeInput[], relations: EdgeInput[] = []): MemoryRecord {
  return MemorySchema.parse({ schema_version: "0.2.0", title: "fixture", domain: "physics", figure_type: "mechanism", summary: "", graph: { nodes: nodes.map(n => ({ ...n, aliases: [], group_id: null, semantic_position: null })), relations: relations.map(e => ({ id: e.id, source_id: e.source_id, target_id: e.target_id, kind: e.kind ?? "associated_with", direction: e.direction ?? "directed", line_style: e.line_style ?? "solid", evidence_status: e.evidence_status ?? "asserted", label: "" })), groups: [], conditions: [] }, plots: [], facts: [], uncertainties: [], evidence: [], completeness: "unsupported" });
}

const nodes = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }];
const edge = (id = "e", source_id = "a", target_id = "b", rest: Partial<EdgeInput> = {}): EdgeInput => ({ id, source_id, target_id, ...rest });

describe("auditGraph", () => {
  it("matches labels after NFKC, case, dash and whitespace normalization", () => {
    const result = auditGraph(memory([{ id: "a", label: "Alpha–Beta" }, { id: "b", label: "Gamma" }], [edge()]), memory([{ id: "x", label: "  alpha−beta " }, { id: "y", label: "gamma" }], [edge("r", "x", "y")]));
    expect(result.matched_nodes).toBe(2);
    expect(result.unchanged_edges).toBe(1);
  });

  it("does not align edges through repeated labels and reports ambiguity", () => {
    const result = auditGraph(memory(nodes, [edge()]), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "ALPHA" }, { id: "z", label: "Beta" }], [edge("r", "x", "z")]));
    expect(result.ambiguous_nodes).toEqual(["alpha"]);
    expect(result.removed_edges).toEqual([]);
    expect(result.added_edges).toEqual([]);
  });

  it("reports nodes that cannot be matched without claiming edge changes", () => {
    const result = auditGraph(memory(nodes), memory([{ id: "x", label: "Alpha" }, { id: "z", label: "Gamma" }]));
    expect(result.matched_nodes).toBe(1);
    expect(result.unmatched_a_nodes).toEqual(["Beta"]);
    expect(result.unmatched_b_nodes).toEqual(["Gamma"]);
    expect(result.executed).toBe(false);
  });

  it("canonicalizes undirected endpoint order", () => {
    const result = auditGraph(memory(nodes, [edge("e", "a", "b", { direction: "undirected" })]), memory([{ id: "x", label: "Beta" }, { id: "y", label: "Alpha" }], [edge("r", "x", "y", { direction: "undirected" })]));
    expect(result.unchanged_edges).toBe(1);
    expect(result.removed_edges).toEqual([]);
    expect(result.added_edges).toEqual([]);
  });

  it("preserves direction for directed edges", () => {
    const result = auditGraph(memory(nodes, [edge()]), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r", "y", "x")]));
    expect(result.removed_edges).toHaveLength(1);
    expect(result.added_edges).toHaveLength(1);
  });

  it("treats changes to kind, direction, line style and evidence as remove plus add", () => {
    const before = edge("e", "a", "b", { kind: "promotes", direction: "directed", line_style: "solid", evidence_status: "asserted" });
    const after = edge("r", "x", "y", { kind: "inhibits", direction: "undirected", line_style: "dashed", evidence_status: "hypothesized" });
    const result = auditGraph(memory(nodes, [before]), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [after]));
    expect(result.removed_edges).toHaveLength(1);
    expect(result.added_edges).toHaveLength(1);
    expect(result.removed_edges[0]).toMatchObject({ kind: "promotes", direction: "directed", line_style: "solid", evidence_status: "asserted" });
    expect(result.added_edges[0]).toMatchObject({ kind: "inhibits", direction: "undirected", line_style: "dashed", evidence_status: "hypothesized" });
  });

  it("reports repeated records separately without inventing removed connections", () => {
    const result = auditGraph(memory(nodes, [edge("e1"), edge("e2")]), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r", "x", "y")]));
    expect(result.unchanged_edges).toBe(1);
    expect(result.removed_edges).toEqual([]);
    expect(result.added_edges).toEqual([]);
    expect(result.duplicate_edges_a).toEqual([{ source: "Alpha", target: "Beta", kind: "associated_with", direction: "directed", line_style: "solid", evidence_status: "asserted", count: 2 }]);
    expect(result.duplicate_edges_b).toBeUndefined();
  });

  it("reports a genuinely B-only connection once even when B repeats it", () => {
    const result = auditGraph(memory(nodes), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r1", "x", "y"), edge("r2", "x", "y")]));
    expect(result.added_edges).toHaveLength(1);
    expect(result.duplicate_edges_b?.[0]).toMatchObject({ source: "Alpha", target: "Beta", count: 2 });
  });

  it("marks same-kind reverse directed records as opposing candidates", () => {
    const result = auditGraph(
      memory([{ id: "u", label: "Unmatched source" }, { id: "v", label: "Unmatched target" }], [edge("uv", "u", "v", { kind: "promotes" }), edge("uv2", "u", "v", { kind: "promotes" }), edge("vu", "v", "u", { kind: "promotes" })]),
      memory([{ id: "x", label: "Other" }]),
    );
    expect(result.opposing_edges_a).toHaveLength(2);
    expect(result.opposing_edges_b).toBeUndefined();
    expect(result.duplicate_edges_a?.[0]).toMatchObject({ source: "Unmatched source", target: "Unmatched target", count: 2 });
    expect(result.added_edges).toEqual([]);
    expect(result.note).toContain("extracted A/B records only");
    expect(result.note).toContain("may already both appear in the source image");
  });

  it("does not match edges whose endpoint label is repeated", () => {
    const result = auditGraph(
      memory([{ id: "a1", label: "Alpha" }, { id: "a2", label: "ALPHA" }, { id: "b", label: "Beta" }], [edge("e1", "a1", "b"), edge("e2", "a2", "b")]),
      memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r", "x", "y")]),
    );
    expect(result.ambiguous_nodes).toEqual(["alpha"]);
    expect(result.removed_edges).toEqual([]);
    expect(result.added_edges).toEqual([]);
    expect(result.duplicate_edges_a).toBeUndefined();
  });

  it("recognizes B-only edges when their endpoint labels match", () => {
    const result = auditGraph(memory(nodes), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r", "x", "y")]));
    expect(result.executed).toBe(true);
    expect(result.added_edges).toHaveLength(1);
    expect(result.removed_edges).toEqual([]);
  });

  it("does not assert changes through renamed nodes and states the audit limitation", () => {
    const result = auditGraph(memory(nodes, [edge()]), memory([{ id: "x", label: "Alpha renamed" }, { id: "y", label: "Beta" }], [edge("r", "x", "y")]));
    expect(result.unmatched_a_nodes).toEqual(["Alpha"]);
    expect(result.unmatched_b_nodes).toEqual(["Alpha renamed"]);
    expect(result.removed_edges).toEqual([]);
    expect(result.added_edges).toEqual([]);
    expect(result.note).toContain("no source-image ground truth");
  });
});
