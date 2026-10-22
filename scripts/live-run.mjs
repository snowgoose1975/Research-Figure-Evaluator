import { assertNewEvidence, writeNewEvidence } from "./lib/evidence.mjs";
const base = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const exampleId = process.argv[2];
if (!exampleId) {
  console.error("Usage: node scripts/live-run.mjs <example-id> [--baseline] [--out <file>]");
  process.exit(2);
}
const includeBaseline = process.argv.includes("--baseline");
const outIndex = process.argv.indexOf("--out");
const outFile = outIndex > 0 ? process.argv[outIndex + 1] : `artifacts/validation/live-${exampleId}.json`;
assertNewEvidence([outFile]);

const status = await (await fetch(base + "/api/status")).json();
if (!status.configured) {
  console.error("Model not configured:", JSON.stringify(status));
  process.exit(3);
}
const { examples } = await (await fetch(base + "/api/examples")).json();
const example = examples.find(e => e.id === exampleId);
if (!example) {
  console.error("Unknown example:", exampleId);
  process.exit(4);
}
console.log(`Running LIVE ${example.id} with ${status.model} (${status.protocol}); baseline=${includeBaseline}`);

const request = {
  mode: "live",
  intents: { keypoints: example.keypoints.map(k => ({ ...k, author_confirmed: true })) },
  example_id: example.id,
  example_version: "clear",
  parent_run_id: null,
  include_baseline: includeBaseline,
};
const form = new FormData();
form.set("request", JSON.stringify(request));
const started = Date.now();
const response = await fetch(base + "/api/runs", { method: "POST", body: form });
let run = await response.json();
if (!response.ok) {
  console.error("Run rejected:", JSON.stringify(run));
  process.exit(5);
}
console.log(`run ${run.id} queued`);
const deadline = Date.now() + 40 * 60_000;
let lastStatus = run.status;
while (!["completed", "failed"].includes(run.status) && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  run = await (await fetch(base + "/api/runs/" + run.id)).json();
  if (run.status !== lastStatus) {
    console.log(`  stage: ${run.status}`);
    lastStatus = run.status;
  }
}
const duration_ms = Date.now() - started;
const evidence = {
  empirical_model_results: run.status === "completed",
  example_id: example.id,
  run_id: run.id,
  mode: run.mode,
  model: run.model,
  protocol: run.protocol,
  status: run.status,
  duration_ms,
  created_at: run.created_at,
  completed_at: run.completed_at,
  settings_digest: run.settings_digest,
  input_digest: run.input_digest,
  stages: run.stages,
  error: run.error,
  render_audit: run.render_audit,
  report_summary: run.report?.summary ?? null,
  keypoint_results: run.report?.keypoint_results?.map(k => ({
    keypoint_id: k.keypoint_id, text: k.text, in_a: k.in_a.status, in_b: k.in_b.status,
    observed_stage: k.observed_stage, review_required: k.in_a.review_required || k.in_b.review_required,
  })) ?? null,
  a_to_b: run.report?.a_to_b ?? null,
  unmatched_b_claims: run.report?.unmatched_b_claims ?? null,
  limitations: run.report?.limitations ?? null,
  baseline: run.baseline ?? null,
  assets: run.assets,
};
writeNewEvidence(outFile, JSON.stringify(evidence, null, 2));
console.log(`\n${run.status.toUpperCase()} in ${(duration_ms / 1000).toFixed(1)}s → ${outFile}`);
if (run.error) console.log("error:", JSON.stringify(run.error));
if (run.report) {
  console.log("summary:", JSON.stringify(run.report.summary));
  for (const k of evidence.keypoint_results ?? []) console.log(`  ${k.keypoint_id}: A=${k.in_a} B=${k.in_b} (${k.observed_stage})`);
}
process.exit(run.status === "completed" ? 0 : 1);
