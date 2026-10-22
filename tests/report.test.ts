import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/lib/evaluation";
import { markdownReport } from "../src/lib/pipeline/report";
import { KeypointSchema, MemorySchema, type RenderAudit, type RunSnapshot } from "../src/lib/schemas";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", "T08-scientific-cases.json"), "utf8")) as { cases: { id: string; a: unknown; b: unknown }[] };
const revised = JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", "T09-scientific-cases.json"), "utf8")) as { checkpoints: { id: string; text: string; author_confirmed: boolean; scientific: unknown }[] };
const entry = fixture.cases.find(item => item.id === "neg-series-shape")!;
const a = MemorySchema.parse(entry.a);
const b = MemorySchema.parse(entry.b);
const keypoint = KeypointSchema.parse({ id: revised.checkpoints[0].id, text: revised.checkpoints[0].text, author_confirmed: revised.checkpoints[0].author_confirmed, claim: null, scientific: revised.checkpoints[0].scientific });
const audit: RenderAudit = { width: 1200, height: 500, rendered_item_ids: ["a-p1", "a-s1"], unsupported_item_ids: [], warnings: [], structural_audit: "complete", visual_review: "not_reviewed", renderer_version: "0.2.0" };
const base = { id: "t08-report", created_at: "2026-10-22T00:00:00.000Z", mode: "live" as const, status: "completed" as const, model: "project-curated-check", schema_version: "0.2.0", prompt_version: "reader-0.2.2", input_digest: "x", intent_digest: "y", settings_digest: "z", engine_version: "e", keypoints: [keypoint], a, b, render_audit: audit, baseline: null };

describe("coverage rendering in exports", () => {
  it("states what was not executed and lists scientific findings", () => {
    const report = evaluate({ intents: { keypoints: [keypoint] }, a, b, render: audit });
    const markdown = markdownReport({ ...base, report } as RunSnapshot);
    expect(markdown).toContain("## Detection coverage");
    expect(markdown).toContain("Fact-by-fact comparison: NOT EXECUTED");
    expect(markdown).toContain("## Scientific findings");
    expect(markdown).toContain("series_shape_change");
    expect(markdown).toContain("Project-curated scientific checks");
    expect(markdown).toContain("not author-confirmed");
    expect(markdown).toContain("Plot-axis audit: executed");
    expect(markdown).toContain("Series-shape audit: executed");
    expect(markdown).toContain("Geometry and relative position");
    expect(markdown).toContain("Confidence bands and shaded ranges");
    expect(markdown).toContain("An empty finding list does not mean the figure is unchanged.");
  });

  it("lists panels whose correspondence is not unique", () => {
    const duplicate = structuredClone(a);
    const plot = structuredClone(duplicate.plots[0]);
    plot.id = "a-p2";
    plot.series = plot.series.map((series, index) => ({ ...series, id: `a-s2-${index}` }));
    duplicate.plots.push(plot);
    const report = evaluate({ intents: { keypoints: [keypoint] }, a: duplicate, b, render: audit });
    const markdown = markdownReport({ ...base, report } as RunSnapshot);
    expect(report.coverage?.plot_audit.matched_plots).toBe(0);
    expect(markdown).toContain("Unmatched A plots:");
    expect(markdown).toContain("Unmatched A series:");
    expect(markdown).toContain("Plot-axis audit: NOT EXECUTED");
    expect(markdown).toContain("Series-shape audit: NOT EXECUTED");
  });

  it("lists B-only panels and series in the exported report", () => {
    const withoutPlots = structuredClone(a);
    withoutPlots.plots = [];
    const report = evaluate({ intents: { keypoints: [keypoint] }, a: withoutPlots, b, render: audit });
    const markdown = markdownReport({ ...base, report } as RunSnapshot);
    expect(report.coverage?.plot_audit.unmatched_b_plots?.length).toBeGreaterThan(0);
    expect(report.coverage?.plot_audit.unmatched_b_series?.length).toBeGreaterThan(0);
    expect(markdown).toContain("Unmatched B plots:");
    expect(markdown).toContain("Unmatched B series:");
  });

  it("does not present a legacy report as complete coverage", () => {
    const report = evaluate({ intents: { keypoints: [keypoint] }, a, b, render: audit });
    delete report.coverage;
    delete report.scientific_findings;
    const markdown = markdownReport({ ...base, report } as RunSnapshot);
    expect(markdown).toContain("Coverage metadata unavailable (legacy report)");
    expect(markdown).toContain("Scientific-finding metadata unavailable (legacy report)");
  });
});
