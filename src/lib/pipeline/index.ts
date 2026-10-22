import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluate } from "../evaluation";
import { getExample } from "../examples";
import { getPublishedExample } from "../examples/published";
import { ModelAdapterError, readOriginal, readReconstruction, judgeKeypoints, directCheck, type ModelAuditContext } from "../model";
import { projectForRender, renderMemory, RENDERER_VERSION } from "../reconstruction";
import { MemorySchema, PROMPT_VERSION, SCHEMA_VERSION, type RunRequest, type RunSnapshot, type ModelCallMeta, type MemoryRecord } from "../schemas";
import { appendModelCall, digest, engineVersion, getRun, listRuns, newRunId, recordJson, saveAsset, writeSnapshot } from "../storage";
import { configSnapshot, modelConfig, serviceStatus } from "./config";
import { inspectImage, normalizeImage } from "./images";

const globals = globalThis as typeof globalThis & { figureRelay?: { active: string | null; initialized: Promise<void> | null } };
const state = globals.figureRelay ??= { active: null, initialized: null };
export const activeRunId = () => state.active;
export async function initialize() {
  state.initialized ??= (async () => {
    for (const r of await listRuns()) if (!["completed", "failed", "interrupted"].includes(r.status) && r.id !== state.active) {
      r.status = "interrupted"; r.completed_at = new Date().toISOString();
      r.error = { code: "process_interrupted", message: "The previous process stopped before this run finished.", stage: "initialization" };
      await writeSnapshot(r);
    }
  })();
  await state.initialized;
}
function completeMemory(memory: MemoryRecord) {
  const value = MemorySchema.parse(memory);
  if (value.completeness !== "complete") throw new ModelAdapterError(value.completeness === "unsupported" ? "no_readable_content" : "capacity_exceeded", "This reader could not produce a complete extraction; keypoint omissions were not scored.");
  return value;
}
export async function startRun(request: RunRequest, uploaded?: Buffer): Promise<RunSnapshot> {
  await initialize();
  if (state.active) throw new ModelAdapterError("busy", "Another evaluation is running. Wait for it to finish.");
  if (request.intents.keypoints.some(k => !k.author_confirmed)) throw new Error("Confirm all author keypoints before evaluation.");
  const example = request.example_id ? (getPublishedExample(request.example_id) ?? getExample(request.example_id)) : null;
  if (request.example_id && !example) throw new Error("Unknown example.");
  if (request.mode === "mock" && (!example || !("gold" in example) || uploaded)) throw new Error("Scripted demo is only available for authored teaching controls. Published figures and uploads require a live model.");
  if (request.mode === "live" && !(await serviceStatus(state.active)).configured) throw new ModelAdapterError("not_configured", "The selected vision model is not available. Start the local model or configure an existing service.");
  const imageVersion = example?.versions.find(v => v.id === request.example_version);
  if (!uploaded && !imageVersion) throw new Error("Choose an example version or upload a PNG/JPEG.");
  const originalBytes = uploaded ?? await fs.readFile(path.join(process.cwd(), "public", imageVersion!.image_url.replace(/^\//, "")));
  const image = await normalizeImage(originalBytes);
  const info = inspectImage(image);
  const config = modelConfig();
  const snapshot = request.mode === "live" ? await configSnapshot(config) : null;
  const engine = await engineVersion();
  const run: RunSnapshot = {
    id: newRunId(), created_at: new Date().toISOString(), completed_at: null, mode: request.mode, status: "queued", example_id: example?.id ?? null, example_version: request.example_version, parent_run_id: request.parent_run_id,
    input_digest: digest(image), intent_digest: digest(request.intents), settings_digest: digest({ engine, schema: SCHEMA_VERSION, prompts: PROMPT_VERSION, renderer: RENDERER_VERSION, model: request.mode === "mock" ? "scripted-teaching-data-v1" : config.model, baseUrl: config.baseUrl, protocol: config.protocol, maxOutputTokens: config.maxOutputTokens, mode: request.mode }),
    model: request.mode === "mock" ? "scripted-teaching-data-v1" : config.model, protocol: request.mode === "mock" ? "scripted" : config.protocol, schema_version: SCHEMA_VERSION, prompt_version: PROMPT_VERSION, engine_version: engine,
    keypoints: request.intents.keypoints, a: null, b: null, report: null, render_audit: null, stages: [], assets: {}, baseline: null, error: null, config_snapshot: snapshot,
  };
  // Claim the slot before the next await, including when simultaneous HTTP requests arrive.
  if (state.active) throw new ModelAdapterError("busy", "Another evaluation is running.");
  state.active = run.id;
  try {
    run.assets.original = await saveAsset(run.id, `original.${info.mime === "image/png" ? "png" : "jpg"}`, image);
    await writeSnapshot(run);
  } catch (e) { state.active = null; throw e; }
  void execute(run, request, image, info.mime).finally(() => { if (state.active === run.id) state.active = null; });
  return structuredClone(run);
}
async function execute(run: RunSnapshot, request: RunRequest, image: Buffer, mime: "image/png" | "image/jpeg") {
  const config = modelConfig();
  const example = request.example_id ? getExample(request.example_id) : null;
  const stage = async (name: RunSnapshot["status"], inputs: string[]) => { run.status = name; run.stages.push({ stage: name, at: new Date().toISOString(), input_digests: inputs, meta: null }); await writeSnapshot(run); };
  const meta = (m: ModelCallMeta) => { run.stages[run.stages.length - 1].meta = m; };
  const auditFor = (name: string): ModelAuditContext => {
    let index = 0;
    return { stage: name, nextIndex: () => ++index, onAttempt: attempt => appendModelCall(run.id, attempt) };
  };
  try {
    await stage("reading_a", [run.input_digest]);
    if (run.mode === "mock") run.a = completeMemory(structuredClone(request.example_version === "challenged" ? example!.demo_a : example!.gold));
    else { const result = await readOriginal({ base64: image.toString("base64"), mime }, config, auditFor("reading_a")); meta(result.meta); run.a = completeMemory(result.value); }
    await recordJson(run.id, "reader-a", run.a);
    await stage("reconstructing", [digest(run.a)]);
    // Read A's saved record back from disk: no original image is passed into the renderer.
    const persistedA = MemorySchema.parse(JSON.parse(await fs.readFile(path.join(process.cwd(), "runs", run.id, "reader-a.json"), "utf8")));
    const rendered = await renderMemory(projectForRender(persistedA));
    if (rendered.structural_audit === "failed") throw new ModelAdapterError("render_failed", "The memory could not be reconstructed.");
    run.assets.reconstruction = await saveAsset(run.id, "reconstruction.png", rendered.png);
    run.assets.svg = await saveAsset(run.id, "reconstruction.svg", rendered.svg);
    const audit = { width: rendered.width, height: rendered.height, rendered_item_ids: rendered.rendered_item_ids, unsupported_item_ids: rendered.unsupported_item_ids, warnings: rendered.warnings, structural_audit: rendered.structural_audit, visual_review: rendered.visual_review, renderer_version: rendered.renderer_version };
    run.render_audit = audit;
    await stage("reading_b", [digest(rendered.png)]);
    if (run.mode === "mock") run.b = completeMemory(structuredClone(request.example_version === "challenged" ? example!.demo_b : example!.gold));
    else { const result = await readReconstruction({ base64: rendered.png.toString("base64"), mime: "image/png" }, config, auditFor("reading_b")); meta(result.meta); run.b = completeMemory(result.value); }
    await recordJson(run.id, "reader-b", run.b);
    await stage("evaluating", [run.intent_digest, digest(run.a), digest(run.b)]);
    if (run.mode === "live") {
      const judged = await judgeKeypoints({ keypoints: run.keypoints, a: run.a, b: run.b }, config, auditFor("evaluating"));
      meta(judged.meta);
      run.report = evaluate({ intents: request.intents, a: run.a, b: run.b, render: audit, semantic: judged.value });
    } else {
      run.report = evaluate({ intents: request.intents, a: run.a, b: run.b, render: audit });
      run.report.limitations.unshift("SCRIPTED DEMO: A and B are authored teaching records, not model outputs. These are not empirical accuracy results.");
    }
    if (request.include_baseline && run.mode === "live") {
      run.baseline = { result: null, meta: null, error: null };
      try {
        const baseline = await directCheck({ image: { base64: image.toString("base64"), mime }, keypoints: run.keypoints }, config, auditFor("baseline"));
        run.baseline.meta = baseline.meta;
        const expected = new Set(run.keypoints.map(k => k.id));
        if (baseline.value.results.length !== expected.size || new Set(baseline.value.results.map(r => r.keypoint_id)).size !== expected.size || baseline.value.results.some(r => !expected.has(r.keypoint_id))) throw new Error("Baseline keypoint coverage is invalid.");
        run.baseline.result = baseline.value;
      } catch (error) {
        if (error instanceof ModelAdapterError && error.audit) run.baseline.meta = error.audit;
        const detail = error instanceof ModelAdapterError ? `${error.code}: ${error.message}` : "invalid keypoint coverage";
        run.baseline.error = `The independent direct-check baseline did not complete (${detail}); main results are retained.`;
      }
      await recordJson(run.id, "baseline", run.baseline);
    }
    run.status = "completed"; run.completed_at = new Date().toISOString();
    await writeSnapshot(run);
  } catch (error) {
    const failedStage = run.status;
    if (error instanceof ModelAdapterError && error.audit && run.stages.length) run.stages[run.stages.length - 1].meta = error.audit;
    run.error = { code: error instanceof ModelAdapterError ? error.code : "pipeline_error", message: error instanceof ModelAdapterError ? error.message : "The current stage could not complete. Earlier artifacts have been preserved.", stage: failedStage };
    run.status = "failed"; run.completed_at = new Date().toISOString();
    await writeSnapshot(run);
  }
}
export { getRun, listRuns };
