// Recover the very same admitted job after a GET transport interruption.
// This script never submits an image or invokes the model.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { evidenceFile, assertNewEvidence, writeNewEvidence } from "./lib/evidence.mjs";
const target = evidenceFile("T14-live-first-recovered", ".json"); assertNewEvidence([target]);
const original = JSON.parse(readFileSync("runs/T14-live-first/browser-failure-private.json", "utf8"));
const id = original.message.match(/\/jobs\/([a-f0-9]{64})/)?.[1];
if (!id) throw new Error("Missing private session reference; no replacement run started.");
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const context = await browser.newContext();
try {
  const local = await (await context.request.get(`http://127.0.0.1:9040/jobs/${id}`)).json();
  writeFileSync("runs/T14-live-first/result.json", JSON.stringify(local, null, 2), { flag: "wx" });
  let publicJob = null; const transport = [];
  for (let index = 0; index < 3; index++) {
    try {
      const response = await context.request.get(`${original.base}/jobs/${id}`, { timeout: 30000 });
      transport.push({ attempt: index + 1, http_status: response.status() });
      if (response.ok()) { publicJob = await response.json(); break; }
    } catch { transport.push({ attempt: index + 1, outcome: "transport_failed" }); }
  }
  const admin = await context.newPage();
  await admin.goto("http://127.0.0.1:9041", { waitUntil: "networkidle" });
  await admin.getByRole("button", { name: "暂停接单", exact: true }).click();
  await admin.getByText("已暂停", { exact: true }).waitFor();
  const paused = await (await context.request.get("http://127.0.0.1:9040/status")).json();
  await admin.getByRole("button", { name: "恢复接单", exact: true }).click();
  await admin.getByText("正在接单", { exact: true }).waitFor();
  const resumed = await (await context.request.get("http://127.0.0.1:9040/status")).json();
  const samples = original.samples;
  const report = { scope: "Same first HTTPS-admitted live job recovered after an interrupted GET; no image resubmission or model rerun. Resource sampling overlaps development build/test activity and is not an isolated benchmark of normal use.", original_browser_outcome: "GET transport failed; private raw record retained", original_checks: original.checks, result_status: local.status, error: local.error ?? null, public_result_retrieved: !!publicJob, same_result: publicJob?.status === local.status && JSON.stringify(publicJob?.result) === JSON.stringify(local.result), get_transport: transport, pause: paused.paused, resume: resumed.accepting, report_summary: local.result?.report?.summary ?? null, peak_vram_mib: Math.max(...samples.map(s => s.vram_mib)), peak_gpu_percent: Math.max(...samples.map(s => s.gpu_percent)), minimum_free_ram_mib: Math.min(...samples.map(s => s.free_ram_mib)), samples, limitations: ["Does not prove human understanding or generalization.", "Does not prove user applications remain responsive.", "Free temporary tunnel had a real connection interruption.", "Protocol results remain separate from the original 8/12."] };
  writeNewEvidence(target, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, samples: undefined, original_checks: undefined }, null, 2));
  if (local.status !== "completed" || !publicJob || !report.pause || !report.resume) process.exitCode = 1;
} finally { await browser.close(); }
