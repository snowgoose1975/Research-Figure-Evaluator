// Diagnostic: does the local vision model return schema-constrained JSON through the
// OpenAI-compatible endpoint used by the app? Reads a public example image, no private data.
import { readFile } from "node:fs/promises";
const imagePath = process.argv[2] || "public/published/physics-nonlinear-system.png";
const model = process.env.RFE_MODEL || "qwen3-vl:4b";
const base = process.env.RFE_BASE_URL || "http://127.0.0.1:11434/v1";
const bytes = await readFile(imagePath);
const b64 = bytes.toString("base64");
const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    visible_text: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["title", "visible_text", "summary"],
  additionalProperties: false,
};
const body = {
  model,
  messages: [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      { type: "text", text: "Describe the scientific figure. Return the required JSON only." },
    ],
  }],
  max_tokens: 6000,
  temperature: 0,
  response_format: { type: "json_schema", json_schema: { name: "probe", strict: true, schema } },
};
const started = Date.now();
const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const raw = await response.text();
console.log("HTTP", response.status, "elapsed", ((Date.now() - started) / 1000).toFixed(1) + "s");
if (!response.ok) { console.log(raw.slice(0, 1000)); process.exit(1); }
const payload = JSON.parse(raw);
const choice = payload.choices?.[0];
const message = choice?.message ?? {};
console.log("finish_reason:", choice?.finish_reason);
console.log("content length:", (message.content ?? "").length);
console.log("reasoning length:", (message.reasoning ?? "").length);
console.log("content head:", JSON.stringify((message.content ?? "").slice(0, 400)));
console.log("reasoning head:", JSON.stringify((message.reasoning ?? "").slice(0, 300)));
try { const parsed = JSON.parse(message.content); console.log("JSON parse: OK; keys:", Object.keys(parsed).join(",")); }
catch { console.log("JSON parse: FAILED"); }
