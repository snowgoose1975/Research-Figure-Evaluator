import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemorySchema } from "../src/lib/schemas";
import type { CaseIndex, PublicCase } from "../src/lib/examples/case-studies";

const index = JSON.parse(readFileSync("public/case-studies/index-v2.json", "utf8")) as CaseIndex;
const frozen = JSON.parse(readFileSync("artifacts/validation/protocol-p022-4b16k10.json", "utf8"));
const records = index.cases.map(item => JSON.parse(readFileSync(path.join("public", item.record), "utf8")) as PublicCase);
const forbidden = new Set(["config_snapshot", "attempts_detail", "apiKey", "api_key", "authorization", "headers", "author_confirmed", "stages", "request", "raw_response"]);
function checkKeys(value: unknown) {
  if (Array.isArray(value)) value.forEach(checkKeys);
  else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) { expect(forbidden.has(key), `Forbidden public field: ${key}`).toBe(false); checkKeys(entry); }
}

describe("reviewed public-case boundary", () => {
  it("preserves every fixed-protocol outcome instead of presenting curated replays as a success rate", () => {
    expect(index.protocol.total).toBe(12);
    expect(index.protocol.rows).toEqual(frozen.rows.map(({ example_id, attempt, run_id, status }: CaseIndex["protocol"]["rows"][number]) => ({ example_id, attempt, run_id, status })));
    expect(index.protocol.rows.filter(row => row.status === "completed")).toHaveLength(8);
    expect(index.protocol.rows.filter(row => row.status === "failed")).toHaveLength(4);
  });

  it("selects the first completed attempt or first failure for each reviewed source", () => {
    expect(records).toHaveLength(4);
    for (const record of records) {
      const rows = frozen.rows.filter((row: { example_id: string }) => row.example_id === `published-${record.id}`);
      expect(record.source_run_id).toBe((rows.find((row: { status: string }) => row.status === "completed") ?? rows[0]).run_id);
      expect(record.provenance.kind).toBe("recorded_local_model_run");
      expect(record.provenance.source_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("publishes only the explicit case fields, without private run configuration or ambiguous confirmation flags", () => {
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["a", "attribution", "b", "domain", "error", "id", "keypoints", "license", "offline_audit", "original", "paper_url", "provenance", "reconstruction", "record", "render_audit", "report", "source_run_id", "status", "takeaway", "title"].sort());
      checkKeys(record);
      expect(JSON.stringify(record)).not.toMatch(/data:image|localhost|127\.0\.0\.1|\/api\/runs\//);
      expect(record.keypoints.every(point => point.confirmation_provenance === "protocol_marked_not_independently_confirmed")).toBe(true);
    }
  });

  it("keeps source attribution and public assets accessible without a private run directory", () => {
    for (const record of records) {
      expect(record.paper_url).toMatch(/^https:\/\/journals\.plos\.org\//);
      expect(record.attribution).toContain("CC BY");
      expect(record.license).toBe("CC BY 4.0");
      expect(record.original).toMatch(/^\/published\/[a-z-]+\.png$/);
      expect(existsSync(path.join("public", record.original))).toBe(true);
      if (record.reconstruction) expect(existsSync(path.join("public", record.reconstruction))).toBe(true);
    }
  });

  it("does not manufacture a reconstruction or evaluation for the failed case", () => {
    const failure = records.find(record => record.status === "failed")!;
    expect(failure.reconstruction).toBeNull();
    expect(failure.report).toBeNull();
    expect(failure.b).toBeNull();
    expect(failure.offline_audit).toBeNull();
    expect(failure.error).not.toBeNull();
  });

  it("separates the saved report from current offline rules and validates the published memories", () => {
    for (const record of records.filter(record => record.status === "completed")) {
      expect(MemorySchema.safeParse(record.a).success).toBe(true);
      expect(MemorySchema.safeParse(record.b).success).toBe(true);
      expect(record.report?.summary.total).toBe(4);
      expect(record.offline_audit?.note).toContain("does not replace the original report");
      expect(record.provenance.note).toContain("no independent item-by-item human confirmation");
    }
  });
});
