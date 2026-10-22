import { describe, expect, it } from "vitest";
import { evaluate, judgeByRules, compareRuns } from "../src/lib/evaluation";
import { MemorySchema, type Keypoint, type MemoryRecord, type RenderAudit, type RunSnapshot } from "../src/lib/schemas";

const point: Keypoint = { id: "k1", text: "A inhibits B only under X.", author_confirmed: true, claim: { subject: "A", predicate: "inhibits", object: "B", qualifiers: ["under X"], certainty: "asserted" } };
const memory = (change: Partial<MemoryRecord["facts"][number]> = {}): MemoryRecord => MemorySchema.parse({ schema_version: "0.2.0", title: "Test", summary: "", domain: "physics", figure_type: "mechanism", graph: { nodes: [], relations: [], groups: [], conditions: [] }, plots: [], facts: [{ id: "fact-a", subject: "A", predicate: "inhibits", object: "B", qualifiers: ["under X"], certainty: "asserted", source_ids: [], ...change }], uncertainties: [], evidence: [], completeness: "complete" });
const audit: RenderAudit = { width: 1200, height: 500, rendered_item_ids: ["fact-a"], unsupported_item_ids: [], warnings: [], structural_audit: "complete", visual_review: "not_reviewed", renderer_version: "0.2.0" };
describe("scientific semantic safeguards", () => {
  it("does not equate inhibition with promotion or drop a condition", () => {
    expect(judgeByRules(point, memory({ predicate: "promotes" })).status).toBe("contradicted");
    expect(judgeByRules(point, memory({ qualifiers: [] })).status).toBe("partial");
  });
  it("keeps hypothesis versus assertion distinct", () => expect(judgeByRules(point, memory({ certainty: "hypothesized" })).issue_types).toContain("evidence_status"));
  it("does not treat a different association as a contradictory claim", () => {
    expect(judgeByRules(point, memory({ predicate: "equals", object: "C" })).status).toBe("omitted");
    expect(judgeByRules(point, memory({ object: "C" })).status).toBe("uncertain");
  });
  it("does not equate local IDs across memories", () => {
    expect(judgeByRules(point, memory({ id: "different-id" })).status).toBe("retained");
    expect(judgeByRules(point, memory({ subject: "B", object: "A" })).issue_types).toContain("direction");
  });
  it("rejects semantic evidence invented by the judge", () => {
    const retained = judgeByRules(point, memory());
    const report = evaluate({ intents: { keypoints: [point] }, a: memory(), b: memory(), render: audit, semantic: { results: [{ keypoint_id: "k1", in_a: { ...retained, matched_item_ids: ["invented"] }, in_b: retained }] } });
    expect(report.keypoint_results[0].in_a.status).toBe("uncertain");
  });
  it("reports later recovery without claiming the whole journey was lossless", () => {
    const report = evaluate({ intents: { keypoints: [point] }, a: memory({ predicate: "promotes" }), b: memory(), render: audit });
    expect(report.keypoint_results[0]).toMatchObject({ observed_stage: "first_read", recovery_in_b: true });
  });
  it("does not call non-keypoint content a proven hallucination", () => {
    const b = memory(); b.facts.push({ ...b.facts[0], id: "extra", subject: "C" });
    const report = evaluate({ intents: { keypoints: [point] }, a: memory(), b, render: audit });
    expect(report.unmatched_b_claims[0]).toMatchObject({ id: "extra", review_required: true });
  });
  it("rejects misleading paired comparisons", () => {
    const stub = { status: "completed", intent_digest: "x", settings_digest: "same", mode: "live", keypoints: [point], report: null } as RunSnapshot;
    expect(compareRuns(stub, { ...stub, mode: "mock" }).comparable).toBe(false);
  });
});
describe("memory validation", () => {
  it("rejects a dangling relation and an empty complete extraction", () => {
    const m = memory(); m.graph.relations.push({ id: "r", source_id: "x", target_id: "y", kind: "promotes", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "" });
    expect(MemorySchema.safeParse(m).success).toBe(false);
    expect(MemorySchema.safeParse({ ...memory(), facts: [] }).success).toBe(false);
  });
});
