// One bounded public-figure live test; never replaces an earlier attempt.
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { evidenceFile, evidenceLabel, assertNewEvidence, writeNewEvidence } from "./lib/evidence.mjs";
const label = evidenceLabel("T14-live-first");
const output = evidenceFile(label, ".json");
const screenshot = evidenceFile(label, ".png");
assertNewEvidence([output, screenshot]);
const privateDirectory = `runs/${label}`;
if (existsSync(privateDirectory)) throw new Error("Private evidence exists; choose a new label.");
mkdirSync(privateDirectory, { recursive: true });
const base = readFileSync("runs/service-control/public-url.txt", "utf8").trim();
const caseData = JSON.parse(readFileSync("public/case-studies/materials-lattice-design/record-v2.json", "utf8"));
const execute = promisify(execFile);
const samples = [], checks = [], errors = [];
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const started = Date.now(); let timer;
let sampling = false;
const sample = async () => {
  if (sampling) return; sampling = true;
  try {
    const { stdout } = await execute("nvidia-smi", ["--query-gpu=memory.used,utilization.gpu,power.draw", "--format=csv,noheader,nounits"], { timeout: 5000 });
    const [vram_mib, gpu_percent, power_watts] = stdout.trim().split(",").map(Number);
    samples.push({ elapsed_seconds: Math.round((Date.now() - started) / 1000), vram_mib, gpu_percent, power_watts, free_ram_mib: Math.round(os.freemem() / 1024 / 1024) });
  } catch { /* Missing monitor sample is not fabricated. */ } finally { sampling = false; }
};
let finalJob = null;
try {
  await sample(); timer = setInterval(sample, 2000);
  await page.goto(base, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator('input[type="file"]').setInputFiles("public/published/materials-lattice-design.png");
  const points = page.getByRole("textbox", { name: "Expected scientific statement" });
  for (let index = 0; index < 3; index++) await points.nth(index).fill(caseData.keypoints[index].text);
  await page.locator('#consent').check();
  const responsePromise = page.waitForResponse(response => response.url() === `${base}/jobs` && response.request().method() === "POST", { timeout: 45000 });
  await page.getByRole("button", { name: "Agree and submit figure" }).click();
  const response = await responsePromise;
  checks.push({ name: "public browser admits exactly one live job", pass: response.status() === 202 });
  if (response.status() !== 202) throw new Error(`Admission failed: HTTP ${response.status()}`);
  const admitted = await response.json();
  const deadline = Date.now() + 900000;
  const browsing = [];
  while (Date.now() < deadline) {
    const result = await page.request.get(`${base}/jobs/${admitted.id}`, { timeout: 30000 });
    finalJob = await result.json();
    if (["completed", "failed", "cancelled"].includes(finalJob.status)) break;
    if (browsing.length < 3) {
      const tab = await browser.newPage();
      const begin = Date.now();
      await tab.goto("https://figure-relay.chicchair5.chatgpt.site", { waitUntil: "domcontentloaded", timeout: 30000 });
      const frameTime = await tab.evaluate(() => new Promise(resolve => { const begin = performance.now(); let frames = 0; function tick() { if (++frames >= 30) resolve(performance.now() - begin); else requestAnimationFrame(tick); } requestAnimationFrame(tick); }));
      browsing.push({ load_and_measure_ms: Date.now() - begin, thirty_animation_frames_ms: Math.round(frameTime) });
      await tab.close();
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  writeFileSync(`${privateDirectory}/result.json`, JSON.stringify(finalJob, null, 2), { flag: "wx" });
  checks.push({ name: "real local-model chain completed", pass: finalJob?.status === "completed" });
  if (finalJob?.status === "completed") {
    await page.getByText("Your check is complete", { exact: false }).waitFor({ timeout: 10000 }).catch(() => {});
    checks.push({ name: "report and reconstruction returned without private run paths", pass: !!finalJob.result?.report && !!finalJob.result?.reconstruction_data_url && !JSON.stringify(finalJob).includes("/api/runs/") });
  }
  await page.screenshot({ path: screenshot, fullPage: true });
  const admin = await browser.newPage();
  await admin.goto("http://127.0.0.1:9041", { waitUntil: "networkidle" });
  await admin.getByRole("button", { name: "暂停接单", exact: true }).click();
  await admin.getByText("已暂停", { exact: true }).waitFor();
  checks.push({ name: "manual pause visible to public visitors", pass: (await (await page.request.get(`${base}/status`)).json()).paused === true });
  await admin.getByRole("button", { name: "恢复接单", exact: true }).click();
  await admin.getByText("正在接单", { exact: true }).waitFor();
  checks.push({ name: "manual resume without shutdown", pass: (await (await page.request.get(`${base}/status`)).json()).accepting === true });
  await new Promise(resolve => setTimeout(resolve, 5000)); await sample();
  const report = { label, base, scope: "One public materials figure / real local pipeline through HTTPS. New service validation, not part of the original fixed-protocol 8/12. Checkpoints are project curated; synthetic browsing does not prove the user's normal applications remain unaffected.", outcome: finalJob?.status, error: finalJob?.error ?? null, duration_seconds: Math.round((Date.now() - started) / 1000), checks, errors, samples, browsing, report_summary: finalJob?.result?.report?.summary ?? null };
  writeNewEvidence(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ label, outcome: report.outcome, checks, errors, duration_seconds: report.duration_seconds, peak_vram_mib: Math.max(...samples.map(s => s.vram_mib)), peak_gpu_percent: Math.max(...samples.map(s => s.gpu_percent)), minimum_free_ram_mib: Math.min(...samples.map(s => s.free_ram_mib)), browsing }, null, 2));
  if (checks.some(check => !check.pass) || errors.length) process.exitCode = 1;
} catch (error) {
  const message = error.message.replace(/\/jobs\/[a-f0-9]{64}/g, "/jobs/[redacted]");
  writeNewEvidence(output, JSON.stringify({ label, base, outcome: "test_failed", message, checks, errors, samples }, null, 2) + "\n");
  console.error(message); process.exitCode = 1;
} finally { clearInterval(timer); await browser.close(); }
