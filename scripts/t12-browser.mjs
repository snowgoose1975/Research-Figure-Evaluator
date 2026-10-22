import { chromium } from "@playwright/test";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";
const label = evidenceLabel("T12-browser");
const publicOnly = process.argv.includes("--public");
const base = publicOnly ? "http://127.0.0.1:3001" : "http://127.0.0.1:3000";
const files = Object.fromEntries(["home", "case", "mobile", "workspace"].map(name => [name, evidenceFile(label, `-${name}.png`)]));
const reportPath = evidenceFile(label, ".json");
assertNewEvidence([...Object.values(files), reportPath]);
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [], errors = [], apiRequests = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
const check = (name, pass, detail = "") => { checks.push({ name, pass: Boolean(pass), detail }); if (!pass) throw new Error(name); };
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "See how AI reads your scientific figure." }).waitFor();
  await page.getByRole("button", { name: /Inspect this replay/ }).first().waitFor();
  check("four reviewed cases load without any private API", await page.getByRole("button", { name: /Inspect this replay/ }).count() === 4 && apiRequests.length === 0);
  await page.screenshot({ path: files.home, fullPage: true });
  await page.getByText("8/12 runs completed", { exact: true }).click();
  check("all twelve protocol outcomes and all four failures are disclosed", await page.locator("tbody tr").count() === 12 && await page.locator("tbody tr").filter({ hasText: "failed" }).count() === 4);
  const index = await page.request.get(`${base}/case-studies/index-v2.json`).then(response => response.json());
  for (const item of index.cases) {
    await page.goto(`${base}/?case=${item.id}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: item.title, exact: true }).waitFor();
    check(`case ${item.id} clearly identifies historical provenance`, await page.getByRole("heading", { name: "Historical local-model replay" }).isVisible());
    if (item.status === "failed") check("failed case has no invented reconstruction or checkpoint success", await page.getByText("No reconstruction: the first read failed.").isVisible() && await page.getByRole("heading", { name: "Checkpoint results" }).count() === 0);
    else check(`case ${item.id} shows saved report separately from offline audit`, await page.getByRole("heading", { name: "Checkpoint results" }).isVisible() && await page.getByRole("heading", { name: "Deterministic rule checks" }).isVisible());
  }
  await page.goto(`${base}/?case=materials-lattice-design`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Lattice topology to porous structure", exact: true }).waitFor();
  await page.screenshot({ path: files.case, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check("case detail has no mobile horizontal overflow", await noOverflow());
  await page.screenshot({ path: files.mobile, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Check my figure", exact: true }).first().click();
  if (publicOnly) {
    await page.getByRole("heading", { name: "Online analysis is not connected yet" }).waitFor();
    check("public site honestly stops at recorded cases", await page.getByRole("heading", { name: "Online analysis is not connected yet" }).isVisible() && apiRequests.length === 0);
    check("static package has no run API", (await page.request.get(`${base}/api/runs`)).status() === 404);
    check("ambiguous first export is excluded from static package", (await page.request.get(`${base}/case-studies/index.json`)).status() === 404);
  } else {
    await page.getByRole("heading", { name: "Choose a figure", exact: true }).waitFor();
    check("step one requires selecting an image", await page.getByRole("button", { name: "Continue", exact: true }).isDisabled());
    await page.getByRole("button", { name: /Engineering controls/ }).click();
    await page.locator(".example-entry").filter({ hasText: "Mass–spring–damper oscillator" }).locator("button.example-card").click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    check("step two requires explicit confirmation", await page.getByRole("button", { name: "Continue", exact: true }).isDisabled());
    while (await page.getByRole("button", { name: "Confirm", exact: true }).count()) await page.getByRole("button", { name: "Confirm", exact: true }).first().click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator(".advanced-options summary").click();
    await page.getByRole("button", { name: "Scripted tutorial", exact: true }).click();
    await page.getByRole("button", { name: "Start check", exact: true }).click();
    await page.locator(".review-panel").waitFor({ timeout: 30_000 });
    check("scripted mode remains labeled and produces no new real model experiment", await page.getByText("Scripted demonstration", { exact: true }).isVisible());
    check("large image comparison precedes the review list", await page.evaluate(() => Boolean(document.querySelector(".image-comparison").compareDocumentPosition(document.querySelector(".review-panel")) & Node.DOCUMENT_POSITION_FOLLOWING)));
    check("technical audits are collapsed", await page.locator("details.technical-details[open]").count() === 0);
    await page.screenshot({ path: files.workspace, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    check("workspace results have no mobile horizontal overflow", await noOverflow());
    await page.goto(`${base}/?run=1792609657136-e85156a8`, { waitUntil: "networkidle" });
    await page.locator(".result-title").waitFor();
    check("old run deep links still reach the workspace", (await page.locator(".result-title").innerText()).includes("1792609657136-e85156a8"));
  }
  check("no console or page errors", errors.length === 0, JSON.stringify(errors));
} finally {
  writeNewEvidence(reportPath, JSON.stringify({ label, base, publicOnly, checks, errors, apiRequests, scope: "Browser/UI validation; saved real cases and at most one explicitly scripted local run. No new model inference." }, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ label, checks, errors }, null, 2));
