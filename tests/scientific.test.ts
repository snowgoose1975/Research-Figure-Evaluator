import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate, judgeByRules } from "../src/lib/evaluation";
import { auditScientific, judgeScientific } from "../src/lib/evaluation/scientific";
import { KeypointSchema, MemorySchema, type Judgment, type Keypoint, type MemoryRecord, type RenderAudit, type ScientificCheck } from "../src/lib/schemas";

interface FixtureCase { id: string; description: string; a: unknown; b: unknown; expected: { categories: string[]; statuses: Record<string, "confirmed" | "uncertain"> } }
interface Fixture { fixture_version: string; synthetic: boolean; supersedes?: string; cases: FixtureCase[]; checkpoints: { id: string; text: string; author_confirmed: boolean; scientific: ScientificCheck; case_id: string; expected: { in_a: string; in_b: string } }[] }
const load = (name: string) => JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", name), "utf8")) as Fixture;
const legacy = load("T08-scientific-cases.json");
const revised = load("T09-scientific-cases.json");
const audit: RenderAudit = { width: 1200, height: 500, rendered_item_ids: [], unsupported_item_ids: [], warnings: [], structural_audit: "complete", visual_review: "not_reviewed", renderer_version: "0.2.0" };

function memories(caseId: string) {
  const entry = legacy.cases.find(candidate => candidate.id === caseId)!;
  return { a: MemorySchema.parse(entry.a), b: MemorySchema.parse(entry.b) };
}
function duplicateFirstPanel(memory: MemoryRecord, prefix: string): MemoryRecord {
  const copy = structuredClone(memory);
  const plot = structuredClone(copy.plots[0]);
  plot.id = `${prefix}-p2`;
  plot.series = plot.series.map((series, index) => ({ ...series, id: `${prefix}-s2-${index}` }));
  copy.plots.push(plot);
  return MemorySchema.parse(copy);
}
function retained(ids: string[]): Judgment {
  return { status: "retained", issue_types: [], matched_item_ids: ids, rationale: "Semantic judge reported retained.", method: "semantic_assist", review_required: true };
}
function currentMemory(unit: string, axisMax: number, yValues: number[]): MemoryRecord {
  const memory = structuredClone(memories("neg-series-shape").a);
  memory.plots[0].y_axis.unit = unit;
  memory.plots[0].y_axis.min = 0;
  memory.plots[0].y_axis.max = axisMax;
  memory.plots[0].series[0].label = "Reference current";
  memory.plots[0].series[0].points = yValues.map((y, index) => ({ x: index, y }));
  return MemorySchema.parse(memory);
}
function withoutPlots(memory: MemoryRecord, nodeId: string): MemoryRecord {
  const copy = structuredClone(memory);
  copy.plots = [];
  copy.graph.nodes = [{ id: nodeId, label: nodeId, aliases: [], group_id: null, semantic_position: null }];
  return MemorySchema.parse(copy);
}
function currentCheck(overrides: Partial<ScientificCheck> = {}): ScientificCheck {
  return {
    kind: "plot_reference_line",
    series_label: "Reference current",
    expected_y: 1e-10,
    value_tolerance: 1e-12,
    flatness_tolerance: 1e-12,
    expected_unit: "A",
    expected_scale: "linear",
    tolerance_basis: "Frozen from the source panel before the audit; 1% of the 0-1e-9 A span.",
    source: "project_curated",
    ...overrides,
  };
}

