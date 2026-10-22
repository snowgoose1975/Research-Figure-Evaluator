// Documentation and public-access audit. No uploads or model calls.
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { evidenceFile, evidenceLabel, assertNewEvidence, writeNewEvidence } from './lib/evidence.mjs';
const output = evidenceFile(evidenceLabel('T22-submission-audit-v1'), '.json');
assertNewEvidence([output]);
const read = file => readFile(file, 'utf8');
const checks = [];
function check(name, value) { checks.push({ name, pass: Boolean(value) }); if (!value) throw new Error(name); }
let failure = null, web = null;
const writeup = await read('docs/submission/WRITEUP.md');
const sha256 = createHash('sha256').update(writeup).digest('hex');
try {
  check('canonical and form write-ups identical', writeup === await read('docs/submission/WRITEUP_FORM.md'));
  check('concise form text, not a pagination claim', writeup.trim().split(/\s+/).length <= 550);
  const files = ['README.md', 'docs/submission/WRITEUP.md', 'docs/submission/WRITEUP_FORM.md', 'docs/submission/CHECKLIST.md', 'docs/submission/POST.md', 'docs/submission/DEMO_SCRIPT.md'];
  let relativeLinks = 0;
  for (const file of files) {
    const text = await read(file);
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      await access(path.resolve(path.dirname(file), target)); relativeLinks++;
    }
  }
  check('README relative documentation links resolve', relativeLinks > 0);
  const index = JSON.parse(await read('public/case-studies/index-v2.json'));
  check('historical protocol agrees with write-up', index.protocol.completed === 8 && index.protocol.failed === 4 && index.protocol.total === 12 && index.protocol.prompt_version === 'reader-0.2.2');
  check('current prompt version distinguished from protocol', (await read('src/lib/schemas/index.ts')).includes('reader-0.2.4') && writeup.includes('reader-0.2.2') && writeup.includes('reader-0.2.4'));
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  check('no private run or environment files tracked', !tracked.some(file => file.startsWith('runs/') || /(^|\/)\.env(?:\.|$)/.test(file)));
  check('runtime and lockfile available', tracked.includes('package-lock.json') && tracked.includes('scripts/Modelfile.qwen3-vl-4b-instruct-16k') && tracked.includes('src/app/api/runs/route.ts'));
  const html = await read('adapters/local-service/public.html');
  check('visitor UI and documentation agree', !html.includes('Add explicit connection checks (optional)') && !html.includes('author statements have deterministic record checks') && html.includes('Technical checks and coverage'));
  check('post no longer claims automatic error attribution', !(await read('docs/submission/POST.md')).includes('each loss is attributed'));
  check('narration reflects user recording and no fabricated uploaded video', (await read('docs/submission/DEMO_SCRIPT.md')).includes('玉米自行录屏和配音'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext();
    const urls = ['https://figure-relay.chicchair5.chatgpt.site', 'https://figure-relay.chicchair5.chatgpt.site/?workspace=1', 'https://github.com/snowgoose1975/Research-Figure-Evaluator'];
    web = [];
    for (const url of urls) {
      const response = await context.request.get(url, { timeout: 30000 });
      const body = await response.text();
      web.push({ url, status: response.status(), final_url: response.url() });
      check(`anonymous GET ${url}`, response.status() === 200 && body.includes('Figure Relay'));
    }
  } finally { await browser.close(); }
} catch (error) { failure = error.message; process.exitCode = 1; }
writeNewEvidence(output, JSON.stringify({ outcome: failure ? 'failed' : 'passed', checks, failure, writeup_sha256: sha256, writeup_words: writeup.trim().split(/\s+/).length, public_access: web, model_calls: 0, code_test_rerun: false, note: 'Documentation-only change. Runtime validation remains T21; no claim of anonymous social-post access or competition submission.' }, null, 2));
console.log(JSON.stringify({ passed: checks.filter(item => item.pass).length, failure, writeup_words: writeup.trim().split(/\s+/).length }));
