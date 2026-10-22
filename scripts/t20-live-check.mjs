// One bounded development run. Same private input/checkpoints, no retry replacement.
import { readFile } from 'node:fs/promises';
import { writeNewEvidence, assertNewEvidence, evidenceFile, evidenceLabel } from './lib/evidence.mjs';
const output = evidenceFile(evidenceLabel('T20-live-summary-v1'), '.json'); assertNewEvidence([output]);
const root = 'http://127.0.0.1:3000';
const source = JSON.parse(await readFile('runs/1792679901262-de6f77fd/manifest.json', 'utf8'));
const image = await readFile('runs/1792679901262-de6f77fd/original.png');
const form = new FormData(); form.set('image', new Blob([image], { type: 'image/png' }), 'figure.png');
form.set('request', JSON.stringify({ mode: 'live', intents: { keypoints: source.keypoints }, example_id: null, example_version: null, parent_run_id: source.id, include_baseline: false }));
const started = Date.now();
const response = await fetch(`${root}/api/runs`, { method: 'POST', headers: { Origin: root }, body: form });
if (!response.ok) throw new Error(`Development run rejected: HTTP ${response.status}`);
let run = await response.json(); console.log(JSON.stringify({ run_id: run.id, stage: run.status }));
const deadline = Date.now() + 15 * 60_000; let stage = run.status;
while (!['completed', 'failed', 'interrupted'].includes(run.status) && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const status = await fetch(`${root}/api/runs/${run.id}`); if (!status.ok) throw new Error(`Run status unavailable: HTTP ${status.status}`);
  run = await status.json(); if (run.status !== stage) { stage = run.status; console.log(JSON.stringify({ stage })); }
}
const evidence = { run_id: run.id, protocol: 'bounded development check; excluded from original 8/12', source: 'private developer-supplied figure; image and content not exported', status: run.status, duration_ms: Date.now() - started, prompt: run.prompt_version, renderer: run.render_audit?.renderer_version, evaluation: run.report?.evaluation_version, reader_a_facts: run.a?.facts.length, reader_b_facts: run.b?.facts.length, identical_summaries: Boolean(run.a && run.b && run.a.summary === run.b.summary), render_warnings: run.render_audit?.warnings.length, unsupported_items: run.render_audit?.unsupported_item_ids.length, error_code: run.error?.code ?? null, no_accuracy_claim: true };
writeNewEvidence(output, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
if (run.status !== 'completed') process.exitCode = 1;
