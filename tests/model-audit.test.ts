import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelAdapterError, readOriginal, type ModelAuditContext } from "../src/lib/model";
import type { ModelAttemptAudit } from "../src/lib/schemas";

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const config = { apiKey: "", baseUrl: "http://127.0.0.1:8000/v1", model: "local-model", protocol: "chat" as const, timeoutMs: 1000, maxOutputTokens: 1000 };
const image = { base64: "c2FtcGxlLWltYWdl", mime: "image/png" as const };
const memory = {
  schema_version: "0.2.0", title: "x", domain: "physics", figure_type: "mechanism", summary: "x",
  graph: { nodes: [{ id: "n", label: "N", aliases: [], group_id: null, semantic_position: null }], relations: [], groups: [], conditions: [] },
  plots: [], facts: [], uncertainties: [], evidence: [], completeness: "complete",
};
const dangling = { ...memory, graph: { ...memory.graph, relations: [{ id: "r", source_id: "missing", target_id: "n", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "" }] } };

function chatResponse(value: unknown, init: { usage?: Record<string, number>; finish?: string; status?: number; requestId?: string } = {}) {
  const body = value === null ? {} : { choices: [{ message: { content: JSON.stringify(value) }, finish_reason: init.finish ?? "stop" }], usage: init.usage };
  return new Response(JSON.stringify({ id: init.requestId ?? "req-1", model: "local-model", ...body }), { status: init.status ?? 200 });
}
function context(stage = "reading_a"): { audit: ModelAuditContext; seen: ModelAttemptAudit[] } {
  const seen: ModelAttemptAudit[] = [];
  let index = 0;
  return { audit: { stage, nextIndex: () => ++index, onAttempt: attempt => { seen.push(attempt); } }, seen };
}
afterEach(() => vi.unstubAllGlobals());

describe("model request audit", () => {
  it("records the schema-invalid first reply and the semantic repair request separately", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => {
      calls++;
      return calls === 1 ? chatResponse({ not: "memory" }, { usage: { prompt_tokens: 10, completion_tokens: 2 } }) : chatResponse(memory, { usage: { prompt_tokens: 12, completion_tokens: 40 } });
    }));
    const { audit, seen } = context();
    const result = await readOriginal(image, config, audit);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ index: 1, phase: "initial", stage: "reading_a", outcome: "failure", validation: "schema_failed", error_code: "schema_invalid" });
    expect(seen[1]).toMatchObject({ index: 2, phase: "repair", stage: "reading_a", outcome: "success", validation: "semantic_passed", error_code: null });
    expect(result.meta.attempts).toBe(2);
    expect(result.meta.repairs).toBe(1);
    expect(result.meta.usage).toEqual({ prompt_tokens: 22, completion_tokens: 42 });
    expect(result.meta.usage_complete).toBe(true);
    expect(result.meta.latency_ms).toBe(seen.reduce((sum, attempt) => sum + attempt.duration_ms, 0));
  });

  it("marks a semantically invalid reply and records the repair prompt", async () => {
    const requests: string[] = [];
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async (_url, init) => {
      requests.push(String(init?.body));
      calls++;
      return calls === 1 ? chatResponse(dangling, { usage: { prompt_tokens: 9, completion_tokens: 9 } }) : chatResponse(memory, { usage: { prompt_tokens: 9, completion_tokens: 9 } });
    }));
    const { audit, seen } = context();
    const result = await readOriginal(image, config, audit);
    expect(seen.map(attempt => attempt.validation)).toEqual(["semantic_failed", "semantic_passed"]);
    expect(seen[0].error_code).toBe("semantic_invalid");
    expect(requests[1]).toContain("VALIDATION REPAIR");
    expect(requests[1]).toContain("Dangling relation");
    expect(result.meta.repairs).toBe(1);
  });

  it("keeps usage and finish_reason when the output hits the token limit", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => new Response(JSON.stringify({ id: "req-len", model: "local-model", choices: [{ message: { content: "{}" }, finish_reason: "length" }], usage: { prompt_tokens: 7, completion_tokens: 1000 } }), { status: 200 })));
    const { audit, seen } = context();
    const error = (await readOriginal(image, config, audit).catch(caught => caught)) as ModelAdapterError;
    expect(error).toBeInstanceOf(ModelAdapterError);
    expect(error.code).toBe("incomplete");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ finish_reason: "length", usage: { prompt_tokens: 7, completion_tokens: 1000 }, validation: "not_run", error_code: "incomplete" });
    expect(error.audit?.usage_complete).toBe(true);
    expect(error.audit?.usage).toEqual({ prompt_tokens: 7, completion_tokens: 1000 });
  });

  it("records a temporary 500 before retrying and marks usage incomplete when the failed reply has none", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => {
      calls++;
      return calls === 1 ? new Response("busy", { status: 500 }) : chatResponse(memory, { usage: { prompt_tokens: 5, completion_tokens: 6 } });
    }));
    const { audit, seen } = context();
    const result = await readOriginal(image, config, audit);
    expect(calls).toBe(2);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ index: 1, http_status: 500, outcome: "failure", error_code: "temporary_service_error", usage: null });
    expect(seen[1]).toMatchObject({ index: 2, http_status: 200, outcome: "success", validation: "semantic_passed" });
    expect(result.meta.attempts).toBe(2);
    expect(result.meta.usage).toEqual({ prompt_tokens: 5, completion_tokens: 6 });
    expect(result.meta.usage_complete).toBe(false);
  });

  it("persists no authorization header, API key, image bytes or full payload in attempt records", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => chatResponse(memory, { usage: { prompt_tokens: 1 } })));
    const { audit, seen } = context();
    await readOriginal(image, { ...config, apiKey: "sk-test-not-a-real-key" }, audit);
    const auditText = JSON.stringify(seen);
    expect(auditText).not.toContain("sk-test-not-a-real-key");
    expect(auditText).not.toContain("authorization");
    expect(auditText).not.toContain(image.base64);
    expect(Object.keys(seen[0]).sort()).toEqual(["duration_ms", "ended_at", "error_code", "finish_reason", "http_status", "index", "model", "outcome", "phase", "request_id", "stage", "started_at", "usage", "validation"]);
  });

  it("does not mark input-only usage as complete", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => chatResponse(memory, { usage: { prompt_tokens: 7 } })));
    const { audit, seen } = context();
    const result = await readOriginal(image, config, audit);
    expect(seen[0].usage).toEqual({ prompt_tokens: 7 });
    expect(result.meta.usage).toEqual({ prompt_tokens: 7 });
    expect(result.meta.usage_complete).toBe(false);
  });

  it("marks total-only usage as incomplete because the output side is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => chatResponse(memory, { usage: { total_tokens: 12 } })));
    const { audit } = context();
    const result = await readOriginal(image, config, audit);
    expect(result.meta.usage).toEqual({ total_tokens: 12 });
    expect(result.meta.usage_complete).toBe(false);
  });

  it("leaves unknown usage null instead of filling zeros", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchStub>(async () => chatResponse(memory)));
    const { audit, seen } = context();
    const result = await readOriginal(image, config, audit);
    expect(seen[0].usage).toBeNull();
    expect(result.meta.usage).toBeNull();
    expect(result.meta.usage_complete).toBe(false);
  });
});
