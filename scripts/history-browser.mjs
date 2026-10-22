// T08 R01 browser evidence: open real and failed saved runs through the UI,
// exercise the full-ID lookup, deep link, export and 390px layout.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const baseURL = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const label = evidenceLabel("T08-history-browser");
const files = {
  list: evidenceFile(label, "-list.png"),
  realRun: evidenceFile(label, "-real-run.png"),
  failed: evidenceFile(label, "-failed.png"),
  notFound: evidenceFile(label, "-not-found.png"),
  mobile: evidenceFile(label, "-mobile.png"),
  console: evidenceFile(label, ".json"),
};
assertNewEvidence(Object.values(files));
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const realRunId = process.env.RFE_REAL_RUN || "1792609657136-e85156a8";
const failedRunId = process.env.RFE_FAILED_RUN || "1792608204732-e4de481f";
const missingRunId = "9999999999999-doesnotexist";
const checks = [];
const consoleErrors = [];
const pageErrors = [];
const failedResponses = [];
let currentStep = "initial load";
let unexpectedConsoleErrors = [];
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", message => { if (message.type() === "error") consoleErrors.push({ step: currentStep, text: message.text() }); });
page.on("pageerror", error => pageErrors.push(error.stack || error.message));
page.on("response", response => { if (response.status() >= 400 && !response.url().includes(missingRunId)) failedResponses.push({ status: response.status(), url: response.url() }); });
const check = (name, ok, detail = "") => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) throw new Error(`${name}: ${detail || "assertion failed"}`); };
const resultTitle = () => page.locator(".result-title p").innerText();

