import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { IntentSetSchema, JudgeOutputSchema, MemoryOutputSchema, MemorySchema } from "../../src/lib/schemas";
import { READER_PROMPT, JUDGE_PROMPT } from "../../src/lib/prompts";
import { normalizeImage } from "../../src/lib/pipeline/images";
import { projectForRender, renderMemory } from "../../src/lib/reconstruction";
import { evaluate } from "../../src/lib/evaluation";

export const HF_PROTOCOL = "hf-zerogpu-0.1";
type Stage = "reading_a" | "reading_b" | "judging";
export interface BridgeRequest { type: "request"; id: Stage; stage: Stage; prompt: string; schema: Record<string, unknown>; image_base64: string | null; max_output_tokens: number }
export interface BridgeResponse { text: string; input_tokens?: number | null; output_tokens?: number | null; finish_reason: string }
const StartSchema = z.object({ type: z.literal("start"), image_base64: z.string().min(1).max(14_000_000), keypoints: IntentSetSchema.shape.keypoints }).strict();
export class BridgeError extends Error {
  constructor(readonly stage: string, readonly code: string, message: string, readonly stages?: unknown[]) { super(message); }
}
function json(text: string, stage: Stage) {
  try { return JSON.parse(text); } catch { throw new BridgeError(stage, "invalid_json", "The model did not return a complete JSON object. No later stage was run."); }
}

/** Per-session pure orchestration. No disk writes, HTTP server or global history. */
export async function runBridge(raw: unknown, infer: (request: BridgeRequest) => Promise<BridgeResponse>) {
  const input = StartSchema.parse(raw);
  const intents = IntentSetSchema.parse({ keypoints: input.keypoints });
  if (intents.keypoints.some(point => !point.author_confirmed)) throw new BridgeError("input", "unconfirmed_intent", "Confirm the expected messages before running.");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.image_base64)) throw new BridgeError("input", "invalid_image", "Only a PNG/JPEG image is accepted.");
  const original = await normalizeImage(Buffer.from(input.image_base64, "base64"));
  const stages: { stage: Stage; input_tokens: number | null; output_tokens: number | null; usage_complete: boolean; finish_reason: string }[] = [];
  const request = async (stage: Stage, prompt: string, schema: z.ZodType, image: Buffer | null) => {
    const response = await infer({ type: "request", id: stage, stage, prompt, schema: z.toJSONSchema(schema, { target: "draft-7" }), image_base64: image?.toString("base64") ?? null, max_output_tokens: 10000 });
    const known = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
    const inputTokens = known(response.input_tokens), outputTokens = known(response.output_tokens);
    stages.push({ stage, input_tokens: inputTokens, output_tokens: outputTokens, usage_complete: inputTokens !== null && outputTokens !== null, finish_reason: response.finish_reason });
    if (response.finish_reason === "length") throw new BridgeError(stage, "incomplete", "The output limit was reached. This attempt stopped; no replacement run or inferred omissions were produced.", [...stages]);
    return json(response.text, stage);
  };
  const read = async (stage: "reading_a" | "reading_b", image: Buffer) => {
    const value = await request(stage, READER_PROMPT, MemoryOutputSchema, image);
    const parsed = MemorySchema.safeParse(value);
    if (!parsed.success) throw new BridgeError(stage, "invalid_memory", "The extracted memory failed the shared scientific schema. No later stage was run.", [...stages]);
    if (parsed.data.completeness !== "complete") throw new BridgeError(stage, "incomplete_memory", "The reader did not produce a complete extraction. Omissions were not scored.", [...stages]);
    return parsed.data;
  };
  // Neither reader request receives author intent, the other memory or a caption.
  const a = await read("reading_a", original);
  const render = await renderMemory(projectForRender(a));
  const b = await read("reading_b", render.png);
  const semantic = JudgeOutputSchema.safeParse(await request("judging", `${JUDGE_PROMPT}\n\nData to compare:\n${JSON.stringify({ keypoints: intents.keypoints, a, b })}`, JudgeOutputSchema, null));
  if (!semantic.success) throw new BridgeError("judging", "invalid_judgment", "The semantic judgment failed the shared schema.");
  const renderAudit = { width: render.width, height: render.height, rendered_item_ids: render.rendered_item_ids, unsupported_item_ids: render.unsupported_item_ids, warnings: render.warnings, structural_audit: render.structural_audit, visual_review: render.visual_review, renderer_version: render.renderer_version };
  let report;
  try { report = evaluate({ intents, a, b, render: renderAudit, semantic: semantic.data }); }
  catch { throw new BridgeError("judging", "invalid_evidence", "The judgment did not cover each expected message with valid evidence."); }
  return { type: "result" as const, protocol: HF_PROTOCOL, a, b, report, render_audit: renderAudit, reconstruction_png_base64: render.png.toString("base64"), stages, limitations: ["New HF adaptation protocol; not part of the original 8/12 Ollama results.", "Independent calls to the same model do not imply independent errors.", "AI simulated-reader feedback is not a measurement of human understanding.", "A reconstruction gap does not establish a defect in the original figure."] };
}

async function main() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  let stage = "input";
  const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
  try {
    const first = await iterator.next();
    if (first.done) throw new Error("Missing request");
    const result = await runBridge(JSON.parse(first.value), async request => {
      stage = request.stage; send(request);
      const line = await iterator.next();
      if (line.done) throw new BridgeError(stage, "transport_closed", "The model transport closed before the stage completed.");
      const reply = JSON.parse(line.value);
      if (reply.id !== request.id || typeof reply.response?.text !== "string" || typeof reply.response?.finish_reason !== "string") throw new BridgeError(stage, "invalid_transport", "The model transport returned an invalid or mismatched response.");
      return reply.response;
    });
    send(result);
  } catch (error) {
    send({ type: "error", stage: error instanceof BridgeError ? error.stage : stage, code: error instanceof BridgeError ? error.code : "validation_failed", message: error instanceof BridgeError ? error.message : "The request could not be validated or processed. No later stage was run.", stages: error instanceof BridgeError ? error.stages ?? [] : [] });
    process.exitCode = 1;
  } finally { lines.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
