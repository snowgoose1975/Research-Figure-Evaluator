import { readFileSync } from "node:fs";
import path from "node:path";
import { auditScientific, judgeScientific } from "../src/lib/evaluation/scientific";
import { KeypointSchema, MemorySchema } from "../src/lib/schemas";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const RUN_ID = "1792609657136-e85156a8";
const FIXTURE = path.join(process.cwd(), "data", "fixtures", "T09-scientific-cases.json");
const LABEL = evidenceLabel("T09-scientific-regression");
const OUTPUT = evidenceFile(LABEL, ".json");
assertNewEvidence([OUTPUT]);
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { fixture_version: string; supersedes: string; checkpoints: { id: string; text: string; author_confirmed: boolean; scientific: unknown }[] };
const checkpoint = KeypointSchema.parse({
  id: fixture.checkpoints[0].id,
  text: fixture.checkpoints[0].text,
  author_confirmed: fixture.checkpoints[0].author_confirmed,
  claim: null,
  scientific: fixture.checkpoints[0].scientific,
});
const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "runs", RUN_ID, "manifest.json"), "utf8")) as { id: string; example_id: string; status: string; a: unknown; b: unknown; input_digest: string };
const a = MemorySchema.parse(manifest.a);
const b = MemorySchema.parse(manifest.b);
const audit = auditScientific(a, b);
const alphaFinding = audit.findings.find(item => item.category === "series_shape_change" && /alpha/i.test(item.summary));
const axisFindings = audit.findings.filter(item => item.category === "axis_unit_scale");
const inA = judgeScientific(checkpoint.scientific!, a);
const inB = judgeScientific(checkpoint.scientific!, b);
const checks = [
  { name: "run identity is the frozen real math run", pass: manifest.id === RUN_ID && manifest.example_id === "published-mathematics-metric-rewiring" && manifest.status === "completed" },
  { name: "fact-by-fact comparison is marked not executed", pass: !audit.coverage.fact_comparison.executed && Boolean(audit.coverage.fact_comparison.reason?.includes("Fact-by-fact comparison was not executed")) },
  { name: "plot-axis audit executed", pass: audit.coverage.plot_audit.axis_executed === true },
  { name: "series-shape audit executed separately", pass: audit.coverage.plot_audit.series_executed === true && audit.coverage.plot_audit.matched_series > 0 },
  { name: "coverage names geometry and confidence-band limits", pass: audit.coverage.unchecked.includes("Geometry and relative position") && audit.coverage.unchecked.includes("Confidence bands and shaded ranges") },
  { name: "alpha flat-line loss is detected as confirmed, not retained by label", pass: alphaFinding?.status === "confirmed" },
  { name: "axis unit field changes are detected", pass: axisFindings.length > 0 && axisFindings.some(item => item.status === "confirmed" && /y-axis unit field changed/i.test(item.summary)) },
  { name: "checkpoint declares an independent tolerance basis", pass: Boolean(checkpoint.scientific?.tolerance_basis?.includes("fixed from the source panel")) },
  { name: "known A reading y=0 is not retained against the 0.05 level", pass: inA.status === "contradicted" },
  { name: "checkpoint deviates in B", pass: inB.status === "contradicted" && inB.issue_types.includes("value") },
  { name: "all findings remain review-required", pass: audit.findings.every(item => item.review_required) },
];
const result = {
  evidence_id: LABEL,
  frozen_at: "2026-10-22",
  supersedes: "T08-scientific-regression-v1",
  synthetic_fixture_version: fixture.fixture_version,
  source_run_id: RUN_ID,
  source_input_digest: manifest.input_digest,
  scope: "Offline rule audit over the saved A/B memories of one real run. No model call and no change to the saved run. The T08 checkpoint/regression are preserved but superseded because their 0.05 tolerance accepted y=0 as retained.",
  checkpoint: { id: checkpoint.id, provenance: checkpoint.scientific?.source, author_confirmed: checkpoint.author_confirmed, tolerance_basis: checkpoint.scientific?.tolerance_basis, expected: { in_a: "contradicted", in_b: "contradicted" }, observed: { in_a: inA, in_b: inB } },
  coverage: audit.coverage,
  findings: audit.findings,
  checks,
  pass: checks.every(check => check.pass),
};
writeNewEvidence(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ label: LABEL, run: RUN_ID, pass: result.pass, checks, findings: audit.findings.map(item => `${item.status}:${item.category}:${item.summary}`) }, null, 2));
if (!result.pass) process.exitCode = 1;
