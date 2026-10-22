import { readFileSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getPublishedExample } from "../src/lib/examples/published";
import { auditScientific } from "../src/lib/evaluation/scientific";
import { MemorySchema, type RunSnapshot } from "../src/lib/schemas";
import type { CaseIndex, PublicCase, CaseSummary } from "../src/lib/examples/case-studies";

// Fixed first-completion/first-failure selection, not a search for best results.
const descriptions: Record<string, string> = {
  "published-physics-nonlinear-system": "Labels can survive while the reconstructed mechanical arrangement changes. Inspect the topology; checkpoint retention is not a fidelity score.",
  "published-materials-lattice-design": "The three-step design story survived, but the reconstruction reduced lattice geometry to labeled boxes. Geometry is outside the current automatic audit.",
  "published-mathematics-metric-rewiring": "A reference-line label can survive without preserving its plotted height or shape. Compare the curve records and the images independently.",
  "published-mathematics-network-permutation": "This complex network figure did not complete the first read. No reconstruction or checkpoint success is inferred from the failure.",
};
const protocol = JSON.parse(readFileSync("artifacts/validation/protocol-p022-4b16k10.json", "utf8")) as { model: string; prompt_version: string; completed: number; failed: number; rows: CaseIndex["protocol"]["rows"] };
const root = path.resolve("public/case-studies");
const outputIndex = path.join(root, "index-v2.json");
if (existsSync(outputIndex)) throw new Error("Public case export already exists; create a separately reviewed new version rather than overwriting it.");
const planned = Object.keys(descriptions).map(exampleId => {
  const rows = protocol.rows.filter(row => row.example_id === exampleId);
  const selected = rows.find(row => row.status === "completed") ?? rows[0];
  if (!selected) throw new Error(`Missing frozen example ${exampleId}`);
  const source = path.join("runs", selected.run_id, "manifest.json");
  const bytes = readFileSync(source);
  const run = JSON.parse(bytes.toString("utf8")) as RunSnapshot;
  const example = getPublishedExample(exampleId);
  if (!example || run.example_id !== exampleId || run.mode !== "live" || run.status !== selected.status) throw new Error("Unreviewed source rejected.");
  const id = exampleId.replace("published-", "");
  const folder = path.join(root, id);
  if (existsSync(path.join(folder, "record-v2.json"))) throw new Error(`Refusing existing case version: ${id}`);
  const a = run.a ? MemorySchema.parse(run.a) : null;
  const b = run.b ? MemorySchema.parse(run.b) : null;
  const audit = a && b ? auditScientific(a, b) : null;
  const reconstruction = run.status === "completed" && Boolean(run.assets.reconstruction);
  const summary: CaseSummary = { id, title: example.title, domain: example.domain, status: run.status as "completed" | "failed", takeaway: descriptions[exampleId], original: example.versions[0].image_url, reconstruction: reconstruction ? `/case-studies/${id}/reconstruction.png` : null, record: `/case-studies/${id}/record-v2.json`, source_run_id: run.id, paper_url: example.paper_url!, attribution: example.attribution!, license: example.license };
  // Explicit whitelist: no stage metadata, config, headers, raw prompts, URLs to
  // private assets, user uploads, or arbitrary files from the run directory.
  const keypoints = run.keypoints.map(({ id, text, claim, scientific }) => ({ id, text, claim, ...(scientific ? { scientific } : {}), confirmation_provenance: "protocol_marked_not_independently_confirmed" as const }));
  const record: PublicCase = { ...summary, provenance: { kind: "recorded_local_model_run", created_at: run.created_at, model: run.model, prompt_version: run.prompt_version, source_manifest_sha256: createHash("sha256").update(bytes).digest("hex"), note: "Historical local-model replay, not a new inference. Checkpoints were project-curated and protocol-marked; no independent item-by-item human confirmation is recorded. The ambiguous historical author_confirmed flag is omitted from this public projection. The original saved report is preserved." }, keypoints, a, b, report: run.report, render_audit: run.render_audit, error: run.error ? { code: run.error.code, stage: run.error.stage ?? null, message: "Reader A did not complete a valid extraction within the recorded output budget. No checkpoint omissions were scored." } : null, offline_audit: audit ? { note: "Current deterministic rule audit of the saved A/B memories, computed offline for this case page. It does not replace the original report or change historical statistics. Findings concern records and require image review.", coverage: audit.coverage, findings: audit.findings } : null };
  return { folder, record, summary, reconstruction, runId: run.id };
});
mkdirSync(root, { recursive: true });
for (const item of planned) {
  mkdirSync(item.folder, { recursive: true });
  if (item.reconstruction) {
    const source = readFileSync(path.join("runs", item.runId, "reconstruction.png"));
    const target = path.join(item.folder, "reconstruction.png");
    if (existsSync(target)) { if (!source.equals(readFileSync(target))) throw new Error("Existing reconstruction differs; export a new asset version."); }
    else copyFileSync(path.join("runs", item.runId, "reconstruction.png"), target);
  }
  writeFileSync(path.join(item.folder, "record-v2.json"), JSON.stringify(item.record, null, 2) + "\n", { flag: "wx" });
}
const index: CaseIndex = { version: "T12-v1", selection: "First completed attempt per figure; first failed attempt when none completed. Full fixed-protocol outcomes are listed below, including all failures. Selection is for inspection, not an accuracy estimate.", protocol: { completed: protocol.completed, failed: protocol.failed, total: protocol.rows.length, model: protocol.model, prompt_version: protocol.prompt_version, rows: protocol.rows.map(({ example_id, attempt, run_id, status }) => ({ example_id, attempt, run_id, status })) }, cases: planned.map(item => item.summary) };
writeFileSync(outputIndex, JSON.stringify(index, null, 2) + "\n", { flag: "wx" });
console.log(`Exported ${index.cases.length} reviewed public-figure replays; ${index.protocol.completed}/${index.protocol.total} fixed-protocol completions preserved. No source run changed.`);