describe("frozen scientific negative cases", () => {
  it("keeps the T08 fixture marked synthetic and frozen with explicit expectations", () => {
    expect(legacy.fixture_version).toBe("T08-scientific-v1");
    expect(legacy.synthetic).toBe(true);
    expect(legacy.cases.length).toBeGreaterThanOrEqual(4);
  });

  for (const entry of legacy.cases) {
    it(`${entry.id}: detects the expected category without overstating uncertainty`, () => {
      const { a, b } = memories(entry.id);
      const { coverage, findings } = auditScientific(a, b);
      expect(findings.length).toBeGreaterThan(0);
      for (const category of entry.expected.categories) {
        const matches = findings.filter(item => item.category === category);
        expect(matches.length, `missing ${category}`).toBeGreaterThan(0);
        expect(matches.some(item => item.status === entry.expected.statuses[category])).toBe(true);
      }
      expect(findings.every(item => item.review_required)).toBe(true);
      expect(coverage.note).toContain("An empty finding list does not mean the figure is unchanged.");
      expect(new Set(findings.map(item => item.id)).size).toBe(findings.length);
    });
  }

  it("states that fact-by-fact comparison was not executed when A records no facts", () => {
    const { a, b } = memories("neg-series-shape");
    const { coverage } = auditScientific(a, b);
    expect(coverage.fact_comparison.executed).toBe(false);
    expect(coverage.fact_comparison.a_facts).toBe(0);
    expect(coverage.fact_comparison.reason).toContain("Fact-by-fact comparison was not executed");
    expect(coverage.unchecked).toContain("Fact-by-fact assertion comparison");
    expect(coverage.unchecked).toContain("Geometry and relative position");
    expect(coverage.unchecked).toContain("Confidence bands and shaded ranges");
    expect(coverage.plot_audit.executed).toBe(true);
    expect(coverage.plot_audit.axis_executed).toBe(true);
    expect(coverage.plot_audit.series_executed).toBe(true);
    expect(coverage.plot_audit.matched_series).toBe(1);
  });

  it("marks duplicate B series labels as uncertain rather than a confirmed change", () => {
    const { a, b } = memories("neg-ambiguous-duplicate-series");
    const { coverage, findings } = auditScientific(a, b);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "series_shape_change", status: "uncertain" });
    expect(coverage.plot_audit.executed).toBe(true);
    expect(coverage.plot_audit.axis_executed).toBe(true);
    expect(coverage.plot_audit.series_executed).toBe(false);
    expect(coverage.plot_audit.matched_plots).toBe(1);
    expect(coverage.plot_audit.matched_series).toBe(0);
    expect(coverage.plot_audit.reason).toContain("no series labels matched uniquely");
    expect(coverage.plot_audit.unmatched_a_series[0]).toContain("duplicate label in B");
  });

  it("does not call an approximate non-flat series a contradiction just because values differ", () => {
    const base = memories("neg-series-shape").b;
    const a: MemoryRecord = structuredClone(base);
    const b: MemoryRecord = structuredClone(base);
    a.plots[0].series[0].points = [{ x: 0, y: 1 }, { x: 3, y: 2 }];
    b.plots[0].series[0].points = [{ x: 0, y: 1.01 }, { x: 3, y: 2.01 }];
    const { findings } = auditScientific(a, b);
    expect(findings.filter(item => item.category === "series_shape_change")).toHaveLength(0);
  });

  it("does not confirm a panel correspondence when A repeats the panel key", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(duplicateFirstPanel(a, "a-dup"), b);
    expect(result.coverage.plot_audit.matched_plots).toBe(0);
    expect(result.coverage.plot_audit.matched_series).toBe(0);
    expect(result.coverage.plot_audit.axis_executed).toBe(false);
    expect(result.coverage.plot_audit.series_executed).toBe(false);
    expect(result.coverage.plot_audit.unmatched_a_plots?.length).toBeGreaterThan(0);
    expect(result.coverage.plot_audit.unmatched_a_plots?.join(" ")).toContain("duplicate panel key in A");
    expect(result.findings.filter(item => item.category === "series_shape_change" && item.status === "confirmed")).toHaveLength(0);
  });

  it("does not confirm a panel correspondence when B repeats the panel key", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(a, duplicateFirstPanel(b, "b-dup"));
    expect(result.coverage.plot_audit.matched_plots).toBe(0);
    expect(result.coverage.plot_audit.matched_series).toBe(0);
    expect(result.coverage.plot_audit.unmatched_a_plots?.join(" ")).toContain("duplicate panel key in B");
    expect(result.findings.filter(item => item.category === "series_shape_change" && item.status === "confirmed")).toHaveLength(0);
  });

  it("does not confirm a panel correspondence when both sides repeat the panel key", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(duplicateFirstPanel(a, "a-dup"), duplicateFirstPanel(b, "b-dup"));
    expect(result.coverage.plot_audit.matched_plots).toBe(0);
    expect(result.coverage.plot_audit.matched_series).toBe(0);
    expect(result.coverage.plot_audit.unmatched_a_plots?.join(" ")).toContain("duplicate panel key in A");
    expect(result.coverage.plot_audit.unmatched_b_plots?.join(" ")).toContain("duplicate panel key in B");
    expect(result.findings.filter(item => item.category === "series_shape_change" && item.status === "confirmed")).toHaveLength(0);
  });

  it("lists every A panel and series when B recorded no plots", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(a, withoutPlots(b, "b-only-node"));
    expect(result.coverage.plot_audit.executed).toBe(false);
    expect(result.coverage.plot_audit.unmatched_a_plots).toHaveLength(1);
    expect(result.coverage.plot_audit.unmatched_a_series).toHaveLength(1);
    expect(result.coverage.plot_audit.unmatched_b_plots).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_b_series).toEqual([]);
  });

  it("lists every B panel and series when A recorded no plots", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(withoutPlots(a, "a-only-node"), b);
    expect(result.coverage.plot_audit.executed).toBe(false);
    expect(result.coverage.plot_audit.unmatched_a_plots).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_a_series).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_b_plots).toHaveLength(1);
    expect(result.coverage.plot_audit.unmatched_b_plots?.join(" ")).toContain("no unique A panel match");
    expect(result.coverage.plot_audit.unmatched_b_series).toHaveLength(1);
    expect(result.coverage.plot_audit.unmatched_b_series?.join(" ")).toContain("panel not matched");
    expect(result.coverage.unchecked).toContain("Axis and series checks for unmatched or ambiguous panels");
  });

  it("leaves both unmatched lists empty when neither side recorded plots", () => {
    const { a, b } = memories("neg-series-shape");
    const result = auditScientific(withoutPlots(a, "a-empty-node"), withoutPlots(b, "b-empty-node"));
    expect(result.coverage.plot_audit.executed).toBe(false);
    expect(result.coverage.plot_audit.unmatched_a_plots).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_a_series).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_b_plots).toEqual([]);
    expect(result.coverage.plot_audit.unmatched_b_series).toEqual([]);
    expect(result.coverage.plot_audit.reason).toContain("A recorded no plots");
  });
});

