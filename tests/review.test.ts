import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/lib/evaluation";
import { buildReviewQueue } from "../src/lib/evaluation/review";
import { markdownReport } from "../src/lib/pipeline/report";
import { MemorySchema, type RunSnapshot, type RenderAudit } from "../src/lib/schemas";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "data/fixtures/T08-scientific-cases.json"), "utf8"));
const entry = fixture.cases.find((item: { id: string }) => item.id === "neg-series-shape");
const a = MemorySchema.parse(entry.a);
const b = MemorySchema.parse(entry.b);
const audit: RenderAudit = { width: 1200, height: 500, rendered_item_ids: [], unsupported_item_ids: [], warnings: [], structural_audit: "complete", visual_review: "not_reviewed", renderer_version: "0.2.1" };
const retained = { status: "retained" as const, issue_types: [], matched_item_ids: [], rationale: "Labels retained.", method: "semantic_assist" as const, review_required: true };
function run(): RunSnapshot {
  const report = evaluate({ intents: { keypoints: [] }, a, b, render: audit });
  report.keypoint_results = [{ keypoint_id: "k1", text: "Label exists", in_a: { ...retained }, in_b: { ...retained }, observed_stage: "none", recovery_in_b: false, render_item_status: "unknown", suggestions: [] }];
  report.summary = { retained_a: 1, retained_b: 1, total: 1, unresolved: 0, renderer_warnings: 0 };
  return { id: "review-control", mode: "live", status: "completed", created_at: "2026-10-22T00:00:00Z", keypoints: [], a: structuredClone(a), b: structuredClone(b), report, render_audit: structuredClone(audit), assets: {}, stages: [], baseline: null } as unknown as RunSnapshot;
}

describe("review queue preserves scientific scope", () => {
  it("surfaces record-level shape changes even when every checkpoint is retained", () => {
    const snapshot = run();
    const before = JSON.stringify(snapshot);
    const queue = buildReviewQueue(snapshot);
    expect(queue[0]).toMatchObject({ source: "record_difference", title: "series shape change" });
    expect(queue[0].a[0].text).toContain("(0, 0.05)");
    expect(queue[0].b[0].text).toContain("(0, 1)");
    expect(queue[0].action).toContain("renderer or the second read");
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("resolves colliding local IDs on their own side", () => {
    const snapshot = run();
    snapshot.a!.graph.nodes = [{ id: "local-1", label: "Original A label", aliases: [], group_id: null, semantic_position: null }];
    snapshot.b!.graph.nodes = [{ id: "local-1", label: "Different B label", aliases: [], group_id: null, semantic_position: null }];
    snapshot.report!.scientific_findings = [{ id: "collision", category: "value_change", status: "confirmed", summary: "Explicit difference", a_item_ids: ["local-1"], b_item_ids: ["local-1"], review_required: true }];
    const item = buildReviewQueue(snapshot)[0];
    expect(item.a[0].text).toBe("Original A label");
    expect(item.b[0].text).toBe("Different B label");
  });

  it("shows a curve-content change before repeated axis-field differences", () => {
    const snapshot = run();
    const findings = snapshot.report!.scientific_findings!;
    findings.unshift({ ...findings[0], id: "axis-bookkeeping", category: "axis_unit_scale" });
    expect(buildReviewQueue(snapshot)[0].title).toBe("series shape change");
  });

  it("states missing evidence rather than inventing a location", () => {
    const snapshot = run();
    snapshot.report!.scientific_findings![0].a_item_ids = ["not-present"];
    expect(buildReviewQueue(snapshot)[0].a[0].text).toContain("unavailable");
  });

  it("prioritizes rendering gaps over editing the original", () => {
    const snapshot = run();
    snapshot.report!.scientific_findings = [];
    snapshot.report!.keypoint_results[0].render_item_status = "unsupported";
    const item = buildReviewQueue(snapshot)[0];
    expect(item.source).toBe("reconstruction");
    expect(item.action).toContain("Resolve this rendering gap before proposing changes to the original");
  });

  it("includes unsupported content outside the selected checkpoints", () => {
    const snapshot = run();
    snapshot.render_audit!.unsupported_item_ids = [snapshot.a!.plots[0].id];
    expect(buildReviewQueue(snapshot).find(item => item.id === "renderer-gap")?.a[0].text).toContain(snapshot.a!.plots[0].title);
  });

  it("does not erase first-read errors when B recovers", () => {
    const snapshot = run();
    const row = snapshot.report!.keypoint_results[0];
    row.in_a = { ...retained, status: "contradicted" };
    row.recovery_in_b = true;
    expect(buildReviewQueue(snapshot).find(item => item.source === "checkpoint")?.observation).toContain("Later recovery does not make the first reading lossless");
  });

  it("keeps legacy and skipped coverage visible", () => {
    const snapshot = run();
    expect(buildReviewQueue(snapshot).find(item => item.source === "coverage")?.observation).toContain("Audits not executed");
    delete snapshot.report!.coverage;
    delete snapshot.report!.scientific_findings;
    expect(buildReviewQueue(snapshot).find(item => item.source === "coverage")?.observation).toContain("metadata unavailable");
  });

  it("exports actionable review and both sides' references", () => {
    const markdown = markdownReport(run());
    expect(markdown).toContain("## What to review first");
    expect(markdown).toContain("Trace the cited series");
    expect(markdown).toContain("A · first read:");
    expect(markdown).toContain("B · second read:");
    expect(markdown).toContain("do not locate pixels or establish defects");
  });
});
