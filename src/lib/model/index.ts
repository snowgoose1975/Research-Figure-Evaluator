import { z } from "zod";
import {
  DirectOutputSchema,
  JudgeOutputSchema,
  MemoryOutputSchema,
  MemorySchema,
  type DirectCheckInput,
  type DirectOutput,
  type JudgeInput,
  type JudgeOutput,
  type MemoryRecord,
  type ModelAttemptAudit,
  type ModelCallMeta,
  type ModelConfig,
  type ModelResult,
  type ReaderImageInput,
} from "../schemas";
import { DIRECT_PROMPT, JUDGE_PROMPT, PROMPT_VERSION, READER_A_PROMPT, READER_B_PROMPT } from "../prompts";

export class ModelAdapterError extends Error {
  constructor(readonly code: string, message: string, readonly audit?: ModelCallMeta, readonly detail?: unknown) {
    super(message);
    this.name = "ModelAdapterError";
  }
}

export interface ModelAuditContext {
  stage: string;
  nextIndex: () => number;
  onAttempt?: (attempt: ModelAttemptAudit) => void | Promise<void>;
}

type RequestSpec<T> = { schema: z.ZodType<T>; prompt: string; stage: string; image?: ReaderImageInput; text: string };
type CallOptions<T> = { audit?: ModelAuditContext; phase?: "initial" | "repair"; validate?: (value: T) => T };
type Extracted = {
  text: string;
  requestId: string | null;
  model: string | null;
  usage: Record<string, number> | null;
  finishReason: string | null;
  failure: { code: string; message: string } | null;
};

function jsonSchema(schema: z.ZodType<unknown>, name: string) {
  return { name, strict: true, schema: z.toJSONSchema(schema, { target: "draft-7" }) };
}

function validConfig(config: ModelConfig) {
  if (!config.baseUrl || !config.model || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0 || !Number.isFinite(config.maxOutputTokens) || config.maxOutputTokens <= 0) {
    throw new ModelAdapterError("invalid_config", "Model configuration is invalid.");
  }
  if (config.protocol !== "responses" && config.protocol !== "chat") throw new ModelAdapterError("invalid_config", "Model protocol is unsupported.");
}

function endpoint(config: ModelConfig) {
  let root: string;
  try { root = new URL(config.baseUrl).toString().replace(/\/+$/, ""); }
  catch { throw new ModelAdapterError("invalid_config", "Model service URL is invalid."); }
  return `${root}/${config.protocol === "responses" ? "responses" : "chat/completions"}`;
}

function imageData(image: ReaderImageInput) {
  if (!image || !["image/png", "image/jpeg"].includes(image.mime) || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)) {
    throw new ModelAdapterError("invalid_input", "Image input must contain base64 PNG or JPEG data.");
  }
  return `data:${image.mime};base64,${image.base64}`;
}

function requestBody(config: ModelConfig, spec: RequestSpec<unknown>) {
  const format = jsonSchema(spec.schema, `${spec.stage}_output`);
  const prompt = `${spec.prompt}\n\nRequired JSON schema:\n${JSON.stringify(format.schema)}\n\n${spec.text}`;
  if (config.protocol === "responses") {
    const content: Array<Record<string, unknown>> = [];
    if (spec.image) content.push({ type: "input_image", image_url: imageData(spec.image) });
    content.push({ type: "input_text", text: prompt });
    return { model: config.model, input: [{ role: "user", content }], max_output_tokens: config.maxOutputTokens,
      text: { format: { type: "json_schema", ...format } } };
  }
  const content: Array<Record<string, unknown>> = [];
  if (spec.image) content.push({ type: "image_url", image_url: { url: imageData(spec.image) } });
  content.push({ type: "text", text: prompt });
  return { model: config.model, messages: [{ role: "user", content }], max_tokens: config.maxOutputTokens, temperature: 0,
    response_format: { type: "json_schema", json_schema: format } };
}

function numberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
  return Object.keys(result).length ? result : null;
}

// A usage record is complete only when both sides of the token count are
// present. A total alone, or only the input side, leaves the output unknown;
// unknown fields are never filled with zero.
function usageComplete(usage: Record<string, number> | null): boolean {
  if (!usage) return false;
  const has = (key: string) => typeof usage[key] === "number" && Number.isFinite(usage[key]);
  return (has("prompt_tokens") && has("completion_tokens")) || (has("input_tokens") && has("output_tokens"));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key]);
}

