import { afterEach, describe, expect, it, vi } from "vitest";
import { directCheck, judgeKeypoints, ModelAdapterError, readOriginal, readReconstruction } from "../src/lib/model";
import { PROMPT_VERSION, type MemoryRecord } from "../src/lib/schemas";

const config = { apiKey: "", baseUrl: "http://127.0.0.1:8000/v1", model: "local-model", protocol: "chat" as const, timeoutMs: 1000, maxOutputTokens: 1000 };
const memory = { schema_version: "0.2.0", title: "x", domain: "physics", figure_type: "mechanism", summary: "x", graph: { nodes: [{ id: "n", label: "N", aliases: [], group_id: null, semantic_position: null }], relations: [], groups: [], conditions: [] }, plots: [], facts: [], uncertainties: [], evidence: [], completeness: "complete" };
type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function response(value: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ id: "req-1", model: "local-model", choices: [{ message: { content: JSON.stringify(value) }, finish_reason: "stop" }], usage: { prompt_tokens: 3 } }), { status: 200, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("model HTTP adapter", () => {
  it("uses distinct image-only role prompts for A and B", async () => {
    const fetchMock = vi.fn<FetchStub>(async () => response(memory));
    vi.stubGlobal("fetch", fetchMock);
    const image = { base64: "aGVsbG8=", mime: "image/png" as const };
    await readOriginal(image, config);
    await readReconstruction(image, config);
    const a = String(fetchMock.mock.calls[0][1]?.body), b = String(fetchMock.mock.calls[1][1]?.body);
    expect(a).toContain("ROLE: READER A");
    expect(b).toContain("ROLE: READER B");
    expect(b).not.toContain("ROLE: READER A");
    expect(a).not.toMatch(/keypoints|filename|original_path/i);
    expect(b).not.toMatch(/keypoints|filename|original_path/i);
    expect(b).toContain("data:image/png;base64,aGVsbG8=");
  });
  it("retains reader B's role during its bounded schema repair", async () => {
    const fetchMock = vi.fn<FetchStub>().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(memory));
    vi.stubGlobal("fetch", fetchMock);
    await readReconstruction({ base64: "aGVsbG8=", mime: "image/png" }, config);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const request of fetchMock.mock.calls) {
      expect(String(request[1]?.body)).toContain("ROLE: READER B");
      expect(String(request[1]?.body)).not.toContain("ROLE: READER A");
    }
  });
  it("sends an isolated reader image with no filename or author keypoints", async () => {
    const fetchMock = vi.fn<FetchStub>(async () => response(memory));
    vi.stubGlobal("fetch", fetchMock);
    const image = { base64: "aGVsbG8=", mime: "image/png" as const };
    const result = await readOriginal(image, config);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8000/v1/chat/completions");
    expect(JSON.stringify(request)).toContain("data:image/png;base64,aGVsbG8=");
    expect(JSON.stringify(request)).not.toMatch(/keypoints|filename|original_path|\/tmp\//i);
    expect(result.meta.prompt_version).toBe(PROMPT_VERSION);
  });

  it("uses Responses endpoint and JSON schema format without chat fallback", async () => {
    const fetchMock = vi.fn<FetchStub>(async () => new Response(JSON.stringify({ id: "r", model: "m", status: "completed", output_text: JSON.stringify(memory) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await readReconstruction({ base64: "aGVsbG8=", mime: "image/jpeg" }, { ...config, protocol: "responses" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/v1/responses");
    expect(JSON.parse(String(init?.body)).text.format.type).toBe("json_schema");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("puts author keypoints only in judge/direct calls", async () => {
    const fetchMock = vi.fn<FetchStub>(async () => response({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const keypoints = [{ id: "k", text: "Expected claim", claim: null, author_confirmed: true }];
    await judgeKeypoints({ keypoints, a: memory as unknown as MemoryRecord, b: memory as unknown as MemoryRecord }, config);
    await directCheck({ image: { base64: "aGVsbG8=", mime: "image/png" }, keypoints }, config);
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("Expected claim");
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain("Expected claim");
  });

  it("retries temporary failures at most twice and never exposes server body", async () => {
    const fetchMock = vi.fn<FetchStub>().mockResolvedValueOnce(new Response("secret token leaked", { status: 503 })).mockResolvedValueOnce(response(memory));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readOriginal({ base64: "aGVsbG8=", mime: "image/png" }, config);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.meta.attempts).toBe(2);
    const bad = vi.fn<FetchStub>(async () => new Response("sensitive body", { status: 401 }));
    vi.stubGlobal("fetch", bad);
    await expect(readOriginal({ base64: "aGVsbG8=", mime: "image/png" }, config)).rejects.toMatchObject({ code: "authentication_error" });
    try { await readOriginal({ base64: "aGVsbG8=", mime: "image/png" }, config); } catch (error) { expect((error as Error).message).not.toContain("sensitive"); }
  });

  it("rejects malformed output after one bounded repair and does not silently mock", async () => {
    const fetchMock = vi.fn<FetchStub>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(readOriginal({ base64: "aGVsbG8=", mime: "image/png" }, config)).rejects.toBeInstanceOf(ModelAdapterError);
    // Two requests maximum: original reply plus one validator-informed repair attempt.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain("VALIDATION REPAIR");
  });
});
