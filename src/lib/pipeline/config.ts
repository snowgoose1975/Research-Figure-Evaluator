import { LIMITS, type ConfigSnapshot, type ModelConfig, type ServiceStatus } from "../schemas";

export function modelConfig(): ModelConfig {
  const baseUrl = process.env.RFE_BASE_URL || process.env.OPENAI_BASE_URL || "http://127.0.0.1:11434/v1";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname);
  const model = process.env.RFE_MODEL || process.env.OPENAI_MODEL || (local ? "qwen3-vl:4b-instruct-16k" : "");
  const positive = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  return { apiKey: process.env.OPENAI_API_KEY || "", baseUrl, model, protocol: process.env.RFE_PROTOCOL === "responses" ? "responses" : "chat", timeoutMs: positive("RFE_TIMEOUT_MS", 300_000), maxOutputTokens: positive("RFE_MAX_OUTPUT_TOKENS", 10_000) };
}
export async function serviceStatus(active: string | null): Promise<ServiceStatus> {
  const c = modelConfig();
  const url = new URL(c.baseUrl);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  let configured = Boolean(c.model && (local || c.apiKey));
  if (local) {
    try {
      const response = await fetch(`${url.origin}/api/tags`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
      if (response.ok) { const p = await response.json() as { models?: { name: string }[] }; configured = !!p.models?.some(m => m.name === c.model); }
      else configured = false;
    } catch { configured = false; }
  }
  return { configured, model: c.model || null, protocol: c.protocol, base_url_host: url.host, active_run_id: active, limits: LIMITS };
}
// Non-sensitive snapshot of the model actually configured for a live run. Ollama
// digest and num_ctx are best-effort: if the service cannot answer, both stay null.
export async function configSnapshot(config: ModelConfig = modelConfig()): Promise<ConfigSnapshot> {
  const snapshot: ConfigSnapshot = { model: config.model, protocol: config.protocol, timeout_ms: config.timeoutMs, max_output_tokens: config.maxOutputTokens, base_url_host: "", model_digest: null, num_ctx: null };
  let root: string | null = null;
  try {
    const url = new URL(config.baseUrl);
    snapshot.base_url_host = url.host;
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) root = url.origin;
  } catch { return snapshot; }
  if (!root) return snapshot;
  const [tags, show] = await Promise.allSettled([
    fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(2000), cache: "no-store" }),
    fetch(`${root}/api/show`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: config.model }), signal: AbortSignal.timeout(2000) }),
  ]);
  if (tags.status === "fulfilled" && tags.value.ok) {
    try {
      const payload = await tags.value.json() as { models?: { name: string; digest?: string }[] };
      snapshot.model_digest = payload.models?.find(model => model.name === config.model)?.digest ?? null;
    } catch { /* Digest is unavailable; leave it null rather than guessing. */ }
  }
  if (show.status === "fulfilled" && show.value.ok) {
    try {
      const payload = await show.value.json() as { parameters?: string };
      const match = payload.parameters?.match(/(?:^|\n)\s*num_ctx\s+(\d+)/);
      snapshot.num_ctx = match ? Number(match[1]) : null;
    } catch { /* Context length is unavailable; leave it null rather than guessing. */ }
  }
  return snapshot;
}
