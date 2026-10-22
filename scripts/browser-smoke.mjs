import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const baseURL = "http://127.0.0.1:3000";
const label = evidenceLabel("browser-smoke");
const files = {
  home: evidenceFile(label, "-home.png"),
  result: evidenceFile(label, "-result.png"),
  mobile: evidenceFile(label, "-mobile.png"),
  console: evidenceFile(label, "-console.json"),
};
assertNewEvidence(Object.values(files));
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const checks = [];
const consoleErrors = [];
const pageErrors = [];
const failedResponses = [];
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", error => pageErrors.push(error.stack || error.message));
page.on("response", response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
const check = (name, ok, detail = "") => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) throw new Error(`${name}: ${detail || "assertion failed"}`); };
const waitForDone = async () => {
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    const response = await page.locator(".result-title").innerText().catch(() => "");
    if (response) {
      const alert = await page.getByRole("alert").innerText().catch(() => "");
      if (alert) throw new Error(`UI reported an actionable run error: ${alert}`);
      const status = await page.locator(".progress-top span").innerText().catch(() => "");
      if (await page.getByText("Evaluation trace").count() && (await page.getByText("KEYPOINT-BY-KEYPOINT").count())) return;
      if (await page.getByText("Run failed").count() || await page.getByText("Run interrupted").count()) throw new Error("Run failed before completion.");
      if (status.toLowerCase().includes("failed")) throw new Error(`Run failed: ${status}`);
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Run did not complete within 30 seconds.");
};
const downloadText = async button => {
  const downloadWait = page.waitForEvent("download", { timeout: 10_000 });
  await button.click();
  const download = await downloadWait;
  const path = evidenceFile(label, `-${download.suggestedFilename().replace(/[^A-Za-z0-9._-]/g, "_")}`);
  assertNewEvidence([path]);
  await download.saveAs(path);
  return { path, text: await readFile(path, "utf8") };
};

try {
  const response = await page.goto(baseURL, { waitUntil: "networkidle", timeout: 30_000 });
  check("home responds", response?.ok(), `HTTP ${response?.status()}`);
  await page.getByRole("button", { name: /Published research/ }).waitFor();
  const publishedCards = page.locator(".example-entry");
  await publishedCards.first().waitFor();
  check("published-first default filter", await page.getByRole("button", { name: /Published research/ }).getAttribute("aria-pressed") === "true");
  check("four published cards", await publishedCards.count() === 4, `found ${await publishedCards.count()}`);
  check("publication attribution and paper links visible", await page.locator(".published-card-meta").count() === 4 && await page.locator(".paper-link-row a").count() === 4);
  await publishedCards.first().locator("button.example-card").click();
  check("published script mode disabled", await page.getByRole("button", { name: "Scripted tutorial" }).isDisabled());
  check("published checkpoints start unconfirmed", await page.locator(".confirm-button.is-confirmed").count() === 0);
  check("published provenance instructions visible", (await page.locator(".keypoint-card").innerText()).includes("not author-supplied intent"));
  await page.screenshot({ path: files.home, fullPage: true });

  await page.getByRole("button", { name: /Engineering controls/ }).click();
  await page.locator(".example-entry").filter({ has: page.getByRole("heading", { name: "Mass–spring–damper oscillator", exact: true }) }).locator("button.example-card").click();
  check("teaching selected enables scripted mode", await page.getByRole("button", { name: "Scripted tutorial" }).isEnabled());
  const confirmAll = async () => {
    for (const button of await page.locator(".confirm-button").all()) if (!(await button.evaluate(el => el.classList.contains("is-confirmed")))) await button.click();
  };
  await confirmAll();
  await page.getByRole("button", { name: "Scripted tutorial" }).click();
  await page.getByRole("button", { name: /Run evaluation/ }).click();
  await waitForDone();
  check("scripted demo label visible", await page.getByText("SCRIPTED DEMO", { exact: true }).count() > 0 && await page.getByText("Scripted demonstration").count() > 0);
  check("both source and reconstruction PNGs visible", await page.locator(".image-panel img").count() === 2);
  check("report contains keypoint rows", await page.locator(".report-row").count() >= 3);
  const runId = await page.locator(".result-title p").innerText().then(t => t.replace(/^Run\s+/, "").split(" · ")[0]);
  const jsonDownload = await downloadText(page.getByRole("button", { name: "JSON" }));
  check("JSON report download contains run record", jsonDownload.text.includes(runId) && jsonDownload.text.includes("report"), jsonDownload.path);
  const markdownDownload = await downloadText(page.getByRole("button", { name: "Markdown" }));
  check("Markdown report download contains keypoint report", markdownDownload.text.includes("#") && /keypoint|claim|figure/i.test(markdownDownload.text), markdownDownload.path);
  await page.screenshot({ path: files.result, fullPage: true });

  await page.getByRole("button", { name: /Engineering controls/ }).click();
  await page.locator(".example-entry").filter({ has: page.getByRole("heading", { name: "Mass–spring–damper oscillator", exact: true }) }).locator("button.example-card").click();
  await page.locator(".version-select select").selectOption("challenged");
  await confirmAll();
  await page.getByRole("button", { name: "Scripted tutorial" }).click();
  await page.getByRole("button", { name: /Run evaluation/ }).click();
  await waitForDone();
  const secondRunId = await page.locator(".result-title p").innerText().then(t => t.replace(/^Run\s+/, "").split(" · ")[0]);
  await page.locator(".compare-controls select").nth(0).selectOption(runId);
  await page.locator(".compare-controls select").nth(1).selectOption(secondRunId);
  await page.getByRole("button", { name: "Compare versions" }).click();
  await page.locator(".comparison-result").waitFor({ timeout: 10_000 });
  check("clear/challenged comparison renders", await page.locator(".comparison-result").count() === 1, `${runId} vs ${secondRunId}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobileMetrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  check("390px mobile no horizontal overflow", mobileMetrics.scroll <= mobileMetrics.width, JSON.stringify(mobileMetrics));
  check("mobile controls usable", await page.getByRole("button", { name: /Published research/ }).isVisible() && await page.getByLabel("DOMAIN").isVisible());
  await page.screenshot({ path: files.mobile, fullPage: true });
} catch (error) {
  checks.push({ name: "execution", ok: false, detail: error instanceof Error ? error.message : String(error) });
  throw error;
} finally {
  writeNewEvidence(files.console, JSON.stringify({ evidence_id: label, baseURL, checks, consoleErrors, pageErrors, failedResponses }, null, 2));
  await browser.close();
}

console.log(JSON.stringify({ evidence_id: label, checks, consoleErrors, pageErrors, failedResponses }, null, 2));
