import type { IntentSet, RunSnapshot } from "../../src/lib/schemas";
import os from "node:os";

export interface ServiceInput { image_base64: string; keypoints: IntentSet["keypoints"] }
const root = "http://127.0.0.1:3000";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function status() {
  const response = await fetch(`${root}/api/status`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("The host application is unavailable.");
  return response.json() as Promise<{ configured: boolean; model: string; base_url_host: string; active_run_id: string | null }>;
}
export async function readiness() {
  try {
    const value = await status();
    return value.configured && ["127.0.0.1:11434", "localhost:11434"].includes(value.base_url_host) && value.model === "qwen3-vl:4b-instruct-16k";
  } catch { return false; }
}
export async function releaseModel() {
  try {
    const current = await status();
    if (current.active_run_id || !await readiness()) return;
    await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen3-vl:4b-instruct-16k", keep_alive: 0 }), signal: AbortSignal.timeout(10000) });
  } catch { /* No assumption of release is made by the control UI. */ }
}
export async function executeLocal(input: ServiceInput) {
  if (!await readiness()) throw new Error("The host's free local model is unavailable. No remote model was used.");
  // The existing local API owns the model lock and private audit records.
  // A separate desktop run cannot overlap this service's model requests.
  const waitingSince = Date.now();
  while ((await status()).active_run_id) {
    if (Date.now() - waitingSince > 600_000) throw new Error("The host remained busy with another analysis. Please try later.");
    await delay(1500);
  }
  if (os.freemem() < 1024 * 1024 * 1024) throw new Error("The host is low on free memory. This waiting job was stopped before inference; please return later.");
  const form = new FormData();
  const image = Buffer.from(input.image_base64, "base64");
  form.set("image", new Blob([image], { type: "image/png" }), "figure.png");
  form.set("request", JSON.stringify({ mode: "live", intents: { keypoints: input.keypoints }, example_id: null, example_version: null, parent_run_id: null, include_baseline: false }));
  const response = await fetch(`${root}/api/runs`, { method: "POST", headers: { origin: root }, body: form, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("The host could not start this analysis. No replacement attempt was made.");
  let run = await response.json() as RunSnapshot;
  const started = Date.now();
  while (!["completed", "failed", "interrupted"].includes(run.status)) {
    if (Date.now() - started > 1_800_000) throw new Error("The analysis exceeded the service time limit. Contact the host before retrying.");
    await delay(1500);
    const progress = await fetch(`${root}/api/runs/${encodeURIComponent(run.id)}`, { signal: AbortSignal.timeout(10000) });
    if (!progress.ok) throw new Error("The host lost access to this analysis. No replacement attempt was made.");
    run = await progress.json() as RunSnapshot;
  }
  if (run.status !== "completed" || !run.report) throw new Error(`Analysis stopped at ${run.error?.stage || run.status}: ${run.error?.code || "incomplete"}. No omissions or success scores were inferred.`);
  let reconstruction: string | null = null;
  if (run.assets.reconstruction === `/api/runs/${run.id}/assets/reconstruction.png`) {
    const png = await fetch(`${root}${run.assets.reconstruction}`, { signal: AbortSignal.timeout(10000) });
    if (png.ok) reconstruction = `data:image/png;base64,${Buffer.from(await png.arrayBuffer()).toString("base64")}`;
  }
  // Explicit allowlist: no private run ID, paths, raw calls, original image,
  // server configuration, old history, SVG or arbitrary file URLs.
  return { report: run.report, reconstruction_data_url: reconstruction, model: run.model, prompt_version: run.prompt_version, render_audit: run.render_audit, limitations: [...run.report.limitations, "AI simulated-reader feedback, not a measurement of human understanding.", "The same model is called separately; errors are not statistically independent.", "A reconstruction difference does not establish a defect in your original figure.", "Private processing records are retained on the host computer; only upload public figures."] };
}
