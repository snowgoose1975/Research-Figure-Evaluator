import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";
const base = "http://127.0.0.1:3000";
const label = evidenceLabel("api-smoke");
const output = evidenceFile(label, ".json");
assertNewEvidence([output]);
const { examples } = await (await fetch(base + "/api/examples")).json();
const rows = [];
for (const example of examples.filter(e => e.origin === "teaching")) {
  for (const version of example.versions) {
    const request = { mode: "mock", intents: { keypoints: example.keypoints.map(k => ({ ...k, author_confirmed: true })) }, example_id: example.id, example_version: version.id, parent_run_id: null, include_baseline: false };
    const form = new FormData(); form.set("request", JSON.stringify(request));
    const response = await fetch(base + "/api/runs", { method: "POST", body: form });
    let run = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(run));
    const deadline = Date.now() + 20_000;
    while (!["completed", "failed"].includes(run.status) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      run = await (await fetch(base + "/api/runs/" + run.id)).json();
    }
    if (run.status !== "completed") throw new Error(`Pipeline failed: ${run.id} ${run.status}`);
    const png = await fetch(base + run.assets.reconstruction);
    if (!png.ok || png.headers.get("content-type") !== "image/png") throw new Error("Missing reconstruction PNG.");
    if (version.id === "clear" && run.report.summary.retained_b !== run.report.summary.total) throw new Error(`Positive control mismatch: ${example.id}`);
    const markdown = await fetch(base + "/api/runs/" + run.id + "/report?format=markdown");
    if (!markdown.ok || !(await markdown.text()).includes("SCRIPTED DEMO")) throw new Error("Missing truthful report export.");
    rows.push({ id: run.id, example: example.id, version: version.id, mode: run.mode, status: run.status, summary: run.report.summary });
    console.log(`${example.id}/${version.id}: completed (scripted control)`);
  }
}
const paper = examples.find(e => e.origin === "published");
const forbidden = new FormData(); forbidden.set("request", JSON.stringify({ mode: "mock", intents: { keypoints: paper.keypoints.map(k => ({ ...k, author_confirmed: true })) }, example_id: paper.id, example_version: "clear", parent_run_id: null, include_baseline: false }));
const rejected = await fetch(base + "/api/runs", { method: "POST", body: forbidden });
if (rejected.status !== 400) throw new Error("Published figure incorrectly allowed scripted inference.");
writeNewEvidence(output, JSON.stringify({ evidence_id: label, mode: "mock", empirical_model_results: false, published_mock_rejected: true, rows }, null, 2));
console.log(`PASS: ${rows.length} scripted pipelines; published mock inference rejected. Evidence: ${output}`);
