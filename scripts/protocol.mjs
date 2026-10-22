// Fixed empirical protocol: for each published figure, run N live attempts and save every
// outcome. Failures are written, never retried away or replaced by a later success.
// Usage: node scripts/protocol.mjs --tag 8b --attempts 3 [--figures id1,id2] [--baseline]
import { assertEvidenceLabel, assertNewEvidence, evidenceFile, writeNewEvidence } from "./lib/evidence.mjs";

const base = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tag = assertEvidenceLabel(arg("tag") || "protocol");
const attempts = Number(arg("attempts") || 3);
const includeBaseline = process.argv.includes("--baseline");
const only = arg("figures")?.split(",").filter(Boolean);

const status = await (await fetch(`${base}/api/status`)).json();
if (!status.configured) { console.error("Model not configured:", JSON.stringify(status)); process.exit(3); }
const { examples } = await (await fetch(`${base}/api/examples`)).json();
const figures = examples.filter(e => e.origin === "published" && (!only || only.includes(e.id)));
if (!figures.length) { console.error("No published figures selected."); process.exit(4); }
const attemptFiles = figures.flatMap(example => Array.from({ length: attempts }, (_, index) => evidenceFile(`${tag}-${example.id}-attempt${index + 1}`, ".json")));
const summaryFile = evidenceFile(`protocol-${tag}`, ".json");
assertNewEvidence([...attemptFiles, summaryFile]);
console.log(`protocol tag=${tag} model=${status.model} attempts=${attempts} figures=${figures.length} baseline=${includeBaseline}`);

const rows = [];
for (const example of figures) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const label = `${tag}-${example.id}-attempt${attempt}`;
    const request = {
      mode: "live",
      intents: { keypoints: example.keypoints.map(k => ({ ...k, author_confirmed: true })) },
      example_id: example.id, example_version: "clear", parent_run_id: null, include_baseline: includeBaseline,
    };
    const form = new FormData();
    form.set("request", JSON.stringify(request));
    const started = Date.now();
    let run = await (await fetch(`${base}/api/runs`, { method: "POST", body: form })).json();
    if (!run.id) { console.error(label, "rejected", JSON.stringify(run)); process.exitCode = 5; continue; }
    const deadline = Date.now() + 45 * 60_000;
    while (!["completed", "failed"].includes(run.status) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      run = await (await fetch(`${base}/api/runs/${run.id}`)).json();
    }
    const duration_ms = Date.now() - started;
    const evidence = {
      empirical_model_results: run.status === "completed",
      protocol_tag: tag, attempt, example_id: example.id, run_id: run.id, mode: run.mode,
      model: run.model, protocol: run.protocol, prompt_version: run.prompt_version, engine_version: run.engine_version,
      status: run.status, duration_ms, created_at: run.created_at, completed_at: run.completed_at,
      settings_digest: run.settings_digest, input_digest: run.input_digest,
      stages: run.stages, error: run.error, render_audit: run.render_audit,
      report_summary: run.report?.summary ?? null,
      keypoint_results: run.report?.keypoint_results?.map(k => ({
        keypoint_id: k.keypoint_id, text: k.text, in_a: k.in_a.status, in_b: k.in_b.status,
        observed_stage: k.observed_stage, review_required: k.in_a.review_required || k.in_b.review_required,
        matched_a: k.in_a.matched_item_ids, matched_b: k.in_b.matched_item_ids,
      })) ?? null,
      a_to_b: run.report?.a_to_b ?? null,
      unmatched_b_claims: run.report?.unmatched_b_claims ?? null,
      limitations: run.report?.limitations ?? null,
      baseline: run.baseline ?? null, assets: run.assets,
    };
    writeNewEvidence(evidenceFile(label, ".json"), JSON.stringify(evidence, null, 2));
    const row = {
      example_id: example.id, attempt, run_id: run.id, status: run.status, duration_ms,
      prompt_version: run.prompt_version, engine_version: run.engine_version,
      error: run.error?.code ?? null, summary: run.report?.summary ?? null,
      keypoints: evidence.keypoint_results?.map(k => `${k.keypoint_id.replace(/^published-/, "")}:${k.in_a}/${k.in_b}`) ?? null,
      repairs: run.stages.filter(s => s.meta).map(s => s.meta.repairs ?? null),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeNewEvidence(summaryFile, JSON.stringify({
  evidence_id: `protocol-${tag}`,
  captured_at: new Date().toISOString(), model: status.model, prompt_version: rows[0]?.prompt_version ?? null,
  attempts_per_figure: attempts, baseline: includeBaseline, figure_count: figures.length,
  completed: rows.filter(r => r.status === "completed").length, failed: rows.filter(r => r.status === "failed").length, rows,
}, null, 2));
console.log(`\ncompleted ${rows.filter(r => r.status === "completed").length}/${rows.length}`);