function extract(payload: unknown, protocol: ModelConfig["protocol"]): Extracted {
  const p = asRecord(payload);
  const base = { text: "", requestId: null as string | null, model: null as string | null, usage: null as Record<string, number> | null, finishReason: null as string | null };
  if (!p) return { ...base, failure: { code: "invalid_response", message: "Model returned an invalid response." } };
  const requestId = stringField(p, "id");
  const model = stringField(p, "model");
  const usage = numberRecord(p.usage);
  if (protocol === "responses") {
    const finishReason = stringField(p, "status");
    if (p.status === "incomplete" || p.incomplete_details) return { ...base, requestId, model, usage, finishReason, failure: { code: "incomplete", message: "Model response was incomplete." } };
    const parts = asArray(p.output).flatMap(item => asArray(asRecord(item)?.content));
    if (parts.some(part => asRecord(part)?.type === "refusal")) return { ...base, requestId, model, usage, finishReason, failure: { code: "refusal", message: "Model declined this request." } };
    const text = stringField(p, "output_text") ?? parts.map(asRecord).filter((part): part is Record<string, unknown> => part?.type === "output_text")
      .map(part => stringField(part, "text") ?? "").join("");
    return { text, requestId, model, usage, finishReason, failure: null };
  }
  const choice = asRecord(asArray(p.choices)[0]);
  if (!choice) return { ...base, requestId, model, usage, failure: { code: "invalid_response", message: "Model returned an invalid response." } };
  const finishReason = stringField(choice, "finish_reason");
  if (finishReason === "length") return { ...base, requestId, model, usage, finishReason, failure: { code: "incomplete", message: "Model output reached the token limit before the response was complete." } };
  const message = nestedRecord(choice, "message");
  if (message?.refusal) return { ...base, requestId, model, usage, finishReason, failure: { code: "refusal", message: "Model declined this request." } };
  let text = "";
  if (typeof message?.content === "string") text = message.content;
  else text = asArray(message?.content).map(asRecord).filter((part): part is Record<string, unknown> => part !== null)
    .map(part => stringField(part, "text") ?? "").join("");
  return { text, requestId, model, usage, finishReason, failure: message ? null : { code: "invalid_response", message: "Model returned an invalid response." } };
}

function aggregateMeta(fallbackModel: string, attempts: ModelAttemptAudit[], repairs?: number): ModelCallMeta {
  const usage: Record<string, number> = {};
  let complete = attempts.length > 0;
  for (const attempt of attempts) {
    if (!usageComplete(attempt.usage)) complete = false;
    if (!attempt.usage) continue;
    for (const [key, value] of Object.entries(attempt.usage)) usage[key] = (usage[key] ?? 0) + value;
  }
  const lastRequest = [...attempts].reverse().find(attempt => attempt.request_id)?.request_id ?? null;
  const lastModel = [...attempts].reverse().find(attempt => attempt.model)?.model ?? fallbackModel;
  return {
    request_id: lastRequest,
    model: lastModel,
    latency_ms: attempts.reduce((total, attempt) => total + attempt.duration_ms, 0),
    usage: Object.keys(usage).length ? usage : null,
    usage_complete: complete,
    attempts: attempts.length,
    prompt_version: PROMPT_VERSION,
    attempts_detail: attempts,
    ...(repairs === undefined ? {} : { repairs }),
  };
}

export function combineModelMetas(metas: ModelCallMeta[]): ModelCallMeta | null {
  if (!metas.length) return null;
  const attempts = metas.flatMap(meta => meta.attempts_detail ?? []);
  if (!attempts.length) {
    const usage: Record<string, number> = {};
    let complete = true;
    for (const meta of metas) {
      if (!meta.usage || !(meta.usage_complete ?? usageComplete(meta.usage))) complete = false;
      if (meta.usage) for (const [key, value] of Object.entries(meta.usage)) usage[key] = (usage[key] ?? 0) + value;
    }
    return {
      request_id: [...metas].reverse().find(meta => meta.request_id)?.request_id ?? null,
      model: metas[metas.length - 1].model,
      latency_ms: metas.reduce((total, meta) => total + meta.latency_ms, 0),
      usage: Object.keys(usage).length ? usage : null,
      usage_complete: complete,
      attempts: metas.reduce((total, meta) => total + meta.attempts, 0),
      prompt_version: metas[metas.length - 1].prompt_version,
    };
  }
  return aggregateMeta(metas[metas.length - 1].model, attempts);
}

class SemanticValidationFailure extends Error {
  constructor(readonly semanticError: z.ZodError | null, readonly completeness: MemoryRecord["completeness"] | null) {
    super("memory_semantic_invalid");
    this.name = "SemanticValidationFailure";
  }
}