describe("project-curated scientific checkpoint", () => {
  const entry = revised.checkpoints[0];
  const keypoint: Keypoint = KeypointSchema.parse({ id: entry.id, text: entry.text, author_confirmed: entry.author_confirmed, claim: null, scientific: entry.scientific });
  const { a, b } = memories(entry.case_id);

  it("keeps project provenance separate from author confirmation", () => {
    expect(revised.fixture_version).toBe("T09-scientific-v2");
    expect(revised.supersedes).toBe("T08-scientific-v1");
    expect(keypoint.author_confirmed).toBe(false);
    expect(keypoint.scientific?.source).toBe("project_curated");
    expect(keypoint.scientific?.tolerance_basis).toContain("fixed from the source panel");
    const judgment = judgeByRules(keypoint, a);
    expect(judgment.status).toBe(entry.expected.in_a);
    expect(judgment.review_required).toBe(true);
    expect(judgment.rationale).toContain("not author-confirmed");
    expect(judgment.rationale).toContain("basis:");
  });

  it("reports the frozen deviation in B instead of claiming retention", () => {
    expect(judgeScientific(keypoint.scientific!, a).status).toBe(entry.expected.in_a);
    const judgment = judgeScientific(keypoint.scientific!, b);
    expect(judgment.status).toBe(entry.expected.in_b);
    expect(judgment.issue_types).toContain("value");
    expect(judgment.rationale).toContain("observed y range");
  });

  it("does not accept zero as the 0.05 threshold at 100% relative tolerance", () => {
    const legacyKeypoint = KeypointSchema.parse({ id: legacy.checkpoints[0].id, text: legacy.checkpoints[0].text, author_confirmed: false, claim: null, scientific: legacy.checkpoints[0].scientific });
    expect(legacyKeypoint.scientific?.tolerance_basis).toBeUndefined();
    const legacyJudge = judgeScientific(legacyKeypoint.scientific!, a);
    expect(legacyJudge.status).toBe("uncertain");
    expect(legacyJudge.rationale).toContain("no independent tolerance basis");

    const wideKeypoint = KeypointSchema.parse({
      ...keypoint,
      scientific: { ...entry.scientific, value_tolerance: 0.05 },
    });
    const wideJudge = judgeScientific(wideKeypoint.scientific!, a);
    expect(wideJudge.status).toBe("uncertain");
    expect(wideJudge.rationale).toContain("zero and the expected level cannot be distinguished");
  });

  it("does not let a fixed absolute epsilon swallow a small-magnitude threshold loss", () => {
    const judgment = judgeScientific(currentCheck(), currentMemory("A", 1e-9, [0, 0]));
    expect(judgment.status).toBe("contradicted");
    expect(judgment.issue_types).toContain("value");
  });

  it("returns the same verdict when the same physical quantity is expressed at a different scale", () => {
    const ampere = currentCheck();
    const nanoampere = currentCheck({
      expected_unit: "nA",
      expected_y: 0.1,
      value_tolerance: 1e-3,
      flatness_tolerance: 1e-3,
      tolerance_basis: "Frozen from the same source panel after converting 1e-10 A to 0.1 nA; tolerances scale with the unit.",
    });
    expect(judgeScientific(ampere, currentMemory("A", 1e-9, [0, 0])).status).toBe("contradicted");
    expect(judgeScientific(nanoampere, currentMemory("nA", 1, [0, 0])).status).toBe("contradicted");
    expect(judgeScientific(ampere, currentMemory("A", 1e-9, [1e-10, 1.0005e-10])).status).toBe("retained");
    expect(judgeScientific(nanoampere, currentMemory("nA", 1, [0.1, 0.1000005])).status).toBe("retained");
  });

  it("still evaluates a zero reference without a fixed epsilon", () => {
    const zero = currentCheck({ expected_y: 0, value_tolerance: 1e-12, flatness_tolerance: 0 });
    expect(judgeScientific(zero, currentMemory("A", 1e-9, [0, 0])).status).toBe("retained");
    expect(judgeScientific(zero, currentMemory("A", 1e-9, [1e-10, 1e-10])).status).toBe("contradicted");
  });

  it("detects a small scientific-notation value change in extracted facts", () => {
    const a = structuredClone(memories("neg-threshold-value").a);
    const b = structuredClone(memories("neg-threshold-value").b);
    a.facts[0].object = "current 1e-10 A";
    b.facts[0].object = "current 0 A";
    const result = auditScientific(MemorySchema.parse(a), MemorySchema.parse(b));
    expect(result.findings).toContainEqual(expect.objectContaining({ category: "value_change", status: "confirmed" }));
  });

  it("surfaces coverage and findings in the evaluation report", () => {
    const report = evaluate({ intents: { keypoints: [keypoint] }, a, b, render: audit });
    expect(report.keypoint_results[0]).toMatchObject({ observed_stage: "round_trip" });
    expect(report.coverage?.fact_comparison.executed).toBe(false);
    expect(report.coverage?.plot_audit.axis_executed).toBe(true);
    expect(report.coverage?.plot_audit.series_executed).toBe(true);
    expect(report.scientific_findings?.some(item => item.category === "series_shape_change" && item.status === "confirmed")).toBe(true);
    expect(report.limitations.some(line => line.includes("Fact-by-fact assertion comparison was not executed"))).toBe(true);
  });
});

