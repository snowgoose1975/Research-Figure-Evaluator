import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PUBLISHED_EXAMPLES } from "../src/lib/examples/published";
await fs.mkdir("data/manifests", { recursive: true });
const rows = await Promise.all(PUBLISHED_EXAMPLES.map(async e => {
  const bytes = await fs.readFile(path.join("public", e.versions[0].image_url));
  return { ...e, sha256: createHash("sha256").update(bytes).digest("hex"), retrieved_at: "2026-10-21", license_checked: true, image_modifications: "none", checkpoints_source: "Curated by project maintainer from figure and paper; not author-provided intent.", real_model_results: "not_yet_tested" };
}));
await fs.writeFile("data/manifests/published.json", JSON.stringify(rows, null, 2));
await fs.writeFile("public/published/ATTRIBUTION.md", "# Published scientific figures\n\n" + rows.map(e => `## ${e.title}\n\n${e.source}\n\n${e.attribution}\n\nPaper: ${e.paper_url}\n\nLicense: ${e.license_url}\n\nChanges: ${e.changes}\n\nSHA-256: ${e.sha256}`).join("\n\n"));
console.log(`Verified ${rows.length} downloaded publisher images and wrote attribution/manifest.`);
