import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const label = evidenceLabel("T16-visitor-history-e2e");
const files = {
  report: evidenceFile(label, ".json"),
  completed: evidenceFile(label, "-completed.png"),
  offline: evidenceFile(label, "-offline.png"),
};
assertNewEvidence(Object.values(files));

const site = "https://figure-relay.chicchair5.chatgpt.site";
const figure = "public/published/materials-lattice-design.png";
const sourceRun = JSON.parse(readFileSync("runs/T15-live-v1/public-materials.json", "utf8"));
if (sourceRun.status !== "completed" || !Array.isArray(sourceRun.keypoints) || sourceRun.keypoints.length < 3) {
  throw new Error("The public materials fixture needs at least three checkpoints from its completed public run.");
}

const checks = [];
const errors = [];
const expectedOfflineErrors = [];
const offlineRequestFailures = [];
const submissionRequests = [];
let deliberateOffline = false;
const historyItems = page => page.locator('section[aria-label="Saved visitor reports"] ul li');
const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) });
  if (!pass) throw new Error(name);
};
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", error => (deliberateOffline ? expectedOfflineErrors : errors).push(error.message));
page.on("console", message => {
  if (message.type() === "error") (deliberateOffline ? expectedOfflineErrors : errors).push(message.text());
});
page.on("request", request => {
  try {
    const url = new URL(request.url());
    if (url.hostname.endsWith(".lhr.life") && request.method() === "POST" && url.pathname === "/jobs") {
      submissionRequests.push({ host: url.hostname, method: request.method(), path: url.pathname });
    }
  } catch {}
});

let outcome = "failed";
let actualModel = null;
let completedRecordId = null;
let storedReportHasNoOriginalImage = false;
let offlineReadback = false;
let deletedFromIndexedDb = false;