try {
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 30_000 });

  await page.locator(".history-button").click();
  await page.locator("#run-history").waitFor();
  check("history card opens from topbar", await page.locator("#run-history").isVisible());
  check("history lists recent runs", await page.locator(".history-data-row").count() === 10, `rows=${await page.locator(".history-data-row").count()}`);
  check("history shows ID and status columns", (await page.locator(".history-head").innerText()).toUpperCase().includes("RUN ID") && (await page.locator(".history-head").innerText()).toUpperCase().includes("STATUS"));
  await page.screenshot({ path: files.list, fullPage: true });

  await page.locator(".history-field input[placeholder*='Run ID']").fill("live");
  await page.waitForTimeout(150);
  const liveRows = await page.locator(".history-data-row").count();
  check("history filters live runs", liveRows > 0 && (await page.locator(".history-data-row").first().innerText()).includes("LIVE"), `live rows=${liveRows}`);
  const recentLiveRow = page.locator(".history-data-row").filter({ hasText: "COMPLETED" }).first();
  const recentLiveText = await recentLiveRow.innerText();
  const recentLiveId = recentLiveText.match(/\d{13}-[a-z0-9]+/)?.[0];
  check("a recent completed live run is visible", Boolean(recentLiveId), recentLiveText);

  await page.locator(".history-field input[placeholder*='Run ID']").fill(recentLiveId || "");
  await page.waitForTimeout(150);
  const filtered = page.locator(".history-data-row", { hasText: recentLiveId || "" });
  check("filter finds requested run", await filtered.count() === 1, `count=${await filtered.count()}`);
  await filtered.click();
  await page.waitForFunction(id => document.body.innerText.includes(id), recentLiveId, { timeout: 15_000 });
  check("recent run opened from history row", (await resultTitle()).includes(recentLiveId));

  // The older baseline-bearing run can fall outside the ten-row history page,
  // so open it by full ID. This checks the full-ID path independently of the
  // current page contents while leaving older evidence and runs untouched.
  await page.locator(".history-button").click();
  await page.locator(".history-field.open-run input").fill(realRunId);
  await page.locator(".history-field.open-run button").click();
  await page.waitForFunction(id => document.body.innerText.includes(id), realRunId, { timeout: 15_000 });
  check("real run opened by full ID", (await resultTitle()).includes(realRunId));
  check("real run shows source and reconstruction", await page.locator(".image-panel img").count() === 2);
  check("real run shows four keypoint rows", await page.locator(".report-row").count() === 4, `rows=${await page.locator(".report-row").count()}`);
  check("real run shows four baseline rows", await page.locator(".baseline-row").count() === 4, `rows=${await page.locator(".baseline-row").count()}`);
  check("deep link written to address bar", page.url().includes(`run=${encodeURIComponent(realRunId)}`), page.url());
  await page.screenshot({ path: files.realRun, fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(id => document.body.innerText.includes(id), realRunId, { timeout: 15_000 });
  check("deep link reloads the same run", (await resultTitle()).includes(realRunId));
  check("deep-linked run still shows report", await page.locator(".report-row").count() === 4);

  const downloadWait = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const download = await downloadWait;
  const savedPath = evidenceFile(label, `-${download.suggestedFilename().replace(/[^A-Za-z0-9._-]/g, "_")}`);
  assertNewEvidence([savedPath]);
  await download.saveAs(savedPath);
  const exported = JSON.parse(await readFile(savedPath, "utf8"));
  check("history export contains the opened run", (exported.id || exported.run?.id) === realRunId && savedPath.endsWith(".json"), savedPath);

  await page.locator(".history-button").click();
  currentStep = "failed run";
  await page.locator(".history-field.open-run input").fill(failedRunId);
  await page.locator(".history-field.open-run button").click();
  await page.waitForFunction(id => document.body.innerText.includes(id), failedRunId, { timeout: 15_000 });
  const failureText = await page.locator(".notice.error").innerText();
  check("failed run opened by full ID", (await resultTitle()).includes(failedRunId));
  check("failed run names failure stage", failureText.includes("Run failed") && failureText.includes("reading_a"), failureText);
  check("failed run keeps recorded error", failureText.includes("incomplete") || failureText.includes("incomplete".toUpperCase()) || failureText.includes("Model response was incomplete"), failureText);
  await page.screenshot({ path: files.failed, fullPage: true });

  await page.locator(".history-button").click();
  currentStep = "missing run";
  await page.locator(".history-field.open-run input").fill(missingRunId);
  await page.locator(".history-field.open-run button").click();
  await page.locator(".history-message").waitFor({ timeout: 10_000 });
  const missingText = await page.locator(".history-message").innerText();
  check("missing ID has a readable message", missingText.includes("was not found"), missingText);
  await page.screenshot({ path: files.notFound, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  currentStep = "mobile layout";
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator(".history-button").click();
  await page.locator("#run-history").waitFor();
  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, tableScroll: document.querySelector(".history-table-wrap")?.scrollWidth, tableClient: document.querySelector(".history-table-wrap")?.clientWidth }));
  check("390px page has no horizontal overflow", metrics.scroll <= metrics.width, JSON.stringify(metrics));
  check("history table scrolls inside its card", Number(metrics.tableScroll) > Number(metrics.tableClient), JSON.stringify(metrics));
  check("open-by-ID form usable at 390px", await page.locator(".history-field.open-run input").isVisible() && await page.locator(".history-field.open-run button").isVisible());
  await page.locator(".history-field.open-run input").fill(realRunId);
  await page.locator(".history-field.open-run button").click();
  await page.waitForFunction(id => document.body.innerText.includes(id), realRunId, { timeout: 15_000 });
  check("real run opens at 390px", (await resultTitle()).includes(realRunId));
  await page.screenshot({ path: files.mobile, fullPage: true });
  unexpectedConsoleErrors = consoleErrors.filter(entry => !(entry.step === "missing run" && entry.text.includes("404")));
  check("no unexpected console errors", unexpectedConsoleErrors.length === 0, JSON.stringify(unexpectedConsoleErrors));
} catch (error) {
  checks.push({ name: "execution", ok: false, detail: error instanceof Error ? error.message : String(error) });
  throw error;
} finally {
  writeNewEvidence(files.console, JSON.stringify({ evidence_id: label, baseURL, realRunId, failedRunId, missingRunId, checks, consoleErrors, unexpectedConsoleErrors, pageErrors, failedResponses, expectedConsoleErrors: consoleErrors.filter(entry => !unexpectedConsoleErrors.includes(entry)) }, null, 2));
  await browser.close();
}

console.log(JSON.stringify({ evidence_id: label, checks, consoleErrors, pageErrors, failedResponses }, null, 2));