function validateMemory(value: MemoryRecord): MemoryRecord {
  const semantic = MemorySchema.safeParse(value);
  if (!semantic.success) throw new SemanticValidationFailure(semantic.error, null);
  if (semantic.data.completeness !== "complete") throw new SemanticValidationFailure(null, semantic.data.completeness);
  return semantic.data;
}

async function call<T>(config: ModelConfig, spec: RequestSpec<T>, options: CallOptions<T> = {}): Promise<ModelResult<T>> {
  validConfig(config);
  const url = endpoint(config);
  const body = requestBody(config, spec as RequestSpec<unknown>);
  const records: ModelAttemptAudit[] = [];
  let localIndex = 0;
  const phase = options.phase ?? "initial";
  const emit = async (record: Omit<ModelAttemptAudit, "index" | "stage">) => {
    const attempt: ModelAttemptAudit = { index: options.audit?.nextIndex() ?? ++localIndex, stage: options.audit?.stage ?? spec.stage, ...record };
    records.push(attempt);
    await options.audit?.onAttempt?.(attempt);
  };
  const fail = (code: string, message: string, detail?: unknown): never => {
    throw new ModelAdapterError(code, message, aggregateMeta(config.model, records), detail);
  };
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const recordBase = { phase, started_at: startedAt, request_id: null, model: null, usage: null, finish_reason: null, http_status: null, outcome: "failure" as const, validation: "not_run" as const, error_code: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: Response;
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
      response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      const timeout = error instanceof Error && error.name === "AbortError";
      const code = timeout ? "timeout" : "network_error";
      await emit({ ...recordBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, error_code: code });
      if (attempts < 3) { await new Promise(resolve => setTimeout(resolve, 150 * 2 ** (attempts - 1))); continue; }
      return fail(code, timeout ? "Model request timed out." : "Model service could not be reached.");
    }
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* Releasing a failed response is best effort. */ }
      clearTimeout(timer);
      const httpStatus = response.status;
      const temporary = [408, 429].includes(httpStatus) || httpStatus >= 500;
      const code = temporary ? "temporary_service_error" : httpStatus === 401 || httpStatus === 403 ? "authentication_error" : "service_error";
      await emit({ ...recordBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, http_status: httpStatus, error_code: code });
      if (temporary && attempts < 3) { await new Promise(resolve => setTimeout(resolve, 150 * 2 ** (attempts - 1))); continue; }
      return fail(code, code === "temporary_service_error" ? "Model service is temporarily unavailable." : code === "authentication_error" ? "Model service rejected authentication." : "Model service rejected the request.");
    }
    let payload: unknown;
    try { payload = await response.json(); }
    catch {
      clearTimeout(timer);
      const code = controller.signal.aborted ? "timeout" : "invalid_response";
      await emit({ ...recordBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, http_status: response.status, error_code: code });
      return fail(code, controller.signal.aborted ? "Model request timed out." : "Model returned invalid JSON.");
    }
    clearTimeout(timer);
    const headerRequestId = response.headers.get("x-request-id");
    const extracted = extract(payload, config.protocol);
    const extractedBase = { ...recordBase, request_id: extracted.requestId ?? headerRequestId, model: extracted.model, usage: extracted.usage, finish_reason: extracted.finishReason, http_status: response.status };
    if (extracted.failure) {
      await emit({ ...extractedBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, error_code: extracted.failure.code });
      return fail(extracted.failure.code, extracted.failure.message);
    }
    let decoded: unknown;
    try { decoded = JSON.parse(extracted.text); }
    catch {
      await emit({ ...extractedBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, error_code: "invalid_json" });
      return fail("invalid_json", "Model output was not valid JSON.");
    }
    const parsed = spec.schema.safeParse(decoded);
    if (!parsed.success) {
      await emit({ ...extractedBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, validation: "schema_failed", error_code: "schema_invalid" });
      return fail("schema_invalid", "Model output did not match the required schema.", parsed.error);
    }
    let value = parsed.data;
    let validation: ModelAttemptAudit["validation"] = "schema_passed";
    if (options.validate) {
      try { value = options.validate(value); validation = "semantic_passed"; }
      catch (error) {
        await emit({ ...extractedBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, validation: "semantic_failed", error_code: "semantic_invalid" });
        return fail("semantic_invalid", "Model memory contains invalid references or semantic structure.", error);
      }
    }
    await emit({ ...extractedBase, ended_at: new Date().toISOString(), duration_ms: Date.now() - started, outcome: "success", validation });
    return { value, meta: aggregateMeta(config.model, records) };
  }
  return fail("temporary_service_error", "Model service is temporarily unavailable.");
}

