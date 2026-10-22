import { chromium } from '@playwright/test';
import { assertNewEvidence, writeNewEvidence, evidenceFile, evidenceLabel } from './lib/evidence.mjs';
const output = evidenceFile(evidenceLabel('T20-deployed-site-v1'), '.json'); assertNewEvidence([output]);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('https://figure-relay.chicchair5.chatgpt.site/?workspace=1', { waitUntil: 'networkidle' });
  const frame = page.frameLocator('iframe[title="Figure Relay live figure analysis"]');
  const checks = frame.getByText('Add explicit connection checks (optional)', { exact: true });
  await checks.first().waitFor({ timeout: 25000 });
  const count = await checks.count();
  const evidence = { deployed_version: 7, explicit_checks_editors: count, errors, model_calls: 0, real_public_transport: true, new_model_end_to_end_submission: false, pass: count === 3 && errors.length === 0 };
  writeNewEvidence(output, JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
  if (!evidence.pass) process.exitCode = 1;
} finally { await browser.close(); }
