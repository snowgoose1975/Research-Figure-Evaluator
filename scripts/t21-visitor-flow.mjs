// Controlled visitor UI checks. No inference, no real image upload.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { assertNewEvidence, writeNewEvidence, evidenceFile, evidenceLabel } from './lib/evidence.mjs';
const label = evidenceLabel('T21-visitor-flow-v1');
const output = evidenceFile(label, '.json'), screenshot = evidenceFile(label, '.png'), mobile = evidenceFile(label, '-mobile.png');
assertNewEvidence([output, screenshot, mobile]);
const html = await readFile('adapters/local-service/public.html', 'utf8');
const origin = 'https://t21-test.lhr.life', parentOrigin = 'https://figure-relay.chicchair5.chatgpt.site';
const jobId = 'a'.repeat(64), png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cLo0AAAAASUVORK5CYII=';
const judgment = { status: 'uncertain', method: 'semantic_assist', rationale: 'The model suggestion has not been independently verified.', evidence_audit: { status: 'unverified', requested_status: 'retained', reasons: ['No independent check verified this suggestion.'], citations: [{ id: 'node-a', type: 'node', text: 'Alpha' }] } };
const result = { model: 'CONTROLLED UI STUB — not inference', prompt_version: 'reader-0.2.4', reader_records: { a: { summary: 'A recorded Alpha feeding Beta.', graph: { nodes: [], relations: [] }, facts: [] }, b: { summary: 'B recorded Beta after Alpha.', graph: { nodes: [], relations: [] }, facts: [] } }, report: { author_record_checks: [1, 2, 3].map(i => ({ keypoint_id: `author-${i}`, checks: 0 })), keypoint_results: [1, 2, 3].map(i => ({ keypoint_id: `author-${i}`, text: `Intended message ${i}`, in_a: judgment, in_b: judgment })), graph_audit: { executed: true, matched_nodes: 2, unchanged_edges: 1, note: 'Saved records only.', added_edges: [], removed_edges: [], unmatched_a_nodes: [], unmatched_b_nodes: [], ambiguous_nodes: [] } }, reconstruction_data_url: `data:image/png;base64,${png}`, render_audit: { warnings: ['Controlled rendering gap'], unsupported_item_ids: ['edge-test'] } };
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const checks = [], errors = []; let posts = 0, payload;
const check = (name, value) => { checks.push({ name, pass: Boolean(value) }); if (!value) throw new Error(name); };
page.on('pageerror', error => errors.push(error.message));
await page.route(`${origin}/**`, route => {
  const req = route.request(), pathname = new URL(req.url()).pathname;
  if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (pathname === '/status') return route.fulfill({ json: { accepting: true, paused: false } });
  if (pathname === '/jobs' && req.method() === 'POST') { posts++; payload = req.postDataJSON(); return route.fulfill({ json: { id: jobId, status: 'completed', result } }); }
  return route.fulfill({ status: 204, body: '' });
});
try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  check('three plain-language multiline boxes, no connection editor', await page.getByRole('textbox', { name: 'Expected scientific statement' }).count() === 3 && await page.getByText('Add explicit connection checks (optional)', { exact: true }).count() === 0);
  check('no dead remove controls at minimum', await page.getByRole('button', { name: 'Remove statement' }).count() === 0);
  await page.getByRole('button', { name: '+ Add another statement' }).click();
  await page.getByRole('button', { name: '+ Add another statement' }).click();
  check('bounded to five messages', await page.getByRole('textbox', { name: 'Expected scientific statement' }).count() === 5 && await page.locator('#add-keypoint').isDisabled());
  await page.getByRole('button', { name: 'Remove statement' }).nth(1).click();
  check('removal preserves adjacent message box', await page.getByRole('textbox', { name: 'Expected scientific statement' }).count() === 4);
  await page.getByRole('button', { name: 'Remove statement' }).last().click();
  await page.locator('#image').setInputFiles({ name: 'controlled.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  for (let i = 0; i < 3; i++) await page.getByRole('textbox', { name: 'Expected scientific statement' }).nth(i).fill(`Intended message ${i + 1}\nA long scientific explanation can remain readable on multiple lines.`);
  check('consent required', await page.locator('#submit').isDisabled());
  await page.locator('#consent').check(); await page.locator('#submit').click();
  await page.getByText('1. Compare the two AI readings', { exact: true }).waitFor();
  check('exactly one plain text submission, no hidden atoms', posts === 1 && payload.keypoints.length === 3 && payload.keypoints.every(k => k.claim === null && !('record_checks' in k) && k.text.includes('\n')));
  check('no coverage ratio anywhere in rendered report', !/\b\d+\/\d+ author statements|deterministic record checks/i.test(await page.locator('#result').textContent()));
  check('both summaries immediately visible', await page.getByText('Summary: A recorded Alpha feeding Beta.', { exact: true }).isVisible() && await page.getByText('Summary: B recorded Beta after Alpha.', { exact: true }).isVisible());
  check('uncertainty and rendering gap remain visible', await page.getByText(/A: Needs verification/).count() === 3 && await page.getByText(/Reconstruction needs review:/).isVisible());
  check('technical checks folded by default', !await page.getByRole('heading', { name: 'A/B graph comparison' }).isVisible());
  await page.getByText('Technical checks and coverage', { exact: true }).click();
  check('technical audit still accessible', await page.getByRole('heading', { name: 'A/B graph comparison' }).isVisible());
  await page.getByText('Technical checks and coverage', { exact: true }).click();
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check('mobile has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('img.reconstruction').click(); await page.getByRole('button', { name: 'Close image' }).click();
  check('image dialog can close', await page.locator('dialog[open]').count() === 0);
  await page.screenshot({ path: mobile, fullPage: true });
  await page.getByRole('button', { name: 'New check', exact: true }).click();
  check('new check clears consent and all messages', !await page.locator('#consent').isChecked() && await page.locator('#submit').isDisabled() && await page.locator('#keypoints textarea').evaluateAll(items => items.every(item => item.value === '')));
  // Exercise the same authenticated parent-to-frame path used for saved reports.
  await page.route(`${parentOrigin}/**`, route => route.fulfill({ contentType: 'text/html', body: `<iframe title="saved report" src="${origin}/"></iframe>` }));
  await page.goto(parentOrigin, { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe');
  await frame.getByRole('textbox', { name: 'Expected scientific statement' }).first().waitFor();
  await page.evaluate(({ origin, result }) => document.querySelector('iframe').contentWindow.postMessage({ type: 'rfe:show-saved', record: { createdAt: new Date().toISOString(), status: 'completed', result } }, origin), { origin, result });
  await frame.getByText('Summary: A recorded Alpha feeding Beta.', { exact: true }).waitFor();
  check('saved report uses new presentation without resubmitting', posts === 1 && !/\d+\/\d+ author statements/.test(await frame.locator('#result').textContent()));
  const legacy = { ...result, report: { keypoint_results: result.report.keypoint_results } };
  await page.evaluate(({ origin, result }) => document.querySelector('iframe').contentWindow.postMessage({ type: 'rfe:show-saved', record: { createdAt: new Date().toISOString(), status: 'completed', result } }, origin), { origin, result: legacy });
  await frame.getByText('Technical checks and coverage', { exact: true }).click();
  check('legacy coverage unavailable is explicit, not invented', await frame.getByText('Check coverage is unavailable in this saved report.', { exact: true }).isVisible());
  check('zero page errors', errors.length === 0);
} finally {
  writeNewEvidence(output, JSON.stringify({ checks, errors, controlled_stub: true, model_calls: 0, public_model_submission: false }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: checks.length, errors: errors.length }));
