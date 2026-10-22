import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { startRun } from "../src/lib/pipeline";
import { getRun } from "../src/lib/storage";
import type { ModelAttemptAudit, RunRequest, RunSnapshot } from "../src/lib/schemas";
import { assertNewEvidence, evidenceFile, evidenceLabel, writeNewEvidence } from "./lib/evidence.mjs";

// The historical T08 files remain immutable. A rerun must choose a new label,
// e.g. `npx tsx scripts/t08-audit-stub.ts --label T10-audit-stub`.
const LABEL = evidenceLabel("T08-audit-stub-v2");
const OUTPUT_JSON = evidenceFile(LABEL, ".json");
const PRIMARY_JSONL = evidenceFile(LABEL, "-primary-model-calls.jsonl");
const LENGTH_JSONL = evidenceFile(LABEL, "-length-model-calls.jsonl");
assertNewEvidence([OUTPUT_JSON, PRIMARY_JSONL, LENGTH_JSONL]);
const MODEL = "stub-model";
const memory = {
  schema_version: "0.2.0",
  title: "Controlled audit stub",
  domain: "physics",
  figure_type: "mechanism",
  summary: "Input promotes Output in a controlled fixture.",
  graph: {
    nodes: [
      { id: "n1", label: "Input", aliases: [], group_id: null, semantic_position: { x: 0.2, y: 0.5 } },
      { id: "n2", label: "Output", aliases: [], group_id: null, semantic_position: { x: 0.8, y: 0.5 } },
    ],
    relations: [{ id: "r1", source_id: "n1", target_id: "n2", kind: "promotes", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "activates" }],
    groups: [],
    conditions: [],
  },
  plots: [],
  facts: [{ id: "f1", subject: "Input", predicate: "promotes", object: "Output", qualifiers: [], certainty: "asserted", source_ids: ["n1", "n2"] }],
  uncertainties: [],
  evidence: [],
  completeness: "complete",
};
const claim = { subject: "Input", predicate: "promotes", object: "Output", qualifiers: [], certainty: "asserted" as const };
const keypoints = [1, 2, 3].map(index => ({ id: `k${index}`, text: `Controlled checkpoint ${index}: Input promotes Output.`, claim, author_confirmed: true }));
const judgment = { status: "retained" as const, issue_types: [] as [], matched_item_ids: ["f1"], rationale: "Controlled stub response.", method: "semantic_assist" as const, review_required: true };
const judge = { results: keypoints.map(keypoint => ({ keypoint_id: keypoint.id, in_a: judgment, in_b: judgment })) };
const request: RunRequest = { mode: "live", intents: { keypoints }, example_id: null, example_version: null, parent_run_id: null, include_baseline: false };
const image = readFileSync(path.join(process.cwd(), "public", "examples", "materials-layered-stack-clear.png"));

type Send = (status: number, body: unknown) => void;
type Schedule = (call: number, send: Send) => void;

function envelope(payload: unknown, finishReason: string, usage: Record<string, number>) {
  return {
    id: `stub-request-${Math.random().toString(36).slice(2, 8)}`,
    model: MODEL,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(payload) }, finish_reason: finishReason }],
    usage,
  };
}

