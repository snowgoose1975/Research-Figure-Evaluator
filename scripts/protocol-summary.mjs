// Prints a Markdown table from a protocol summary file. Read-only.
import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) { console.error("Usage: node scripts/protocol-summary.mjs artifacts/validation/protocol-<tag>.json"); process.exit(2); }
const data = JSON.parse(await readFile(file, "utf8"));
console.log(`model: ${data.model} | prompt: ${data.prompt_version} | attempts/figure: ${data.attempts_per_figure} | baseline: ${data.baseline}`);
console.log(`completed ${data.completed}/${data.rows.length}\n`);
console.log("| figure | attempt | run | status | duration | keypoint A/B | error |");
console.log("|---|---|---|---|---|---|---|");
for (const row of data.rows) {
  const points = row.keypoints ? row.keypoints.join(" ") : "—";
  console.log(`| ${row.example_id.replace(/^published-/, "")} | ${row.attempt} | ${row.run_id} | ${row.status} | ${(row.duration_ms / 1000).toFixed(0)}s | ${points} | ${row.error ?? ""} |`);
}
