import { chromium } from "@playwright/test";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const runIdArg = process.argv.findIndex(value => value === "--run-id");
const runId = runIdArg >= 0 ? process.argv[runIdArg + 1] : "";
if (!/^\d{13}-[a-f0-9]{8}$/i.test(runId)) throw new Error("Pass one local run ID with --run-id.");
const label = evidenceLabel("T16-owner-history-e2e");
const files = { report: evidenceFile(label, ".json"), history: evidenceFile(label, "-history.png"), opened: evidenceFile(label, "-opened.png") };
assertNewEvidence(Object.values(files));

const baseUrl = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const checks = [];
const errors = [];
const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) });
  if (!pass) throw new Error(name);
};
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

let outcome = "failed";
let apiTotal = null;
let historyTotalText = "";
try {
  await page.goto(`${baseUrl}/?workspace=1`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { name: "Check a scientific figure", exact: true }).waitFor({ timeout: 30_000 });
  const apiResponse = await page.request.get(`${baseUrl}/api/runs?history=1&q=${encodeURIComponent(runId)}&offset=0&limit=20`);
  check("owner history API responds successfully", apiResponse.ok());
  const apiPage = await apiResponse.json();
  apiTotal = apiPage.total;
  const matching = apiPage.runs.find(run => run.id === runId);
  check("full searchable manifest finds this completed run", Boolean(matching) && apiPage.total === 1 && matching.status === "completed");
  check("history API returns a summary rather than assets or full memory", Boolean(matching) && !("assets" in matching) && !("a" in matching) && !("b" in matching));

  await page.locator(".history-button").click();
  await page.locator("#run-history").waitFor({ state: "visible", timeout: 15_000 });
  const search = page.getByPlaceholder("ID, key point, extracted text, figure, model or error");
  await search.fill(runId);
  const row = page.locator(".history-data-row").filter({ hasText: runId });
  await row.waitFor({ state: "visible", timeout: 30_000 });
  historyTotalText = await page.locator(".history-result-meta").innerText();
  check("owner workbench search returns the requested run", (await page.locator(".history-data-row").count()) === 1 && historyTotalText.includes("1 matching run"));
  await page.screenshot({ path: files.history, fullPage: true });

  await row.click();
  await page.locator(".result-title").waitFor({ state: "visible", timeout: 20_000 });
  check("selecting a history result opens its full report", (await page.locator(".result-title").innerText()).includes(runId));
  check("opened report remains marked as a live model run", (await page.locator(".result-title").innerText()).includes("LIVE MODEL RUN"));
  await page.screenshot({ path: files.opened, fullPage: true });
  check("no unexpected browser errors", errors.length === 0);
  outcome = "passed";
} finally {
  writeNewEvidence(files.report, JSON.stringify({ label, outcome, base_url: baseUrl, run_id: runId, api_total: apiTotal, history_total_text: historyTotalText, checks, unexpected_browser_errors: errors }, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ label, outcome, checks, api_total: apiTotal, history_total_text: historyTotalText }, null, 2));
