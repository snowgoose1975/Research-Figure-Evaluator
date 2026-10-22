import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const runIdArg = process.argv.findIndex(value => value === "--run-id");
const runId = runIdArg >= 0 ? process.argv[runIdArg + 1] : "";
if (!/^\d{13}-[a-f0-9]{8}$/i.test(runId)) throw new Error("Pass one completed local run ID with --run-id.");
const label = evidenceLabel("T16-visitor-history-replay");
const files = {
  report: evidenceFile(label, ".json"),
  saved: evidenceFile(label, "-saved.png"),
  offline: evidenceFile(label, "-offline.png"),
};
assertNewEvidence(Object.values(files));

const stableSite = "https://figure-relay.chicchair5.chatgpt.site";
const runDir = `runs/${runId}`;
const manifest = JSON.parse(readFileSync(`${runDir}/manifest.json`, "utf8"));
if (manifest.status !== "completed" || !manifest.a || !manifest.b || !manifest.report || !manifest.model) {
  throw new Error("The selected local run is not a completed reading and evaluation.");
}
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
if (serializedResult.length > 12 * 1024 * 1024) throw new Error("The completed result exceeds the browser-history size limit.");

const checks = [];
const unexpectedErrors = [];
const expectedOfflineFailures = [];
let deliberateOffline = false;
const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) });
  if (!pass) throw new Error(name);
};
const historyItems = page => page.locator('section[aria-label="Saved visitor reports"] ul li');

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", error => (deliberateOffline ? expectedOfflineFailures : unexpectedErrors).push(error.message));
page.on("console", message => {
  if (message.type() === "error") (deliberateOffline ? expectedOfflineFailures : unexpectedErrors).push(message.text());
});

const jobId = "c".repeat(64);
const bridgeHtml = `<!doctype html><meta charset="utf-8"><script>
const jobId = "${jobId}";
const parentOrigin = "${stableSite}";
parent.postMessage({ type: "rfe:ready" }, parentOrigin);
setTimeout(() => parent.postMessage({ type: "rfe:job-accepted", jobId, capability: jobId, acceptedAt: new Date().toISOString() }, parentOrigin), 1000);
setTimeout(() => parent.postMessage({ type: "rfe:job-finished", jobId, capability: jobId, finishedAt: new Date().toISOString(), status: "completed", result: ${serializedResult} }, parentOrigin), 4000);
</script>`;

let outcome = "failed";
let recordHasNoOriginalImage = false;
let offlineReadback = false;
let deletedFromIndexedDb = false;
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
  }, route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/status") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ paused: false, active: false, waiting: 0, accepting: true, remaining_hour: 12, remaining_session: 99, model_ready: true, host_resources_ok: true }) });
    if (url.pathname === "/") return route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: { "content-security-policy": `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self' ${stableSite}; base-uri 'none'; form-action 'self'` },
      body: bridgeHtml,
    });
    return route.fulfill({ status: 404, body: "Not found." });
  });

  await page.goto(`${stableSite}/?workspace=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  check("new visitor browser starts with empty local history", true);
  await page.getByText(/Connected to the current temporary host/, { exact: false }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  check("a completed result delivered over the exact-origin bridge is saved", (await readSavedRecords()).length === 1);
  const record = (await readSavedRecords())[0];
  check("saved report retains the selected real run model", record.result?.model === manifest.model);
  const forbidden = new Set(["image_base64", "original_image", "original_image_data_url", "uploaded_image", "filename", "file_name"]);
  const containsOriginalImage = value => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsOriginalImage);
    return Object.entries(value).some(([key, child]) => forbidden.has(key.toLowerCase()) || containsOriginalImage(child));
  };
  recordHasNoOriginalImage = !containsOriginalImage(record);
  check("browser-local report contains no uploaded image or filename", recordHasNoOriginalImage);
  check("terminal result clears its temporary capability", await page.evaluate(() => localStorage.getItem("figure-relay-pending-job-v1") === null));
  await page.screenshot({ path: files.saved, fullPage: true });

  const search = page.getByRole("searchbox", { name: "Search reports" });
  await search.fill(manifest.model);
  await historyItems(page).filter({ hasText: manifest.model }).waitFor({ timeout: 15_000 });
  check("saved report can be searched by model metadata", await historyItems(page).count() === 1);
  await search.fill("");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  check("saved report survives a page reload", (await readSavedRecords()).length === 1);

  deliberateOffline = true;
  await page.unrouteAll({ behavior: "wait" });
  await page.route(url => {
    try { return new URL(url).hostname.endsWith(".lhr.life"); } catch { return false; }
  }, route => { expectedOfflineFailures.push(route.request().url().split("?")[0]); return route.abort("failed"); });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  await historyItems(page).first().getByRole("button").first().click();
  await page.getByText("SAVED IN THIS BROWSER", { exact: true }).waitFor({ timeout: 30_000 });
  const savedPanel = page.locator('section[aria-label="Saved report details"]');
  await savedPanel.getByRole("heading", { name: "Reader A · original figure", exact: true }).waitFor({ timeout: 30_000 });
  await savedPanel.getByText(manifest.model, { exact: false }).first().waitFor({ timeout: 30_000 });
  offlineReadback = true;
  check("saved reading opens after service requests are blocked", offlineReadback);
  await page.screenshot({ path: files.offline, fullPage: true });

  await historyItems(page).first().getByRole("button", { name: "Remove local copy", exact: true }).click();
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  deletedFromIndexedDb = (await readSavedRecords()).length === 0;
  check("remove local copy deletes the IndexedDB result", deletedFromIndexedDb);
  check("no unexpected browser errors occurred before the offline step", unexpectedErrors.length === 0);
  outcome = "passed";
} finally {
  writeNewEvidence(files.report, JSON.stringify({
    label,
    site: stableSite,
    outcome,
    mode: "controlled browser bridge replay; no image submission or model request",
    source_run_id: runId,
    source_model: manifest.model,
    source_prompt_version: manifest.prompt_version,
    report_contains_no_original_image: recordHasNoOriginalImage,
    offline_readback: offlineReadback,
    deleted_from_indexeddb: deletedFromIndexedDb,
    checks,
    unexpected_browser_errors: unexpectedErrors,
    expected_offline_failures: expectedOfflineFailures.length,
  }, null, 2) + "\n");
  await browser.close();
}

console.log(JSON.stringify({ label, outcome, checks, source_model: manifest.model, offline_readback: offlineReadback, deleted_from_indexeddb: deletedFromIndexedDb }, null, 2));