async function readSavedRecords() {
  return page.evaluate(() => new Promise((resolve, reject) => {
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
}

try {
  await page.goto(`${site}/?workspace=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  check("published T16 visitor workspace loads with an empty local history", true);

  await page.getByText(/Connected to the current temporary host/, { exact: false }).waitFor({ timeout: 60_000 });
  const frame = page.frameLocator('iframe[title="Figure Relay live figure analysis"]');
  await frame.locator('input[type="file"]').waitFor({ timeout: 60_000 });
  await frame.locator("#service-status").getByText("Online", { exact: false }).waitFor({ timeout: 30_000 });
  check("public page discovers the current host and loads the analysis form", true);

  await frame.locator('input[type="file"]').setInputFiles(figure);
  await frame.locator("#image-preview.show").waitFor({ timeout: 30_000 });
  const points = frame.getByRole("textbox", { name: "Expected scientific statement" });
  for (let index = 0; index < 3; index++) {
    const statement = sourceRun.keypoints[index]?.text;
    if (typeof statement !== "string" || statement.trim().length < 3) throw new Error(`Public checkpoint ${index + 1} is unavailable.`);
    await points.nth(index).fill(statement);
  }
  await frame.locator("#consent").check();
  const submit = frame.getByRole("button", { name: "Agree and submit figure", exact: true });
  await submit.waitFor({ state: "visible", timeout: 30_000 });
  await submit.waitFor({ state: "attached", timeout: 30_000 });
  await frame.locator("#submit:not([disabled])").waitFor({ state: "visible", timeout: 30_000 });
  await submit.click();
  check("one public-figure submission was sent after consent", submissionRequests.length === 1);

  await historyItems(page).first().waitFor({ timeout: 30_000 });
  await page.getByText("1 saved", { exact: true }).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: files.completed, fullPage: true });
  const saved = await readSavedRecords();
  if (saved.length !== 1) throw new Error(`Expected one browser-local report, found ${saved.length}.`);
  const record = saved[0];
  completedRecordId = typeof record.id === "string" ? record.id : null;
  const report = record.result && typeof record.result === "object" ? record.result : {};
  actualModel = typeof report.model === "string" ? report.model : null;
  check("completed real result is stored in IndexedDB with a reported model", record.status === "completed" && Boolean(actualModel));
  const forbidden = new Set(["image_base64", "original_image", "original_image_data_url", "uploaded_image", "filename", "file_name"]);
  const containsOriginalImage = value => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsOriginalImage);
    return Object.entries(value).some(([key, child]) => forbidden.has(key.toLowerCase()) || containsOriginalImage(child));
  };
  storedReportHasNoOriginalImage = !containsOriginalImage(record);
  check("saved browser history contains no uploaded image or filename", storedReportHasNoOriginalImage);
  check("pending capability is removed after the terminal result", await page.evaluate(() => localStorage.getItem("figure-relay-pending-job-v1") === null));

  const search = page.getByRole("searchbox", { name: "Search reports" });
  await search.fill(actualModel);
  await historyItems(page).filter({ hasText: actualModel }).waitFor({ timeout: 15_000 });
  check("saved report can be found by its model metadata", await historyItems(page).count() === 1);
  await search.fill("");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  check("saved report survives a page reload", (await readSavedRecords()).length === 1);

  deliberateOffline = true;
  await page.route(url => {
    try { return new URL(url).hostname.endsWith(".lhr.life"); } catch { return false; }
  }, route => {
    offlineRequestFailures.push(route.request().url());
    return route.abort("failed");
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Your figure checks", exact: true }).waitFor({ timeout: 60_000 });
  await historyItems(page).first().waitFor({ timeout: 30_000 });
  await historyItems(page).first().getByRole("button").first().click();
  await page.getByText("SAVED IN THIS BROWSER", { exact: true }).waitFor({ timeout: 30_000 });
  await page.locator('section[aria-label="Saved report details"]').getByText(actualModel, { exact: false }).first().waitFor({ timeout: 30_000 });
  offlineReadback = await page.getByRole("heading", { name: "Reader A · original figure" }).isVisible().catch(() => false);
  check("saved report opens after the tunnel is blocked and the site is reloaded", offlineReadback && offlineRequestFailures.length > 0);
  await page.screenshot({ path: files.offline, fullPage: true });

  const card = historyItems(page).filter({ hasText: actualModel }).first();
  await card.getByRole("button", { name: "Remove local copy", exact: true }).click();
  await page.getByText("No checks saved in this browser yet.", { exact: true }).waitFor({ timeout: 30_000 });
  deletedFromIndexedDb = (await readSavedRecords()).length === 0;
  check("removing the local copy deletes the IndexedDB report", deletedFromIndexedDb);
  check("exactly one live submission was made", submissionRequests.length === 1);
  check("no unexpected browser errors before the deliberate offline step", errors.length === 0);
  outcome = "passed";
} finally {
  writeNewEvidence(files.report, JSON.stringify({
    label,
    site,
    outcome,
    scope: "One live submission of a published public materials figure to the user's free local model service; browser-local history, reload, deliberate tunnel outage, offline report view and deletion. This is product-path evidence, not model-accuracy evidence.",
    sample: "materials-lattice-design",
    submission_count: submissionRequests.length,
    submission_hosts: submissionRequests.map(item => item.host),
    actual_model: actualModel,
    saved_record_id: completedRecordId,
    stored_report_has_no_original_image: storedReportHasNoOriginalImage,
    offline_request_failures: offlineRequestFailures.length,
    offline_readback: offlineReadback,
    deleted_from_indexeddb: deletedFromIndexedDb,
    checks,
    unexpected_browser_errors: errors,
    expected_offline_browser_errors: expectedOfflineErrors,
  }, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ label, outcome, checks, submission_count: submissionRequests.length, actual_model: actualModel, offline_readback: offlineReadback, deleted_from_indexeddb: deletedFromIndexedDb }, null, 2));
