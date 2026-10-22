// Fixed two-case development batch. No replacement runs or success selection.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { evidenceFile, assertNewEvidence, writeNewEvidence } from "./lib/evidence.mjs";
const output = evidenceFile("T15-live-v1", ".json"); assertNewEvidence([output]);
const directory = "runs/T15-live-v1";
if (existsSync(directory)) throw new Error("Batch exists; do not replace it.");
mkdirSync(directory, { recursive: true });
const previous = JSON.parse(readFileSync("runs/1792656729263-a5d88589/manifest.json", "utf8"));
const materials = JSON.parse(readFileSync("public/case-studies/materials-lattice-design/record-v2.json", "utf8"));
const cases = [
  { id: "user-development-counterexample", image: "runs/1792656729263-a5d88589/original.png", keypoints: previous.keypoints, parent: previous.id, private: true },
  { id: "public-materials", image: "public/published/materials-lattice-design.png", keypoints: materials.keypoints.map(point => ({ id: point.id, text: point.text, claim: point.claim ?? null, author_confirmed: true })), parent: null, private: false },
];
writeFileSync(`${directory}/plan.json`, JSON.stringify({ cases: cases.map(item => ({ id: item.id, private: item.private })), protocol: "reader-0.2.3 / renderer-0.2.2 / evidence-0.3.0", maximum_new_runs: 2, scope: "Development examples, not a holdout or generalization estimate; public checkpoints remain project-curated." }, null, 2), { flag: "wx" });
const base = "http://127.0.0.1:3000";
const rows = [];
for (const item of cases) {
  const service = await (await fetch(`${base}/api/status`)).json();
  if (service.active_run_id || !service.configured || !["127.0.0.1:11434", "localhost:11434"].includes(service.base_url_host)) throw new Error("Local host is busy or not configured for free inference; no run started.");
  const started = Date.now();
  const form = new FormData();
  form.set("image", new Blob([readFileSync(item.image)], { type: "image/png" }), "figure.png");
  form.set("request", JSON.stringify({ mode: "live", intents: { keypoints: item.keypoints }, example_id: null, example_version: null, parent_run_id: item.parent, include_baseline: false }));
  const response = await fetch(`${base}/api/runs`, { method: "POST", headers: { origin: base }, body: form, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Admission failed for ${item.id}, HTTP ${response.status}; no retry.`);
  let run = await response.json();
  const id = run.id;
  while (!["completed", "failed", "interrupted"].includes(run.status)) {
    if (Date.now() - started > 1800000) throw new Error("Batch observation timed out. Do not start replacement runs.");
    await new Promise(resolve => setTimeout(resolve, 2000));
    run = await (await fetch(`${base}/api/runs/${id}`, { signal: AbortSignal.timeout(15000) })).json();
  }
  writeFileSync(`${directory}/${item.id}.json`, JSON.stringify(run, null, 2), { flag: "wx" });
  const row = { id: item.id, status: run.status, duration_seconds: Math.round((Date.now() - started) / 1000), prompt_version: run.prompt_version, renderer: run.render_audit?.renderer_version ?? null, evaluation_version: run.report?.evaluation_version ?? null, error_code: run.error?.code ?? null, error_stage: run.error?.stage ?? null, a_nodes: run.a?.graph.nodes.length ?? null, b_nodes: run.b?.graph.nodes.length ?? null, a_edges: run.a?.graph.relations.length ?? null, b_edges: run.b?.graph.relations.length ?? null, summary: run.report?.summary ?? null, graph_added: run.report?.graph_audit?.added_edges.length ?? null, graph_removed: run.report?.graph_audit?.removed_edges.length ?? null, renderer_warnings: run.render_audit?.warnings.length ?? null };
  rows.push(row); console.log(JSON.stringify(row));
}
writeNewEvidence(output, JSON.stringify({ scope: "Two fixed development runs; private user records not included. All outcomes retained. New protocol not part of original 8/12. Free-text suggestions remain unverified; completed does not mean correct.", cases: rows }, null, 2) + "\n");
await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen3-vl:4b-instruct-16k", keep_alive: 0 }) });
