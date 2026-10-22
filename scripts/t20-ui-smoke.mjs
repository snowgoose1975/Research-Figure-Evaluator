// Controlled browser integration only; no model or public submission.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { assertNewEvidence, writeNewEvidence, evidenceFile, evidenceLabel } from './lib/evidence.mjs';
const output = evidenceFile(evidenceLabel('T20-public-ui-v1'), '.json'); assertNewEvidence([output]);
const html = await readFile('adapters/local-service/public.html', 'utf8');
const jobId = 'a'.repeat(64), origin = 'http://127.0.0.1:19040';
const edge = { source: 'Alpha', target: 'Beta', kind: 'flows_to', direction: 'directed', line_style: 'solid', evidence_status: 'asserted', count: 2 };
const judgment = { status: 'partial', matched_item_ids: ['r'], issue_types: [], rationale: 'One expected connection was not recorded.', method: 'rule', review_required: true, evidence_audit: { status: 'verified', requested_status: 'retained', reasons: ['Only explicit connections checked'], citations: [] } };
const result = { model: 'CONTROLLED UI STUB — not inference', prompt_version: 'reader-0.2.4', report: { author_record_checks: [0, 1, 2].map(i => ({ keypoint_id: `author-${i + 1}`, checks: i === 0 ? 2 : 0 })), keypoint_results: [{ keypoint_id: 'author-1', text: 'Alpha supplies two branches.', in_a: judgment, in_b: judgment }], graph_audit: { executed: true, matched_nodes: 2, unchanged_edges: 1, added_edges: [], removed_edges: [], unmatched_a_nodes: [], unmatched_b_nodes: [], ambiguous_nodes: [], note: 'Record comparison only.', duplicate_edges_b: [edge], opposing_edges_a: [edge] } }, limitations: ['Test limitation', 'Test limitation'] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
let posts = 0, payload;
await page.route(`${origin}/**`, async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (path === '/status') return route.fulfill({ json: { paused: false, active: false, waiting: 0, accepting: true } });
  if (path === '/jobs' && request.method() === 'POST') { posts++; payload = request.postDataJSON(); return route.fulfill({ json: { id: jobId, status: 'queued', position: 1 } }); }
  if (path === `/jobs/${jobId}`) return route.fulfill({ json: { id: jobId, status: 'completed', result } });
  return route.fulfill({ status: 404, body: '' });
});
const checks = []; const check = (name, pass) => { checks.push({ name, pass: Boolean(pass) }); if (!pass) throw new Error(name); };
try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').setInputFiles({ name: 'public-test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cLo0AAAAASUVORK5CYII=', 'base64') });
  for (let i = 0; i < 3; i++) await page.getByRole('textbox', { name: 'Expected scientific statement' }).nth(i).fill(`Expected statement ${i + 1}`);
  await page.locator('#consent').check(); await page.locator('#submit').click();
  await page.getByText('1. Compare the two AI readings', { exact: true }).waitFor();
  check('one submission only', posts === 1);
  check('ordinary text transmitted without requiring author atoms', payload.keypoints.length === 3 && !payload.keypoints.some(point => point.record_checks) && payload.keypoints[0].claim === null);
  check('coverage ratio removed', await page.getByText(/1\/3 author statements have deterministic record checks/).count() === 0);
  await page.getByText('Technical checks and coverage', { exact: true }).click();
  check('duplicates identified separately', await page.getByText(/duplicate/i).count() > 0);
  check('explicit connection scope visible', await page.getByText(/only these connections are checked/).count() > 0);
  check('no page errors', errors.length === 0);
  writeNewEvidence(output, JSON.stringify({ checks, errors, model_calls: 0, controlled_stub: true }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, errors: errors.length }));
} finally { await browser.close(); }