describe("deterministic constraints in the live semantic branch", () => {
  const entry = revised.checkpoints[0];
  const keypoint: Keypoint = KeypointSchema.parse({ id: entry.id, text: entry.text, author_confirmed: true, claim: null, scientific: entry.scientific });
  const { a, b } = memories("neg-series-shape");

  it("does not let a semantic retained result override a rule contradiction", () => {
    const report = evaluate({
      intents: { keypoints: [keypoint] }, a, b, render: audit,
      semantic: { results: [{ keypoint_id: keypoint.id, in_a: retained(["a-p1", "a-s1"]), in_b: retained(["b-p1", "b-s1"]) }] },
    });
    expect(report.keypoint_results[0].in_b.status).toBe("contradicted");
    expect(report.keypoint_results[0].in_b.method).toBe("rule");
    expect(report.keypoint_results[0].in_b.rationale).toContain("not used because the deterministic project-curated check takes precedence");
    expect(report.limitations.some(line => line.includes("not overridden by semantic-judge results"))).toBe(true);
  });

  it("does not let a semantic retained result turn rule uncertainty into confirmation", () => {
    const ambiguous = memories("neg-ambiguous-duplicate-series");
    const report = evaluate({
      intents: { keypoints: [keypoint] }, a: ambiguous.a, b: ambiguous.b, render: audit,
      semantic: { results: [{ keypoint_id: keypoint.id, in_a: retained(["a-p1", "a-s1"]), in_b: retained(["b-p1", "b-s1", "b-s2"]) }] },
    });
    expect(report.keypoint_results[0].in_b.status).toBe("uncertain");
    expect(report.keypoint_results[0].in_b.method).toBe("rule");
    expect(report.keypoint_results[0].in_b.rationale).toContain("not used because the deterministic project-curated check takes precedence");
  });

  it("also prevents a semantic retained result from erasing an explicit opposite relation", () => {
    const direction = memories("neg-direction-reversal");
    const ordinary: Keypoint = KeypointSchema.parse({
      id: "direction-check", text: "p53 promotes apoptosis.", author_confirmed: true,
      claim: { subject: "p53", predicate: "promotes", object: "apoptosis", qualifiers: [], certainty: "asserted" },
    });
    const report = evaluate({
      intents: { keypoints: [ordinary] }, a: direction.a, b: direction.b, render: audit,
      semantic: { results: [{ keypoint_id: ordinary.id, in_a: retained(["a-f1"]), in_b: retained(["b-f1"]) }] },
    });
    expect(report.keypoint_results[0].in_b.status).toBe("contradicted");
    expect(report.keypoint_results[0].in_b.method).toBe("rule");
    expect(report.keypoint_results[0].in_b.rationale).toContain("explicit contradictory extracted assertion takes precedence");
  });
});
