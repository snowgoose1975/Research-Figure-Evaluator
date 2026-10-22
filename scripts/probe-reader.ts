// Diagnostic only: sends the real READER_PROMPT and memory JSON schema to the local model
// and reports token/format behaviour. Does not write project run data.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { MemoryOutputSchema, MemorySchema } from "../src/lib/schemas/index.js";
import { READER_PROMPT } from "../src/lib/prompts/index.js";

const imagePath = process.argv[2] || "public/published/physics-nonlinear-system.png";
const model = process.env.RFE_MODEL || "qwen3-vl:4b-16k";
const base = process.env.RFE_BASE_URL || "http://127.0.0.1:11434/v1";
const maxTokens = Number(process.env.RFE_MAX_OUTPUT_TOKENS || 12000);
const bytes = await readFile(imagePath);
const format = { name: "reader_output", strict: true, schema: z.toJSONSchema(MemoryOutputSchema, { target: "draft-7" }) };
const extra = process.env.EXTRA_NOTE ? `\n\n${process.env.EXTRA_NOTE}` : "";
const prompt = `${READER_PROMPT}\n\nRequired JSON schema:\n${JSON.stringify(format.schema)}\n\nRead the supplied image and return the memory JSON.${extra}`;
const body = {
  model,
  messages: [{ role: "user", content: [
    { type: "image_url", image_url: { url: `data:image/png;base64,${bytes.toString("base64")}` } },
    { type: "text", text: prompt },
  ] }],
  max_tokens: maxTokens, temperature: 0, response_format: { type: "json_schema", json_schema: format },
};
const started = Date.now();
const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
type ChatPayload = {
  choices?: { finish_reason?: string; message?: { content?: string; reasoning?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
const payload = await response.json() as ChatPayload;
const message = payload.choices?.[0]?.message ?? {};
console.log("HTTP", response.status, "elapsed", ((Date.now() - started) / 1000).toFixed(1) + "s");
console.log("finish_reason:", payload.choices?.[0]?.finish_reason, "prompt_tokens:", payload.usage?.prompt_tokens, "completion_tokens:", payload.usage?.completion_tokens);
console.log("content chars:", (message.content ?? "").length, "reasoning chars:", (message.reasoning ?? "").length);
const structural = MemoryOutputSchema.safeParse(JSON.parse(message.content || "null"));
console.log("output schema:", structural.success ? "VALID" : "INVALID");
if (structural.success) console.log("completeness:", structural.data.completeness, "| items:", structural.data.graph.nodes.length, "nodes,", structural.data.facts.length, "facts,", structural.data.plots.length, "plots | summary:", structural.data.summary.slice(0, 200));
if (!structural.success) console.log(structural.error.issues.slice(0, 8));
const parsed = MemorySchema.safeParse(JSON.parse(message.content || "null"));
console.log("semantic schema:", parsed.success ? "VALID" : "INVALID");
if (!parsed.success) console.log(parsed.error.issues.slice(0, 8));
try {
  const m = JSON.parse(message.content || "null");
  const seen = new Map<string, string[]>();
  const add = (id: string, kind: string) => seen.set(id, [...(seen.get(id) ?? []), kind]);
  for (const n of m.graph?.nodes ?? []) add(n.id, "node");
  for (const r of m.graph?.relations ?? []) add(r.id, "relation");
  for (const g of m.graph?.groups ?? []) add(g.id, "group");
  for (const c of m.graph?.conditions ?? []) add(c.id, "condition");
  for (const f of m.facts ?? []) add(f.id, "fact");
  for (const p of m.plots ?? []) { add(p.id, "plot"); for (const s of p.series ?? []) add(s.id, "series"); }
  for (const u of m.uncertainties ?? []) add(u.id, "uncertainty");
  const dupes = [...seen].filter(([, kinds]) => kinds.length > 1);
  console.log("duplicate IDs:", JSON.stringify(dupes));
} catch { /* content already reported invalid */ }
