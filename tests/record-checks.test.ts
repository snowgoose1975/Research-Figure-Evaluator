import { describe, expect, it } from "vitest";
import { judgeByRules, resolveJudgment } from "../src/lib/evaluation";
import { KeypointSchema, type Keypoint, type MemoryRecord, type Judgment } from "../src/lib/schemas";

const memory: MemoryRecord = { schema_version: "0.2.0", title: "Example", domain: "physics", figure_type: "mechanism", summary: "", graph: { nodes: ["input", "upper", "lower"].map(id => ({ id, label: id, aliases: [], group_id: null, semantic_position: null })), relations: [{ id: "r", source_id: "input", target_id: "upper", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "" }], groups: [], conditions: [] }, plots: [], facts: [], evidence: [], uncertainties: [], completeness: "complete" };
const check = (subject: string, object: string) => ({ subject, predicate: "flows_to" as const, object, qualifiers: [], certainty: null });
const point: Keypoint = { id: "k", text: "Each input feeds both branches.", author_confirmed: true, claim: null, record_checks: [check("input", "upper"), check("input", "lower")] };
const suggestion: Judgment = { status: "retained", matched_item_ids: ["r"], issue_types: [], rationale: "Everything matches", method: "semantic_assist", review_required: true };

describe("explicit author connection checks", () => {
  it("reports a missing branch instead of accepting partial label overlap", () => {
    const result = resolveJudgment(point, memory, suggestion);
    expect(result.status).toBe("partial");
    expect(result.rationale).toContain("1/2 present");
    expect(result.rationale).toContain("input → lower");
    expect(result.rationale).toContain("was not recorded");
    expect(result.evidence_audit?.status).toBe("verified");
  });
  it("an explicit reversal takes precedence over a retained suggestion", () => {
    const result = resolveJudgment({ ...point, record_checks: [check("upper", "input")] }, memory, suggestion);
    expect(result.status).toBe("contradicted");
    expect(result.matched_item_ids).toContain("r");
  });
  it("does not verify a one-way connection when both orientations are recorded", () => {
    const value = structuredClone(memory); value.graph.relations.push({ ...value.graph.relations[0], id: "reverse", source_id: "upper", target_id: "input" });
    expect(resolveJudgment({ ...point, record_checks: [check("input", "upper")] }, value, suggestion).status).toBe("uncertain");
  });
  it("refuses ambiguous labels and incomplete records", () => {
    const value = structuredClone(memory); value.graph.nodes.push({ ...value.graph.nodes[0], id: "duplicate" });
    expect(judgeByRules(point, value).status).toBe("uncertain");
    expect(judgeByRules(point, { ...memory, completeness: "capacity_exceeded" }).status).toBe("uncertain");
  });
  it("does not infer connection checks from unstructured author sentences", () => {
    expect(resolveJudgment({ ...point, record_checks: undefined }, memory, suggestion).status).toBe("uncertain");
    expect(KeypointSchema.safeParse({ ...point, record_checks: [{ ...check("input", "upper"), qualifiers: ["unverified restriction"] }] }).success).toBe(false);
  });
});
