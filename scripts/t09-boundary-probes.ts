// T09 independent boundary probes. These exercise the actual evaluation and
// model-adapter code paths with frozen fixtures and an in-memory HTTP stub.
// They do not call a real model and do not modify saved runs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluate } from "../src/lib/evaluation";
import { auditScientific, judgeScientific } from "../src/lib/evaluation/scientific";
import { readOriginal } from "../src/lib/model";
import { KeypointSchema, MemorySchema, type Judgment, type Keypoint, type MemoryRecord, type ModelAttemptAudit } from "../src/lib/schemas";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const LABEL = evidenceLabel("T09-boundary-probes");
const OUTPUT = evidenceFile(LABEL, ".json");
assertNewEvidence([OUTPUT]);

interface FixtureCase { id: string; a: unknown; b: unknown }
interface Fixture {
  fixture_version: string;
  supersedes?: string;
  cases: FixtureCase[];
  checkpoints: { id: string; text: string; author_confirmed: boolean; scientific: unknown; case_id: string; expected: { in_a: string; in_b: string } }[];
}
const legacy = JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", "T08-scientific-cases.json"), "utf8")) as Fixture;
const revised = JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", "T09-scientific-cases.json"), "utf8")) as Fixture;
const audit: Parameters<typeof evaluate>[0]["render"] = { width: 1200, height: 500, rendered_item_ids: [], unsupported_item_ids: [], warnings: [], structural_audit: "complete", visual_review: "not_reviewed", renderer_version: "0.2.0" };
const memories = (caseId: string) => {
  const entry = legacy.cases.find(candidate => candidate.id === caseId)!;
  return { a: MemorySchema.parse(entry.a), b: MemorySchema.parse(entry.b) };
};
const duplicateFirstPanel = (memory: MemoryRecord, prefix: string): MemoryRecord => {
  const copy = structuredClone(memory);
  const plot = structuredClone(copy.plots[0]);
  plot.id = `${prefix}-p2`;
  plot.series = plot.series.map((series, index) => ({ ...series, id: `${prefix}-s2-${index}` }));
  copy.plots.push(plot);
  return MemorySchema.parse(copy);
};
const retained = (ids: string[]): Judgment => ({ status: "retained", issue_types: [], matched_item_ids: ids, rationale: "Semantic judge reported retained.", method: "semantic_assist", review_required: true });
const smallScaleMemory = (base: MemoryRecord, unit: string, axisMax: number, values: number[]): MemoryRecord => {
  const memory = structuredClone(base);
  memory.plots[0].y_axis.unit = unit;
  memory.plots[0].y_axis.min = 0;
  memory.plots[0].y_axis.max = axisMax;
  memory.plots[0].series[0].label = "Reference current";
  memory.plots[0].series[0].points = values.map((y, index) => ({ x: index, y }));
  return MemorySchema.parse(memory);
};
const withoutPlots = (base: MemoryRecord, nodeId: string): MemoryRecord => {
  const memory = structuredClone(base);
  memory.plots = [];
  memory.graph.nodes = [{ id: nodeId, label: nodeId, aliases: [], group_id: null, semantic_position: null }];
  return MemorySchema.parse(memory);
};
const checks: { id: string; expected: unknown; actual: unknown; pass: boolean }[] = [];
const check = (id: string, actual: unknown, expected: unknown) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ id, expected, actual, pass });
};

const scientificEntry = revised.checkpoints[0];
const scientificKeypoint: Keypoint = KeypointSchema.parse({
  id: scientificEntry.id,
  text: scientificEntry.text,
  author_confirmed: true,
  claim: null,
  scientific: scientificEntry.scientific,
});
const shape = memories(scientificEntry.case_id);

// F1a: a semantic retained row must not turn the deterministic B contradiction
// into retention on the evaluate() branch used by live runs.
const live = evaluate({
  intents: { keypoints: [scientificKeypoint] },
  a: shape.a,
  b: shape.b,
  render: audit,
  semantic: { results: [{ keypoint_id: scientificKeypoint.id, in_a: retained(["a-p1", "a-s1"]), in_b: retained(["b-p1", "b-s1"]) }] },
});
check("F1a scientific rule contradiction survives semantic retained", {
  status: live.keypoint_results[0].in_b.status,
  method: live.keypoint_results[0].in_b.method,
  precedence_noted: live.keypoint_results[0].in_b.rationale.includes("deterministic project-curated check takes precedence"),
}, { status: "contradicted", method: "rule", precedence_noted: true });

