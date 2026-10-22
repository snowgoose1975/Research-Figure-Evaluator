import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const label = evidenceLabel("T16-poll-retry-smoke");
const files = { report: evidenceFile(label, ".json"), screenshot: evidenceFile(label, ".png") };
assertNewEvidence(Object.values(files));

const imagePath = "public/published/materials-lattice-design.png";
const publicHtml = readFileSync("adapters/local-service/public.html", "utf8");
const jobId = "d".repeat(64);
const checks = [];
const unexpectedErrors = [];
const expectedTransientErrors = [];
let postCount = 0;
let pollCount = 0;
let server;
let browser;
let outcome = "failed";
const finalResult = {
  model: "controlled-poll-retry-fixture",
  prompt_version: "fixture",
  reader_records: {
    a: { title: "Reader A fixture", summary: "Saved result returned after temporary gateway errors.", facts: [], graph: { nodes: [], relations: [], groups: [], conditions: [] }, plots: [], uncertainties: [], evidence: [], completeness: "partial" },
    b: { title: "Reader B fixture", summary: "This result came from a controlled no-model test.", facts: [], graph: { nodes: [], relations: [], groups: [], conditions: [] }, plots: [], uncertainties: [], evidence: [], completeness: "partial" },
  },
  report: { summary: "Controlled polling test only.", keypoint_results: [], limitations: ["No model call was made."] },
  limitations: ["No model call was made."],
};

const check = (name, pass) => {
  checks.push({ name, pass: Boolean(pass) });
  if (!pass) throw new Error(name);
};
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

server = createServer((req, res) => {
  const route = (req.url || "").split("?")[0];
  if (req.method === "GET" && route === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    res.end(publicHtml);
    return;
  }
  if (req.method === "GET" && route === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET" && route === "/status") {
    json(res, 200, { paused: false, active: false, waiting: 0, accepting: true, remaining_hour: 12, remaining_session: 99, model_ready: true, host_resources_ok: true });
    return;
  }
  if (req.method === "POST" && route === "/jobs") {
    postCount++;
    req.resume();
    req.on("end", () => json(res, 202, { id: jobId, status: "running", position: 1 }));
    return;
  }
  if (req.method === "GET" && route === `/jobs/${jobId}`) {
    pollCount++;
    if (pollCount <= 2) {
      res.writeHead(502, { "content-type": "text/plain", "cache-control": "no-store" });
      res.end("temporary gateway failure");
      return;
    }
    json(res, 200, { id: jobId, status: "completed", position: 0, result: finalResult });
    return;
  }
  json(res, 404, { error: "Not found." });
});

try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", error => unexpectedErrors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    if (message.text().includes("502")) expectedTransientErrors.push("HTTP 502 from controlled temporary gateway response");
    else unexpectedErrors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#service-status").getByText("Online", { exact: false }).waitFor({ timeout: 15_000 });
  await page.locator("#image").setInputFiles(imagePath);
  await page.locator("#image-preview.show").waitFor({ timeout: 15_000 });
  const points = page.getByRole("textbox", { name: "Expected scientific statement" });
  await points.nth(0).fill("The control page accepts one request.");
  await points.nth(1).fill("Temporary status errors do not repeat the image submission.");
  await points.nth(2).fill("The completed report remains available after status polling recovers.");
  await page.locator("#consent").check();
  const submit = page.getByRole("button", { name: "Agree and submit figure", exact: true });
  await page.locator("#submit:not([disabled])").waitFor({ timeout: 15_000 });
  await submit.click();
  await page.getByText(/Temporary connection issue \(1\/5\)/, { exact: false }).waitFor({ timeout: 8_000 });
  check("first HTTP 502 is shown as a temporary status issue", true);
  await page.getByText(/Analysis finished — evidence needs review/, { exact: false }).waitFor({ timeout: 12_000 });
  check("the existing job completes after two transient HTTP 502 responses", pollCount === 3);
  check("the image is submitted only once while status GET is retried", postCount === 1);
  check("the result is rendered after polling recovers", await page.locator("#result").evaluate(el => el.classList.contains("show")));
  check("no unexpected browser errors", unexpectedErrors.length === 0);
  await page.screenshot({ path: files.screenshot, fullPage: true });
  outcome = "passed";
} finally {
  writeNewEvidence(files.report, JSON.stringify({
    label,
    outcome,
    mode: "controlled local HTTP stub; no model call and no persistent run",
    post_count: postCount,
    status_poll_count: pollCount,
    transient_http_502_responses: Math.min(pollCount, 2),
    checks,
    unexpected_browser_errors: unexpectedErrors,
    expected_transient_browser_errors: expectedTransientErrors.length,
  }, null, 2) + "\n");
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ label, outcome, checks, post_count: postCount, status_poll_count: pollCount }, null, 2));
