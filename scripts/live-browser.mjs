// Drives one real live evaluation through the browser UI and records what the
// page actually shows. No model output is mocked or edited here.
import { chromium } from "@playwright/test";
import { assertEvidenceLabel, assertNewEvidence, evidenceFile, writeNewEvidence } from "./lib/evidence.mjs";

const baseURL = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const exampleTitle = process.env.RFE_LIVE_TITLE || "Nonlinear mechanical system";
const tag = assertEvidenceLabel(process.env.RFE_LIVE_TAG || "live-browser");
const files = {
  setup: evidenceFile(tag, "-setup.png"),
  result: evidenceFile(tag, "-result.png"),
  record: evidenceFile(tag, ".json"),
};
assertNewEvidence(Object.values(files));
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const timeoutMs = Number(process.env.RFE_BROWSER_TIMEOUT_MS || 900_000);

const consoleErrors = [];
const pageErrors = [];
const failedResponses = [];
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", error => pageErrors.push(error.stack || error.message));
page.on("response", response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });

try {
  const status = await (await page.request.get(`${baseURL}/api/status`)).json();
  if (!status.configured) throw new Error("Status endpoint reports no configured model; refusing a fake live run.");
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByRole("button", { name: /Published research/ }).click();
  const card = page.locator(".example-entry").filter({ has: page.getByRole("heading", { name: exampleTitle, exact: true }) });
  await card.locator("button.example-card").click();
  for (const button of await page.locator(".confirm-button").all()) {
    if (!(await button.evaluate(el => el.classList.contains("is-confirmed")))) await button.click();
  }
  const baseline = page.locator(".baseline-toggle input");
  if (await baseline.isChecked() === false) await baseline.check();
  await page.screenshot({ path: files.setup, fullPage: true });
  const started = Date.now();
  await page.getByRole("button", { name: /Run evaluation/ }).click();
  let done = false;
  while (Date.now() - started < timeoutMs) {
    if (await page.getByText("Evaluation trace").count() && await page.getByText("KEYPOINT-BY-KEYPOINT").count()) { done = true; break; }
    const alert = await page.getByRole("alert").innerText().catch(() => "");
    if (alert) throw new Error(`UI reported a run error: ${alert}`);
    if (await page.getByText("Run failed").count() || await page.getByText("Run interrupted").count()) throw new Error("Run failed before completion.");
    await page.waitForTimeout(1000);
  }
  if (!done) throw new Error(`Run did not complete within ${timeoutMs} ms.`);
  const runId = await page.locator(".result-title p").innerText().then(text => text.replace(/^Run\s+/, "").split(" · ")[0]);
  await page.screenshot({ path: files.result, fullPage: true });
  const images = await page.locator(".image-panel img").count();
  const rows = await page.locator(".report-row").count();
  const baselineRows = await page.locator(".baseline-row").count();
  const bodyText = await page.locator("body").innerText();
  const detail = await (await page.request.get(`${baseURL}/api/runs/${runId}`)).json();
  const snapshot = detail.run || detail;
  writeNewEvidence(files.record, JSON.stringify({
    evidence_id: tag, empirical_model_results: true, captured_via: "browser", example_title: exampleTitle,
    run_id: runId, status: snapshot.status, model: snapshot.model, prompt_version: snapshot.prompt_version,
    engine_version: snapshot.engine_version, duration_ms: Date.now() - started,
    browser_checks: { image_panels: images, report_rows: rows, baseline_rows: baselineRows,
      live_label_visible: bodyText.includes("LIVE MODEL") || bodyText.includes("Live evaluation"),
      baseline_label_visible: bodyText.includes("Independent keypoint-aware baseline") },
    report_summary: snapshot.report?.summary ?? null,
    keypoint_results: (snapshot.report?.keypoint_results || []).map(item => ({ keypoint_id: item.keypoint_id, in_a: item.in_a.status, in_b: item.in_b.status })),
    render_audit: snapshot.render_audit, baseline: snapshot.baseline ? { error: snapshot.baseline.error, result: snapshot.baseline.result } : null,
    consoleErrors, pageErrors, failedResponses,
  }, null, 2));
  console.log(JSON.stringify({ runId, status: snapshot.status, images, rows, baselineRows, consoleErrors, pageErrors, failedResponses }, null, 2));
} finally {
  await browser.close();
}