// F1b: a semantic retained row must not turn rule uncertainty into confirmation.
const ambiguous = memories("neg-ambiguous-duplicate-series");
const liveUncertain = evaluate({
  intents: { keypoints: [scientificKeypoint] },
  a: ambiguous.a,
  b: ambiguous.b,
  render: audit,
  semantic: { results: [{ keypoint_id: scientificKeypoint.id, in_a: retained(["a-p1", "a-s1"]), in_b: retained(["b-p1", "b-s1", "b-s2"]) }] },
});
check("F1b scientific rule uncertainty survives semantic retained", {
  status: liveUncertain.keypoint_results[0].in_b.status,
  method: liveUncertain.keypoint_results[0].in_b.method,
}, { status: "uncertain", method: "rule" });

// F2: a duplicated panel key on either side must not produce a confirmed
// one-to-one correspondence or count as matched.
const duplicateA = auditScientific(duplicateFirstPanel(shape.a, "probe-a"), shape.b);
const duplicateB = auditScientific(shape.a, duplicateFirstPanel(shape.b, "probe-b"));
const duplicateBoth = auditScientific(duplicateFirstPanel(shape.a, "probe-a"), duplicateFirstPanel(shape.b, "probe-b"));
const shapeConfirmed = (result: ReturnType<typeof auditScientific>) => result.findings.filter(item => item.category === "series_shape_change" && item.status === "confirmed").length;
check("F2a duplicate A panel has no unique match", {
  matched_plots: duplicateA.coverage.plot_audit.matched_plots,
  matched_series: duplicateA.coverage.plot_audit.matched_series,
  confirmed_shape: shapeConfirmed(duplicateA),
  unmatched_a_has_key: (duplicateA.coverage.plot_audit.unmatched_a_plots?.join(" ") ?? "").includes("duplicate panel key in A"),
}, { matched_plots: 0, matched_series: 0, confirmed_shape: 0, unmatched_a_has_key: true });
check("F2b duplicate B panel has no unique match", {
  matched_plots: duplicateB.coverage.plot_audit.matched_plots,
  matched_series: duplicateB.coverage.plot_audit.matched_series,
  confirmed_shape: shapeConfirmed(duplicateB),
  unmatched_a_has_key: (duplicateB.coverage.plot_audit.unmatched_a_plots?.join(" ") ?? "").includes("duplicate panel key in B"),
}, { matched_plots: 0, matched_series: 0, confirmed_shape: 0, unmatched_a_has_key: true });
check("F2c duplicates on both sides have no unique match", {
  matched_plots: duplicateBoth.coverage.plot_audit.matched_plots,
  matched_series: duplicateBoth.coverage.plot_audit.matched_series,
  confirmed_shape: shapeConfirmed(duplicateBoth),
  unmatched_a_has_key: (duplicateBoth.coverage.plot_audit.unmatched_a_plots?.join(" ") ?? "").includes("duplicate panel key in A"),
  unmatched_b_has_key: (duplicateBoth.coverage.plot_audit.unmatched_b_plots?.join(" ") ?? "").includes("duplicate panel key in B"),
}, { matched_plots: 0, matched_series: 0, confirmed_shape: 0, unmatched_a_has_key: true, unmatched_b_has_key: true });

// F3: use the frozen real-run memories, not the synthetic fixture, for the
// zero-vs-0.05 threshold counterexample.
const runId = "1792609657136-e85156a8";
const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "runs", runId, "manifest.json"), "utf8")) as { a: unknown; b: unknown };
const realA = MemorySchema.parse(manifest.a);
const realB = MemorySchema.parse(manifest.b);
const realJudgeA = judgeScientific(scientificEntry.scientific as Parameters<typeof judgeScientific>[0], realA);
const realJudgeB = judgeScientific(scientificEntry.scientific as Parameters<typeof judgeScientific>[0], realB);
check("F3a real A y=0 is not retained against 0.05", { status: realJudgeA.status, issue_types: realJudgeA.issue_types }, { status: "contradicted", issue_types: ["value"] });
check("F3b real B deviation is contradicted", { status: realJudgeB.status, issue_types: realJudgeB.issue_types }, { status: "contradicted", issue_types: ["value"] });
const wide = { ...(scientificEntry.scientific as Record<string, unknown>), value_tolerance: 0.05 };
const wideJudge = judgeScientific(wide as Parameters<typeof judgeScientific>[0], realA);
check("F3c 0.05 tolerance cannot distinguish zero from 0.05", {
  status: wideJudge.status,
  has_reason: wideJudge.rationale.includes("zero and the expected level cannot be distinguished"),
}, { status: "uncertain", has_reason: true });
const legacyCheckpoint = legacy.checkpoints[0];
const legacyJudge = judgeScientific(legacyCheckpoint.scientific as Parameters<typeof judgeScientific>[0], realA);
check("F3d check without frozen tolerance basis is uncertain", {
  status: legacyJudge.status,
  has_reason: legacyJudge.rationale.includes("no independent tolerance basis"),
}, { status: "uncertain", has_reason: true });

