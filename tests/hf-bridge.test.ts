import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BridgeError, runBridge, type BridgeRequest } from "../adapters/huggingface/bridge";
import { MemorySchema } from "../src/lib/schemas";

const image = readFileSync("public/published/materials-lattice-design.png").toString("base64");
const keypoints = Array.from({ length: 3 }, (_, i) => ({ id: `k${i}`, text: `SECRET_AUTHOR_EXPECTATION_${i}`, author_confirmed: true, claim: null }));
const memory = MemorySchema.parse({ schema_version: "0.2.0", title: "Visible structure", domain: "materials", figure_type: "structure", summary: "A visible box.", graph: { nodes: [{ id: "n1", label: "Visible box", aliases: [], group_id: null, semantic_position: null }], relations: [], groups: [], conditions: [] }, plots: [], facts: [], uncertainties: [], evidence: [], completeness: "complete" });
const judgment = { status: "uncertain", issue_types: [], matched_item_ids: [], rationale: "No definite alignment.", method: "semantic_assist", review_required: true };
const answer = (request: BridgeRequest) => ({ text: JSON.stringify(request.stage === "judging" ? { results: keypoints.map(point => ({ keypoint_id: point.id, in_a: judgment, in_b: judgment })) } : memory), input_tokens: 12, output_tokens: 34, finish_reason: "stop" });

describe("HF semantic bridge uses the established scientific boundaries", () => {
  it("keeps both readers blind and gives B only the rendered raster", async () => {
    const calls: BridgeRequest[] = [];
    const result = await runBridge({ type: "start", image_base64: image, keypoints }, async request => { calls.push(request); return answer(request); });
    expect(calls.map(call => call.stage)).toEqual(["reading_a", "reading_b", "judging"]);
    expect(JSON.stringify(calls[0])).not.toContain("SECRET_AUTHOR_EXPECTATION");
    expect(JSON.stringify(calls[1])).not.toContain("SECRET_AUTHOR_EXPECTATION");
    expect(calls[1].image_base64).toBe(result.reconstruction_png_base64);
    expect(calls[1].image_base64).not.toBe(calls[0].image_base64);
    expect(calls[2].image_base64).toBeNull();
    expect(calls[2].prompt).toContain("SECRET_AUTHOR_EXPECTATION");
    expect(result.protocol).toBe("hf-zerogpu-0.1");
    expect(result.render_audit.visual_review).toBe("not_reviewed");
  });

  it("stops on output exhaustion, preserves partial usage, and never fabricates omissions", async () => {
    const calls: string[] = [];
    try {
      await runBridge({ type: "start", image_base64: image, keypoints }, async request => { calls.push(request.stage); return { text: "{}", input_tokens: 99, finish_reason: "length" }; });
      throw new Error("Expected an explicit failure");
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeError);
      expect(error).toMatchObject({ stage: "reading_a", code: "incomplete", stages: [{ input_tokens: 99, output_tokens: null, usage_complete: false }] });
    }
    expect(calls).toEqual(["reading_a"]);
  });

  it("stops a schema-valid but incomplete extraction before reconstruction and B", async () => {
    let calls = 0;
    await expect(runBridge({ type: "start", image_base64: image, keypoints }, async () => { calls++; return { text: JSON.stringify({ ...memory, completeness: "capacity_exceeded" }), finish_reason: "stop" }; })).rejects.toMatchObject({ code: "incomplete_memory" });
    expect(calls).toBe(1);
  });

  it("rejects unconfirmed intent before any model request", async () => {
    let calls = 0;
    await expect(runBridge({ type: "start", image_base64: image, keypoints: keypoints.map(point => ({ ...point, author_confirmed: false })) }, async request => { calls++; return answer(request); })).rejects.toMatchObject({ code: "unconfirmed_intent" });
    expect(calls).toBe(0);
  });
});
