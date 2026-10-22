import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluate } from "../src/lib/evaluation";
import { projectForRender, renderMemory } from "../src/lib/reconstruction";
import type { RunSnapshot } from "../src/lib/schemas";

const directory = path.resolve("runs/1792656729263-a5d88589");
const version = process.argv[2] || "v1";
if (!/^v\d+$/.test(version)) throw new Error("Choose a new version label.");
const run = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8")) as RunSnapshot;
if (!run.a || !run.b || !run.report || !run.render_audit) throw new Error("Original evidence missing.");
const report = evaluate({ intents: { keypoints: run.keypoints }, a: run.a, b: run.b, render: run.render_audit, semantic: { results: run.report.keypoint_results.map(row => ({ keypoint_id: row.keypoint_id, in_a: row.in_a, in_b: row.in_b })) } });
const render = await renderMemory(projectForRender(run.a));
writeFileSync(path.join(directory, `t15-review-${version}.json`), JSON.stringify({ scope: "Offline review of unchanged original records, no new model calls; not an image-grounded truth audit", original_summary: run.report.summary, new_report: report, new_render_audit: { warnings: render.warnings, renderer_version: render.renderer_version } }, null, 2), { flag: "wx" });
writeFileSync(path.join(directory, `t15-reconstruction-${version}.png`), render.png, { flag: "wx" });
console.log(JSON.stringify({ original_summary: run.report.summary, new_summary: report.summary, graph: { matched_nodes: report.graph_audit?.matched_nodes, removed: report.graph_audit?.removed_edges.length, added: report.graph_audit?.added_edges.length }, renderer: render.renderer_version, warnings: render.warnings }, null, 2));
