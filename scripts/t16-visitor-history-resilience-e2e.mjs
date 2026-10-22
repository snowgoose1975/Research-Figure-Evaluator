import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const runIdArg = process.argv.findIndex(value => value === "--run-id");
const runId = runIdArg >= 0 ? process.argv[runIdArg + 1] : "";
if (!/^\d{13}-[a-f0-9]{8}$/i.test(runId)) throw new Error("Pass one completed local run ID with --run-id.");
const label = evidenceLabel("T16-visitor-history-resilience");
const files = { report: evidenceFile(label, ".json"), saved: evidenceFile(label, "-saved.png"), offline: evidenceFile(label, "-offline.png") };
assertNewEvidence(Object.values(files));

const site = "https://figure-relay.chicchair5.chatgpt.site";
const figure = "public/published/materials-lattice-design.png";
const runDir = `runs/${runId}`;
const manifest = JSON.parse(readFileSync(`${runDir}/manifest.json`, "utf8"));
const workerHtml = readFileSync("adapters/local-service/public.html", "utf8");
if (manifest.status !== "completed" || !manifest.a || !manifest.b || !manifest.report || !manifest.model) throw new Error("The selected run is not a completed reader and evaluation record.");
const result = {
  model: manifest.model,
  prompt_version: manifest.prompt_version,
  reader_records: { a: manifest.a, b: manifest.b },
  report: manifest.report,
  render_audit: manifest.render_audit,
  reconstruction_data_url: `data:image/png;base64,${readFileSync(`${runDir}/reconstruction.png`).toString("base64")}`,
  limitations: manifest.report.limitations,
};
const serializedResult = JSON.stringify(result).replaceAll("<", "\\u003c");
if (serializedResult.length > 12 * 1024 * 1024) throw new Error("The selected report exceeds the browser-history size limit.");

const checks = [];
const unexpectedErrors = [];
const expectedTransientErrors = [];
const expectedOfflineFailures = [];
const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) });
  if (!pass) throw new Error(name);
};
const historyItems = page => page.locator('section[aria-label="Saved visitor reports"] ul li');
const jobId = "e".repeat(64);
let submissionCount = 0;
let statusPollCount = 0;
let requestWasValid = false;
let deliberateOffline = false;
let outcome = "failed";
let recordHasNoOriginalImage = false;
let offlineReadback = false;
let deletedFromIndexedDb = false;
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", error => (deliberateOffline ? expectedOfflineFailures : unexpectedErrors).push(error.message));
page.on("console", message => {
  if (message.type() !== "error") return;
  if (deliberateOffline) expectedOfflineFailures.push("deliberate tunnel outage");
  else if (message.text().includes("502")) expectedTransientErrors.push("controlled transient HTTP 502");
  else unexpectedErrors.push(message.text());
});

const readSavedRecords = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open("figure-relay-visitor-history", 1);
  open.onerror = () => reject(open.error || new Error("Could not open visitor history IndexedDB."));
  open.onsuccess = () => {
    const database = open.result;
    const transaction = database.transaction("results", "readonly");
    const request = transaction.objectStore("results").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read visitor history."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("Visitor history read aborted.")); };
  };
}));