async function runControlled(schedule: Schedule): Promise<{ finished: RunSnapshot; attempts: ModelAttemptAudit[]; calls: number }> {
  let calls = 0;
  const server = createServer((requestMessage, response) => {
    const send: Send = (status, body) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (requestMessage.method === "GET" && requestMessage.url === "/api/tags") return send(200, { models: [{ name: MODEL, digest: "stub-digest-not-a-real-model" }] });
    if (requestMessage.method === "POST" && requestMessage.url === "/api/show") return send(200, { parameters: "num_ctx 16384" });
    if (requestMessage.method === "POST" && requestMessage.url === "/v1/chat/completions") {
      calls++;
      requestMessage.resume();
      return schedule(calls, send);
    }
    return send(404, { error: "not found" });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Stub server did not bind a TCP port.");
  process.env.RFE_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.RFE_MODEL = MODEL;
  process.env.RFE_MAX_OUTPUT_TOKENS = "1000";
  delete process.env.OPENAI_API_KEY;
  try {
    const started = await startRun(request, image);
    let finished: RunSnapshot | null = null;
    for (let attempt = 0; attempt < 160; attempt++) {
      const current = await getRun(started.id);
      if (current && ["completed", "failed", "interrupted"].includes(current.status)) { finished = current; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!finished) throw new Error("Timed-out waiting for the controlled audit run.");
    const jsonlPath = path.join(process.cwd(), "runs", finished.id, "model-calls.jsonl");
    const attempts = readFileSync(jsonlPath, "utf8").trim().split("\n").map(line => JSON.parse(line) as ModelAttemptAudit);
    return { finished, attempts, calls };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

// Primary run: a temporary 500, then a schema-invalid reply, then a valid repair,
// followed by Reader B and the semantic judge.
const primarySchedule: Schedule = (call, send) => {
  if (call === 1) return send(500, { error: "temporary stub outage" });
  if (call === 2) return send(200, envelope({ not: "a memory" }, "stop", { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }));
  if (call === 3 || call === 4) return send(200, envelope(memory, "stop", { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }));
  if (call === 5) return send(200, envelope(judge, "stop", { prompt_tokens: 80, completion_tokens: 30, total_tokens: 110 }));
  return send(500, { error: "unexpected extra model request" });
};

// Length run: Reader A exhausts the output budget and the pipeline stops there.
const lengthSchedule: Schedule = (call, send) => {
  if (call === 1) return send(200, envelope({ partial: true }, "length", { prompt_tokens: 120, completion_tokens: 1000, total_tokens: 1120 }));
  return send(500, { error: "unexpected extra model request" });
};

const primary = await runControlled(primarySchedule);
const length = await runControlled(lengthSchedule);

const requiredKeys = ["duration_ms", "ended_at", "error_code", "finish_reason", "http_status", "index", "model", "outcome", "phase", "request_id", "stage", "started_at", "usage", "validation"];
const stageMeta = (run: RunSnapshot, stage: string) => run.stages.find(item => item.stage === stage)?.meta;
const primaryReadingA = stageMeta(primary.finished, "reading_a");
const primaryReadingB = stageMeta(primary.finished, "reading_b");
const primaryEvaluating = stageMeta(primary.finished, "evaluating");
const lengthReadingA = stageMeta(length.finished, "reading_a");
const primaryJsonl = readFileSync(path.join(process.cwd(), "runs", primary.finished.id, "model-calls.jsonl"), "utf8");
const lengthJsonl = readFileSync(path.join(process.cwd(), "runs", length.finished.id, "model-calls.jsonl"), "utf8");

const checks = [
  { name: "primary run completed after transient and schema failures", pass: primary.finished.status === "completed" },
  { name: "five primary HTTP attempts were audited", pass: primary.attempts.length === 5 && primary.calls === 5 },
  { name: "temporary 500 is recorded before the retry", pass: primary.attempts[0]?.http_status === 500 && primary.attempts[0]?.outcome === "failure" && primary.attempts[0]?.error_code === "temporary_service_error" && primary.attempts[0]?.phase === "initial" },
  { name: "schema-invalid initial call and repair are separate records", pass: primary.attempts[1]?.phase === "initial" && primary.attempts[1]?.validation === "schema_failed" && primary.attempts[2]?.phase === "repair" && primary.attempts[2]?.validation === "semantic_passed" },
  { name: "stage indexes restart per stage and remain traceable", pass: primary.attempts[0]?.index === 1 && primary.attempts[1]?.index === 2 && primary.attempts[2]?.index === 3 && primary.attempts[3]?.stage === "reading_b" && primary.attempts[3]?.index === 1 && primary.attempts[4]?.stage === "evaluating" && primary.attempts[4]?.index === 1 },
  { name: "every primary record has the frozen audit key set", pass: primary.attempts.every(attempt => JSON.stringify(Object.keys(attempt).sort()) === JSON.stringify(requiredKeys)) },
  { name: "successful calls retain request IDs and model; the bare 500 leaves them null", pass: primary.attempts.every(attempt => attempt.http_status === 500 ? attempt.request_id === null && attempt.model === null : /^stub-request-[a-z0-9]{6}$/.test(attempt.request_id ?? "") && attempt.model === MODEL) },
  { name: "usage and finish reason are retained on successful calls", pass: primary.attempts.filter(attempt => attempt.outcome === "success").every(attempt => attempt.finish_reason === "stop" && attempt.usage !== null) },
  { name: "failed retry has no fabricated usage", pass: primary.attempts[0]?.usage === null },
  { name: "stage metadata counts the retry and marks usage incomplete", pass: primaryReadingA?.attempts === 3 && primaryReadingA?.repairs === 1 && primaryReadingA?.attempts_detail?.length === 3 && primaryReadingA?.usage_complete === false && primaryReadingB?.attempts === 1 && primaryEvaluating?.attempts === 1 },
  { name: "config snapshot records model digest and context length", pass: primary.finished.config_snapshot?.model === MODEL && primary.finished.config_snapshot?.model_digest === "stub-digest-not-a-real-model" && primary.finished.config_snapshot?.num_ctx === 16384 },
  { name: "no API key, authorization header or image bytes are persisted", pass: !/authorization|sk-|iVBORw0KGgo/i.test(primaryJsonl) && !primaryJsonl.includes("materials-layered-stack-clear.png") },
  { name: "length-limited run fails at Reader A", pass: length.finished.status === "failed" && length.finished.error?.stage === "reading_a" && length.finished.error?.code === "incomplete" },
  { name: "length failure is persisted as one attempt", pass: length.attempts.length === 1 && length.calls === 1 && length.attempts[0]?.stage === "reading_a" },
  { name: "length attempt keeps finish_reason and complete usage", pass: length.attempts[0]?.finish_reason === "length" && length.attempts[0]?.error_code === "incomplete" && length.attempts[0]?.usage?.total_tokens === 1120 && lengthReadingA?.usage_complete === true },
  { name: "length failure JSONL contains no secret or image bytes", pass: !/authorization|sk-|iVBORw0KGgo/i.test(lengthJsonl) && !lengthJsonl.includes("materials-layered-stack-clear.png") },
];

const result = {
  evidence_id: LABEL,
  generated_at: new Date().toISOString(),
  scope: "Controlled local HTTP stub exercising the real pipeline and audit persistence: transient retry, schema repair, and output-length failure. It is not a real-model accuracy result.",
  primary_run: { run_id: primary.finished.id, status: primary.finished.status, calls: primary.calls, attempts: primary.attempts, stages: { reading_a: primaryReadingA, reading_b: primaryReadingB, evaluating: primaryEvaluating }, config_snapshot: primary.finished.config_snapshot },
  length_run: { run_id: length.finished.id, status: length.finished.status, calls: length.calls, error: length.finished.error, attempts: length.attempts, stages: { reading_a: lengthReadingA } },
  checks,
  pass: checks.every(check => check.pass),
};
writeNewEvidence(OUTPUT_JSON, `${JSON.stringify(result, null, 2)}\n`);
writeNewEvidence(PRIMARY_JSONL, primaryJsonl);
writeNewEvidence(LENGTH_JSONL, lengthJsonl);
console.log(JSON.stringify({ label: LABEL, primary_run: primary.finished.id, length_run: length.finished.id, pass: result.pass, failed: checks.filter(check => !check.pass) }, null, 2));
if (!result.pass) process.exitCode = 1;
