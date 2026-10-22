import { describe, expect, it } from "vitest";
import { resolveJudgment } from "../src/lib/evaluation";
import type { Judgment, Keypoint, MemoryRecord } from "../src/lib/schemas";

const keypoint: Keypoint = { id: "k", text: "Each input feeds both processing branches.", claim: null, author_confirmed: true };
const memory: MemoryRecord = { schema_version: "0.2.0", title: "Two branches", domain: "physics", figure_type: "mechanism", summary: "Branches", graph: { nodes: ["input", "upper", "lower"].map(id => ({ id, label: id, aliases: [], group_id: null, semantic_position: null })), relations: [{ id: "r1", source_id: "input", target_id: "upper", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "" }], groups: [], conditions: [] }, plots: [], facts: [], uncertainties: [], evidence: [], completeness: "complete" };
const suggestion = (ids = ["input", "upper", "lower"]): Judgment => ({ status: "retained", matched_item_ids: ids, issue_types: [], rationale: "Both branches are explicitly linked.", method: "semantic_assist", review_required: true });

describe("evidence-first free-text assessment", () => {
  it("does not treat the existence of both nodes as proof of both arrows", () => {
    const result = resolveJudgment(keypoint, memory, suggestion());
    expect(result.status).toBe("uncertain");
    expect(result.evidence_audit).toMatchObject({ requested_status: "retained", status: "unverified" });
    expect(result.evidence_audit?.citations).toHaveLength(3);
    expect(result.rationale).not.toContain("Both branches are explicitly linked");
  });
  it("does not treat valid relation IDs as verified entailment of an entire free-text claim", () => {
    const result = resolveJudgment(keypoint, memory, suggestion(["r1"]));
    expect(result.status).toBe("uncertain");
    expect(result.evidence_audit?.citations[0].text).toContain("input → upper");
    expect(result.evidence_audit?.citations[0].text).not.toContain("lower");
  });
  it("rejects invented citation IDs and refuses an unsupported contradiction too", () => {
    expect(resolveJudgment(keypoint, memory, suggestion(["invented"])).evidence_audit?.status).toBe("invalid");
    expect(resolveJudgment(keypoint, memory, { ...suggestion(["r1"]), status: "contradicted" }).status).toBe("uncertain");
  });
  it("retains independently checkable explicit facts instead of blanket uncertainty", () => {
    const facts = { ...memory, facts: [{ id: "f", subject: "A", predicate: "inhibits", object: "B", qualifiers: [], certainty: "asserted" as const, source_ids: [] }] };
    const point: Keypoint = { ...keypoint, text: "A inhibits B", claim: { subject: "A", predicate: "inhibits", object: "B", qualifiers: [], certainty: "asserted" } };
    expect(resolveJudgment(point, facts, suggestion(["f"]))).toMatchObject({ status: "retained", method: "rule", evidence_audit: { status: "verified" } });
    expect(resolveJudgment(point, { ...facts, facts: [{ ...facts.facts[0], predicate: "promotes" }] }, suggestion(["f"]))).toMatchObject({ status: "contradicted", method: "rule" });
  });
  it("unconfirmed intent and incomplete records cannot produce a verified result", () => {
    expect(resolveJudgment({ ...keypoint, author_confirmed: false }, memory, suggestion()).status).toBe("uncertain");
    expect(resolveJudgment(keypoint, { ...memory, completeness: "capacity_exceeded" }, suggestion()).status).toBe("uncertain");
  });
  it("checks explicit structured graph endpoints and detects a reversed connection", () => {
    const point: Keypoint = { ...keypoint, claim: { subject: "input", predicate: "flows_to", object: "upper", qualifiers: [], certainty: "asserted" } };
    expect(resolveJudgment(point, memory, suggestion(["r1"]))).toMatchObject({ status: "retained", method: "rule", evidence_audit: { status: "verified" } });
    const reversed = { ...memory, graph: { ...memory.graph, relations: memory.graph.relations.map(edge => ({ ...edge, source_id: edge.target_id, target_id: edge.source_id })) } };
    expect(resolveJudgment(point, reversed, suggestion(["r1"]))).toMatchObject({ status: "contradicted", method: "rule" });
    const unsupported: Keypoint = { ...point, claim: { ...point.claim!, object: "lower" } };
    expect(resolveJudgment(unsupported, memory, suggestion(["r1"])).status).toBe("uncertain");
  });
});
