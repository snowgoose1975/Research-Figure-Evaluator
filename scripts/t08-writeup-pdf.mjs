// T08 R05: render the one-page write-up with Edge and verify the PDF page count.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { assertEvidenceLabel, assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

const sourcePath = "docs/submission/WRITEUP.md";
// Keep earlier evidence immutable; a rerun must choose --label (or the
// RFE_WRITEUP_PREFIX environment variable) and a new prefix.
const prefix = process.env.RFE_WRITEUP_PREFIX ? assertEvidenceLabel(process.env.RFE_WRITEUP_PREFIX) : evidenceLabel("T09");
const pdfPath = evidenceFile(prefix, "-writeup-one-page.pdf");
const reportPath = evidenceFile(prefix, "-writeup-one-page.json");
const previewPath = evidenceFile(prefix, "-writeup-preview.png");
assertNewEvidence([pdfPath, reportPath, previewPath]);
mkdirSync("artifacts/validation", { recursive: true });
const browserPath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const escapeHtml = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = value => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');

function markdownToHtml(markdown) {
  const blocks = markdown.split(/\r?\n\s*\r?\n/).map(block => block.trim()).filter(Boolean);
  return blocks.map(block => {
    const heading = block.match(/^(#{1,3})\s+(.*)$/);
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
    if (block.startsWith("- ")) {
      const items = block.split(/\r?\n/).map(line => line.replace(/^-\s+/, "")).map(item => `<li>${inline(item)}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    return `<p>${inline(block.replace(/\r?\n/g, " "))}</p>`;
  }).join("\n");
}

const source = await readFile(sourcePath, "utf8");
const body = markdownToHtml(source);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Figure Relay — one-page write-up</title>
<style>
  @page { size: A4; margin: 14mm 15mm 13mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    color: #1b1b1b;
    max-width: 180mm;
    margin: 0 auto;
    hyphens: auto;
  }
  h1 { font-size: 17pt; line-height: 1.15; margin: 0 0 5pt; letter-spacing: -0.01em; color: #0d2b3e; }
  p { margin: 0 0 5.2pt; text-align: justify; }
  p:first-of-type { color: #4a4a4a; font-size: 9pt; margin-bottom: 7pt; }
  strong { color: #0d2b3e; }
  a { color: #12506f; text-decoration: none; word-break: break-all; }
  ul { margin: 0 0 5pt 14pt; padding: 0; }
  li { margin: 0 0 2pt; }
  p:last-child { margin-bottom: 0; font-size: 9pt; color: #4a4a4a; }
</style>
</head>
<body>
${body}
</body>
</html>`;

// A4 at 96dpi: 210mm x 297mm = 794 x 1123 px; with 15mm side margins the
// printable width is 180mm = 680px and height is 270mm = 1020px.
const PRINT_WIDTH_PX = 680;
const PRINT_HEIGHT_PX = 1020;

const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage({ viewport: { width: PRINT_WIDTH_PX, height: PRINT_HEIGHT_PX } });
let layout;
try {
  await page.setContent(html, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  layout = await page.evaluate(() => ({
    scroll_height: document.body.scrollHeight,
    scroll_width: document.body.scrollWidth,
    client_width: document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: previewPath, fullPage: true });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", right: "15mm", bottom: "13mm", left: "15mm" },
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}

const pdf = await readFile(pdfPath);
const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
const pdfStat = await stat(pdfPath);
const sourceSha256 = createHash("sha256").update(source).digest("hex");
const report = {
  generated_at: new Date().toISOString(),
  source: sourcePath,
  source_sha256: sourceSha256,
  pdf: pdfPath,
  bytes: pdfStat.size,
  page_count: pageCount,
  format: "A4",
  margin_mm: { top: 14, right: 15, bottom: 13, left: 15 },
  body_font_pt: 10,
  renderer: "Microsoft Edge via Playwright page.pdf",
  viewport_independent: true,
  layout_check: {
    viewport_px: { width: PRINT_WIDTH_PX, height: PRINT_HEIGHT_PX },
    content_px: layout,
    fits_one_page: layout.scroll_height <= PRINT_HEIGHT_PX,
  },
  preview: previewPath,
};
writeNewEvidence(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Rendered ${pdfPath}: ${pageCount} page(s), ${pdfStat.size} bytes.`);
console.log(`Layout: content ${layout.scroll_height}px of ${PRINT_HEIGHT_PX}px printable height; fits=${report.layout_check.fits_one_page}.`);
console.log(`Evidence: ${reportPath}`);
if (pageCount !== 1 || !report.layout_check.fits_one_page) {
  console.error(`FAIL: expected exactly 1 page and content within printable height (pages=${pageCount}, fits=${report.layout_check.fits_one_page}).`);
  process.exit(1);
}
