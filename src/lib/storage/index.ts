import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ModelAttemptAudit, RunHistorySummary, RunSnapshot } from "../schemas";

const ROOT = path.resolve(process.cwd(), "runs");
const safe = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(id);
export function digest(value: unknown): string {
  const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v;
  return createHash("sha256").update(Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest("hex");
}
export function newRunId() { return `${Date.now()}-${randomUUID().slice(0, 8)}`; }
export async function engineVersion(): Promise<string> {
  const collect = async (folder: string): Promise<string[]> => {
    const rows = await fs.readdir(folder, { withFileTypes: true });
    const nested = await Promise.all(rows.map(r => r.isDirectory() ? collect(path.join(folder, r.name)) : Promise.resolve(r.name.endsWith(".ts") ? [path.join(folder, r.name)] : [])));
    return nested.flat();
  };
  const files = [...await collect(path.join(process.cwd(), "src", "lib")), path.join(process.cwd(), "package-lock.json")].sort();
  const entries = await Promise.all(files.map(async file => [path.relative(process.cwd(), file).replaceAll("\\", "/"), await fs.readFile(file, "utf8")]));
  return digest(entries);
}
export function runPath(id: string) {
  if (!safe(id)) throw new Error("Invalid run ID.");
  return path.join(ROOT, id);
}
export async function writeSnapshot(run: RunSnapshot) {
  const folder = runPath(run.id);
  await fs.mkdir(folder, { recursive: true });
  const target = path.join(folder, "manifest.json");
  try {
    const old = JSON.parse(await fs.readFile(target, "utf8")) as RunSnapshot;
    if (["completed", "failed", "interrupted"].includes(old.status)) throw new Error("Finalized runs cannot be overwritten.");
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  // Append an immutable stage snapshot before updating the active manifest.
  await fs.writeFile(path.join(folder, `snapshot-${Date.now()}-${randomUUID().slice(0, 6)}.json`), JSON.stringify(run, null, 2), { flag: "wx" });
  await fs.writeFile(target, JSON.stringify(run, null, 2));
}
export async function getRun(id: string): Promise<RunSnapshot | null> {
  try { return JSON.parse(await fs.readFile(path.join(runPath(id), "manifest.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function listRuns(): Promise<RunSnapshot[]> {
  await fs.mkdir(ROOT, { recursive: true });
  const names = await fs.readdir(ROOT, { withFileTypes: true });
  const rows = await Promise.all(names.filter(n => n.isDirectory() && safe(n.name)).map(async n => {
    try { return await getRun(n.name); } catch { return null; }
  }));
  return rows.filter((r): r is RunSnapshot => r !== null).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}
function memorySearchText(memory: RunSnapshot["a"]): string {
  if (!memory) return "";
  return [
    memory.title, memory.domain, memory.figure_type, memory.summary,
    ...memory.graph.nodes.flatMap(node => [node.label, ...node.aliases]),
    ...memory.graph.relations.flatMap(relation => [relation.kind, relation.direction, relation.label]),
    ...memory.graph.groups.map(group => group.label),
    ...memory.graph.conditions.map(condition => condition.text),
    ...memory.facts.flatMap(fact => [fact.subject, fact.predicate, fact.object, fact.certainty, ...fact.qualifiers]),
    ...memory.plots.flatMap(plot => [plot.title, plot.x_axis.label, plot.x_axis.unit, plot.y_axis.label, plot.y_axis.unit, ...plot.notes, ...plot.series.map(series => series.label)]),
    ...memory.uncertainties.map(item => item.note),
    ...memory.evidence.flatMap(item => [item.visible_text, item.note]),
  ].filter(Boolean).join(" ");
}
function runSearchText(run: RunSnapshot): string {
  const report = run.report;
  const reportText = report ? [
    ...report.keypoint_results.flatMap(item => [item.text, item.in_a.status, item.in_a.rationale, item.in_b.status, item.in_b.rationale, item.observed_stage, item.render_item_status, ...item.suggestions]),
    ...report.a_to_b.flatMap(item => [item.status, item.rationale]),
    ...report.unmatched_b_claims.map(item => item.text),
    ...report.limitations,
    ...(report.scientific_findings ?? []).map(item => item.summary),
    report.graph_audit?.note,
    ...(report.graph_audit?.unmatched_a_nodes ?? []),
    ...(report.graph_audit?.unmatched_b_nodes ?? []),
    ...(report.graph_audit?.removed_edges ?? []).flatMap(edge => [edge.source, edge.target, edge.kind]),
    ...(report.graph_audit?.added_edges ?? []).flatMap(edge => [edge.source, edge.target, edge.kind]),
  ] : [];
  return [
    run.id, run.created_at, run.completed_at, run.mode, run.status, run.example_id, run.example_version,
    run.model, run.error?.code, run.error?.message, run.error?.stage,
    ...run.keypoints.map(point => point.text), memorySearchText(run.a), memorySearchText(run.b), ...reportText,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}
export async function searchRunHistory(query: string, offset: number, limit: number): Promise<{ runs: RunHistorySummary[]; total: number; offset: number; limit: number; has_more: boolean }> {
  await fs.mkdir(ROOT, { recursive: true });
  const names = await fs.readdir(ROOT, { withFileTypes: true });
  const needle = query.trim().toLocaleLowerCase();
  const matches: RunHistorySummary[] = [];
  const directories = names.filter(entry => entry.isDirectory() && safe(entry.name));
  for (let start = 0; start < directories.length; start += 32) {
    const batch = await Promise.all(directories.slice(start, start + 32).map(async entry => {
      try {
        const raw = await fs.readFile(path.join(ROOT, entry.name, "manifest.json"), "utf8");
        const run = JSON.parse(raw) as RunSnapshot;
        if (run.id !== entry.name || typeof run.created_at !== "string" || !Array.isArray(run.keypoints)) return null;
        if (needle && !runSearchText(run).includes(needle)) return null;
        const summary: RunHistorySummary = {
          id: run.id,
          created_at: run.created_at,
          completed_at: run.completed_at,
          mode: run.mode,
          status: run.status,
          example_id: run.example_id,
          example_version: run.example_version,
          model: run.model || null,
          error: run.error ? [run.error.code, run.error.message].filter(Boolean).join(": ") : null,
          keypoint_count: run.keypoints.length,
        };
        return summary;
      } catch { return null; }
    }));
    matches.push(...batch.filter((row): row is RunHistorySummary => row !== null));
  }
  matches.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const page = matches.slice(offset, offset + limit);
  return { runs: page, total: matches.length, offset, limit, has_more: offset + page.length < matches.length };
}
export async function saveAsset(runId: string, assetId: string, bytes: Buffer | string) {
  if (!/^(original\.(png|jpg)|reconstruction\.(png|svg)|reader-a\.json|reader-b\.json|baseline\.json)$/.test(assetId)) throw new Error("Unregistered asset name.");
  await fs.mkdir(runPath(runId), { recursive: true });
  await fs.writeFile(path.join(runPath(runId), assetId), bytes, { flag: "wx" });
  return `/api/runs/${runId}/assets/${assetId}`;
}
export async function readAsset(run: RunSnapshot, assetId: string) {
  const allowed = Object.values(run.assets).some(url => url === `/api/runs/${run.id}/assets/${assetId}`);
  if (!allowed || !/^(original\.(png|jpg)|reconstruction\.(png|svg))$/.test(assetId)) return null;
  return fs.readFile(path.join(runPath(run.id), assetId));
}
export async function recordJson(runId: string, kind: "reader-a" | "reader-b" | "baseline", value: unknown) {
  return saveAsset(runId, `${kind}.json`, JSON.stringify(value, null, 2));
}
export async function appendModelCall(runId: string, attempt: ModelAttemptAudit) {
  const folder = runPath(runId);
  await fs.mkdir(folder, { recursive: true });
  await fs.appendFile(path.join(folder, "model-calls.jsonl"), `${JSON.stringify(attempt)}\n`, "utf8");
}
