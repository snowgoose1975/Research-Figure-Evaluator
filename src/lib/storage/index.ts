import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ModelAttemptAudit, RunSnapshot } from "../schemas";

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