try {
  await page.route(url => {
    try { return new URL(url).hostname.endsWith(".lhr.life"); } catch { return false; }
  }, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/status" && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ paused: false, active: false, waiting: 0, accepting: true, remaining_hour: 12, remaining_session: 99, model_ready: true, host_resources_ok: true }) });
    if (url.pathname === "/" && request.method() === "GET") return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: { "content-security-policy": `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self' ${site}; base-uri 'none'; form-action 'self'` },
      body: workerHtml,
    });
    if (url.pathname === "/jobs" && request.method() === "POST") {
      submissionCount++;
      const payload = request.postDataJSON();
      requestWasValid = typeof payload.image_base64 === "string" && payload.image_base64.length > 100 && payload.consent === true && Array.isArray(payload.keypoints) && payload.keypoints.length === 3;
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ id: jobId, status: "running", position: 1 }) });
    }
    if (url.pathname === `/jobs/${jobId}` && request.method() === "GET") {
      statusPollCount++;
      if (statusPollCount <= 2) return route.fulfill({ status: 502, contentType: "text/plain", body: "temporary gateway failure" });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: jobId, status: "completed", position: 0, result }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found." }) });
  });

  await page.goto(`${site}/?workspace=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  check("visitor workspace starts empty", true);
  await page.getByText(/Connected to the current temporary host/, { exact: false }).waitFor({ timeout: 60_000 });
  const frame = page.frameLocator('iframe[title="Figure Relay live figure analysis"]');
  await frame.locator("#service-status").getByText("Online", { exact: false }).waitFor({ timeout: 30_000 });
  await frame.locator("#image").setInputFiles(figure);
  await frame.locator("#image-preview.show").waitFor({ timeout: 30_000 });
  const points = frame.getByRole("textbox", { name: "Expected scientific statement" });
  for (let index = 0; index < 3; index++) await points.nth(index).fill(manifest.keypoints[index].text);
  await frame.locator("#consent").check();
  await frame.locator("#submit:not([disabled])").waitFor({ timeout: 30_000 });
  await frame.getByRole("button", { name: "Agree and submit figure", exact: true }).click();
  await frame.getByText(/Temporary connection issue \(1\/5\)/, { exact: false }).waitFor({ timeout: 10_000 });
  check("first transient tunnel error is displayed as a retry", true);
  await historyItems(page).first().waitFor({ timeout: 20_000 });
  await page.getByText("1 saved", { exact: true }).waitFor({ timeout: 15_000 });
  check("form submits valid consent and exactly three checkpoints to the controlled endpoint", requestWasValid && submissionCount === 1);
  check("two HTTP 502 status failures recover through bounded GET polling", statusPollCount === 3);
  const record = (await readSavedRecords())[0];
  check("real completed run report reaches browser-local history", record?.status === "completed" && record.result?.model === manifest.model);
  const forbidden = new Set(["image_base64", "original_image", "original_image_data_url", "uploaded_image", "filename", "file_name"]);
  const containsOriginalImage = value => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsOriginalImage);
    return Object.entries(value).some(([key, child]) => forbidden.has(key.toLowerCase()) || containsOriginalImage(child));
  };
  recordHasNoOriginalImage = !containsOriginalImage(record);
  check("browser history stores no original image or filename", recordHasNoOriginalImage);
  check("terminal result clears its temporary job capability", await page.evaluate(() => localStorage.getItem("figure-relay-pending-job-v1") === null));
  await page.screenshot({ path: files.saved, fullPage: true });

  const search = page.getByRole("searchbox", { name: "Search reports" });
  await search.fill(manifest.model);
  await historyItems(page).filter({ hasText: manifest.model }).waitFor({ timeout: 15_000 });
  check("saved report is searchable by model", await historyItems(page).count() === 1);
  await search.fill("");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  check("saved report survives reload", (await readSavedRecords()).length === 1);

  deliberateOffline = true;
  await page.unrouteAll({ behavior: "wait" });
  await page.route(url => { try { return new URL(url).hostname.endsWith(".lhr.life"); } catch { return false; } }, route => { expectedOfflineFailures.push("blocked tunnel request"); return route.abort("failed"); });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  await historyItems(page).first().getByRole("button").first().click();
  await page.getByText("SAVED IN THIS BROWSER", { exact: true }).waitFor({ timeout: 30_000 });
  const savedPanel = page.locator('section[aria-label="Saved report details"]');
  await savedPanel.getByRole("heading", { name: "Reader A · original figure", exact: true }).waitFor({ timeout: 30_000 });
  await savedPanel.getByText(manifest.model, { exact: false }).first().waitFor({ timeout: 30_000 });
  offlineReadback = true;
  check("saved report opens after tunnel requests are blocked", true);
  await page.screenshot({ path: files.offline, fullPage: true });
  await historyItems(page).first().getByRole("button", { name: "Remove local copy", exact: true }).click();
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  deletedFromIndexedDb = (await readSavedRecords()).length === 0;
  check("deleting the local copy clears IndexedDB", deletedFromIndexedDb);
  check("only expected transient and offline errors occurred", unexpectedErrors.length === 0);
  outcome = "passed";
} finally {
  writeNewEvidence(files.report, JSON.stringify({
    label,
    site,
    outcome,
    mode: "controlled tunnel / HTTP stub; no model call; report fields copied from one completed local public-materials run",
    source_run_id: runId,
    source_model: manifest.model,
    source_prompt_version: manifest.prompt_version,
    submission_count: submissionCount,
    status_poll_count: statusPollCount,
    controlled_http_502_responses: Math.min(statusPollCount, 2),
    report_contains_no_original_image: recordHasNoOriginalImage,
    offline_readback: offlineReadback,
    deleted_from_indexeddb: deletedFromIndexedDb,
    checks,
    unexpected_browser_errors: unexpectedErrors,
    expected_transient_errors: expectedTransientErrors.length,
    expected_offline_failures: expectedOfflineFailures.length,
  }, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ label, outcome, checks, submission_count: submissionCount, status_poll_count: statusPollCount, source_model: manifest.model, offline_readback: offlineReadback, deleted_from_indexeddb: deletedFromIndexedDb }, null, 2));