// N1: a fixed absolute epsilon must not swallow a small-magnitude scientific
// difference. The same physical quantity at nA scale must have the same verdict.
const ampereCheck = {
  ...(scientificEntry.scientific as Record<string, unknown>),
  series_label: "Reference current",
  expected_y: 1e-10,
  value_tolerance: 1e-12,
  flatness_tolerance: 1e-12,
  expected_unit: "A",
  tolerance_basis: "Frozen from the source panel before the audit; 1% of the 0-1e-9 A span.",
};
const nanoampereCheck = {
  ...ampereCheck,
  expected_y: 0.1,
  value_tolerance: 1e-3,
  flatness_tolerance: 1e-3,
  expected_unit: "nA",
  tolerance_basis: "Frozen from the same source panel after converting 1e-10 A to 0.1 nA; tolerances scale with the unit.",
};
const smallLostA = smallScaleMemory(shape.a, "A", 1e-9, [0, 0]);
const smallLostNano = smallScaleMemory(shape.a, "nA", 1, [0, 0]);
const smallKeptA = smallScaleMemory(shape.a, "A", 1e-9, [1e-10, 1.0005e-10]);
const smallKeptNano = smallScaleMemory(shape.a, "nA", 1, [0.1, 0.1000005]);
check("N1a 1e-10 A versus 1e-12 A tolerance is contradicted at zero", {
  status: judgeScientific(ampereCheck as Parameters<typeof judgeScientific>[0], smallLostA).status,
}, { status: "contradicted" });
check("N1b unit-scale conversion preserves the verdict", {
  lost_a: judgeScientific(ampereCheck as Parameters<typeof judgeScientific>[0], smallLostA).status,
  lost_na: judgeScientific(nanoampereCheck as Parameters<typeof judgeScientific>[0], smallLostNano).status,
  kept_a: judgeScientific(ampereCheck as Parameters<typeof judgeScientific>[0], smallKeptA).status,
  kept_na: judgeScientific(nanoampereCheck as Parameters<typeof judgeScientific>[0], smallKeptNano).status,
}, { lost_a: "contradicted", lost_na: "contradicted", kept_a: "retained", kept_na: "retained" });
const zeroCheck = { ...ampereCheck, expected_y: 0, value_tolerance: 1e-12, flatness_tolerance: 0 };
check("N1c zero reference is still evaluated without a fixed epsilon", {
  zero: judgeScientific(zeroCheck as Parameters<typeof judgeScientific>[0], smallScaleMemory(shape.a, "A", 1e-9, [0, 0])).status,
  nonzero: judgeScientific(zeroCheck as Parameters<typeof judgeScientific>[0], smallScaleMemory(shape.a, "A", 1e-9, [1e-10, 1e-10])).status,
}, { zero: "retained", nonzero: "contradicted" });

