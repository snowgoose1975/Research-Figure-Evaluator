// T08 R04 compatibility: a run saved before plot_audit.matched_plots existed
// must still render coverage without "undefined".
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const baseURL = process.env.RFE_APP_URL || "http://127.0.0.1:3000";
const runId = process.env.RFE_LEGACY_RUN || "1792629154544-bc6d1ac7";
const label = evidenceLabel("T08-legacy-coverage");
const screenshotPath = evidenceFile(label, ".png");
const jsonPath = evidenceFile(label, ".json");
assertNewEvidence([screenshotPath, jsonPath]);
mkdirSync("artifacts/validation", { recursive: true });
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const checks = [];
const consoleErrors = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: Boolean(ok), detail }); if (!ok) throw new Error(`${name}: ${detail || "assertion failed"}`); };

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
try {
  await page.goto(`${baseURL}/?run=${encodeURIComponent(runId)}`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator(".coverage-panel").waitFor({ timeout: 15_000 });
  check("legacy run opens by deep link", (await page.locator(".result-title p").innerText()).includes(runId));
  const panelText = await page.locator(".coverage-panel").innerText();
  check("coverage panel renders", (await page.locator(".coverage-panel").isVisible()));
  check("no undefined value in coverage panel", !panelText.includes("undefined"), panelText.slice(0, 500));
  check("plot audit explicitly not executed", /Plot-axis & series-shape audit[\s\S]*NOT EXECUTED/.test(panelText), panelText.slice(0, 800));
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const downloadWait = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: "Markdown" }).click();
  const download = await downloadWait;
  const downloadedName = download.suggestedFilename().replace(/[^A-Za-z0-9._-]/g, "_");
  const markdownPath = evidenceFile(label, `-${downloadedName}`);
  assertNewEvidence([markdownPath]);
  await download.saveAs(markdownPath);
  const markdown = await readFile(markdownPath, "utf8");
  check("legacy markdown has no undefined", !markdown.includes("undefined"), markdown.slice(0, 500));
  check("legacy markdown falls back to matched-series count", /matched plots: 0/.test(markdown) && /NOT EXECUTED/.test(markdown), markdown.split("\n").filter(line => line.includes("Plot-axis")).join("\n"));
} catch (error) {
  checks.push({ name: "execution", ok: false, detail: error instanceof Error ? error.message : String(error) });
  throw error;
} finally {
  writeNewEvidence(jsonPath, JSON.stringify({ evidence_id: label, baseURL, runId, checks, consoleErrors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ evidence_id: label, checks, consoleErrors }, null, 2));
