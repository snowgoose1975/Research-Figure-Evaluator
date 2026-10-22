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

  it("compares duplicate edges by multiplicity", () => {
    const result = auditGraph(memory(nodes, [edge("e1"), edge("e2")]), memory([{ id: "x", label: "Alpha" }, { id: "y", label: "Beta" }], [edge("r", "x", "y")]));
    expect(result.unchanged_edges).toBe(1);
    expect(result.removed_edges).toHaveLength(1);
    expect(result.added_edges).toEqual([]);
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
    expect(result.note).toContain("不能据此判断原图正确性");
  });
});