// N2: one-sided plot content must be listed as unmatched on the side that
// introduced it, including B-only plots. Both-empty remains empty.
const aOnlyPlots = auditScientific(shape.a, withoutPlots(shape.b, "probe-b-only-node"));
check("N2a A-only plot content is listed and B is empty", {
  a_plots: aOnlyPlots.coverage.plot_audit.unmatched_a_plots?.length ?? 0,
  a_series: aOnlyPlots.coverage.plot_audit.unmatched_a_series.length,
  b_plots: aOnlyPlots.coverage.plot_audit.unmatched_b_plots?.length ?? 0,
  b_series: aOnlyPlots.coverage.plot_audit.unmatched_b_series?.length ?? 0,
}, { a_plots: 1, a_series: 1, b_plots: 0, b_series: 0 });
const bOnlyPlots = auditScientific(withoutPlots(shape.a, "probe-a-only-node"), shape.b);
check("N2b B-only plot content is listed and A is empty", {
  a_plots: bOnlyPlots.coverage.plot_audit.unmatched_a_plots?.length ?? 0,
  a_series: bOnlyPlots.coverage.plot_audit.unmatched_a_series.length,
  b_plots: bOnlyPlots.coverage.plot_audit.unmatched_b_plots?.length ?? 0,
  b_series: bOnlyPlots.coverage.plot_audit.unmatched_b_series?.length ?? 0,
  unchecked: bOnlyPlots.coverage.unchecked.includes("Axis and series checks for unmatched or ambiguous panels"),
}, { a_plots: 0, a_series: 0, b_plots: 1, b_series: 1, unchecked: true });
const noPlots = auditScientific(withoutPlots(shape.a, "probe-a-empty-node"), withoutPlots(shape.b, "probe-b-empty-node"));
check("N2c both sides without plots keep unmatched lists empty", {
  a_plots: noPlots.coverage.plot_audit.unmatched_a_plots?.length ?? 0,
  a_series: noPlots.coverage.plot_audit.unmatched_a_series.length,
  b_plots: noPlots.coverage.plot_audit.unmatched_b_plots?.length ?? 0,
  b_series: noPlots.coverage.plot_audit.unmatched_b_series?.length ?? 0,
}, { a_plots: 0, a_series: 0, b_plots: 0, b_series: 0 });

// F4: drive the real adapter with partial usage from an in-memory response.
const memory = {
  schema_version: "0.2.0", title: "x", domain: "physics", figure_type: "mechanism", summary: "x",
  graph: { nodes: [{ id: "n", label: "N", aliases: [], group_id: null, semantic_position: null }], relations: [], groups: [], conditions: [] },
  plots: [], facts: [], uncertainties: [], evidence: [], completeness: "complete",
};
const config = { apiKey: "", baseUrl: "http://127.0.0.1:9/v1", model: "stub", protocol: "chat" as const, timeoutMs: 1000, maxOutputTokens: 1000 };
const image = { base64: "c2FtcGxlLWltYWdl", mime: "image/png" as const };
const withUsage = async (usage: Record<string, number>) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "probe-request", model: "stub",
    choices: [{ message: { content: JSON.stringify(memory) }, finish_reason: "stop" }],
    usage,
  }), { status: 200 })) as typeof fetch;
  try {
    const seen: ModelAttemptAudit[] = [];
    const result = await readOriginal(image, config, { stage: "reading_a", nextIndex: (() => { let i = 0; return () => ++i; })(), onAttempt: attempt => { seen.push(attempt); } });
    return { usage: result.meta.usage, complete: result.meta.usage_complete, attempt_usage: seen[0]?.usage };
  } finally {
    globalThis.fetch = original;
  }
};
const partial = await withUsage({ prompt_tokens: 7 });
check("F4a input-only usage is incomplete and not zero-filled", partial, { usage: { prompt_tokens: 7 }, complete: false, attempt_usage: { prompt_tokens: 7 } });
const totalOnly = await withUsage({ total_tokens: 12 });
check("F4b total-only usage is incomplete", totalOnly, { usage: { total_tokens: 12 }, complete: false, attempt_usage: { total_tokens: 12 } });
const full = await withUsage({ prompt_tokens: 7, completion_tokens: 3 });
check("F4c input and output usage is complete", full, { usage: { prompt_tokens: 7, completion_tokens: 3 }, complete: true, attempt_usage: { prompt_tokens: 7, completion_tokens: 3 } });

const result = {
  evidence_id: LABEL,
  generated_at: new Date().toISOString(),
  scope: "Offline probes against frozen fixtures, saved run memories, and an in-memory HTTP stub. No real model request, no saved-run modification.",
  source_run_id: runId,
  source_fixture: "data/fixtures/T09-scientific-cases.json",
  checks,
  pass: checks.every(item => item.pass),
};
writeNewEvidence(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ label: LABEL, pass: result.pass, checks }, null, 2));
if (!result.pass) process.exitCode = 1;