// One bounded repair attempt for a schema-constrained reply that parsed but broke
// cross-reference or completeness-consistency rules (duplicate IDs, dangling references,
// "unsupported" despite extracted items). The retry receives only validator messages and
// the model's own completeness value, never keypoints or the original figure. A second
// failure is still reported as a failure; nothing is rewritten or dropped by this adapter.
const REPAIR_RULES = "Use globally unique IDs such as node_m1, rel_1, fact_1, plot_1, series_1; prefix every series ID with its plot ID (for example plot_1_series_1) so repeated series labels in different plots stay distinct. Make every group_id, relation endpoint, condition target, fact source_id and evidence item_id reference an existing item. Set completeness=unsupported only when no items were extracted; if any node, relation, fact or plot exists, use complete or capacity_exceeded.";
function repairNote(error: z.ZodError | null, completeness: MemoryRecord["completeness"] | null): string {
  const messages = error ? [...new Set(error.issues.map(issue => issue.message))].slice(0, 6).join(" ") : `The reply set completeness=${completeness} but contains extracted items.`;
  return `VALIDATION REPAIR: ${messages} ${REPAIR_RULES} Return the complete corrected memory JSON only.`;
}
function repairDetail(detail: unknown): string {
  if (detail instanceof SemanticValidationFailure) return repairNote(detail.semanticError, detail.completeness);
  if (detail instanceof z.ZodError) return repairNote(detail, null);
  return repairNote(null, null);
}
async function readWithSemanticCheck(image: ReaderImageInput, config: ModelConfig, text: string, readerPrompt: string, audit?: ModelAuditContext): Promise<ModelResult<MemoryRecord>> {
  let promptText = text;
  let priorMetas: ModelCallMeta[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await call(config, { schema: MemoryOutputSchema, stage: "reader", prompt: readerPrompt, image, text: promptText }, { audit, phase: attempt === 0 ? "initial" : "repair", validate: validateMemory });
      const combined = combineModelMetas([...priorMetas, result.meta]);
      if (!combined) throw new ModelAdapterError("internal_error", "Model call metadata was not recorded.");
      return { value: result.value, meta: { ...combined, repairs: attempt } };
    } catch (error) {
      if (!(error instanceof ModelAdapterError)) throw error;
      const failed = error.audit ? [error.audit] : [];
      const combined = combineModelMetas([...priorMetas, ...failed]);
      if (attempt === 0 && (error.code === "schema_invalid" || error.code === "semantic_invalid")) {
        priorMetas = [...priorMetas, ...failed];
        promptText = `${text}\n\n${repairDetail(error.detail)}`;
        continue;
      }
      if (combined) throw new ModelAdapterError(error.code, error.message, combined, error.detail);
      throw error;
    }
  }
  throw new ModelAdapterError("semantic_invalid", "Model memory contains invalid references or semantic structure.", combineModelMetas(priorMetas) ?? undefined);
}
export function readOriginal(image: ReaderImageInput, config: ModelConfig, audit?: ModelAuditContext): Promise<ModelResult<MemoryRecord>> {
  return readWithSemanticCheck(image, config, "Read this original figure image and return the memory JSON.", READER_A_PROMPT, audit);
}

export function readReconstruction(image: ReaderImageInput, config: ModelConfig, audit?: ModelAuditContext): Promise<ModelResult<MemoryRecord>> {
  return readWithSemanticCheck(image, config, "Read this standalone reconstruction image and return the memory JSON.", READER_B_PROMPT, audit);
}

export function judgeKeypoints(input: JudgeInput, config: ModelConfig, audit?: ModelAuditContext): Promise<ModelResult<JudgeOutput>> {
  return call(config, { schema: JudgeOutputSchema, stage: "judge", prompt: JUDGE_PROMPT, text: JSON.stringify({ keypoints: input.keypoints, memory_a: input.a, memory_b: input.b }) }, { audit });
}

export function directCheck(input: DirectCheckInput, config: ModelConfig, audit?: ModelAuditContext): Promise<ModelResult<DirectOutput>> {
  return call(config, { schema: DirectOutputSchema, stage: "direct", prompt: DIRECT_PROMPT, image: input.image, text: JSON.stringify({ keypoints: input.keypoints }) }, { audit });
}
