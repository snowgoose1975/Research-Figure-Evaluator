import { describe, expect, it } from "vitest";
import { assertEvidenceLabel, assertNewEvidence, evidenceFile, evidenceLabel } from "../scripts/lib/evidence.mjs";

describe("evidence output guard", () => {
  it("refuses an existing evidence file instead of overwriting it", () => {
    expect(() => assertNewEvidence([evidenceFile("T09-boundary-probes", ".json")])).toThrow(/Refusing to overwrite existing evidence/);
  });

  it("accepts a new explicit label and rejects path traversal", () => {
    expect(evidenceLabel("T09-boundary-probes", ["--label", "T10-boundary-probes"])).toBe("T10-boundary-probes");
    expect(() => assertEvidenceLabel("../outside")).toThrow(/Invalid evidence label/);
  });

  it("builds a new path without changing the historical base name", () => {
    expect(evidenceFile("T10-guard-unit-test", "-primary-model-calls.jsonl")).toMatch(/T10-guard-unit-test-primary-model-calls\.jsonl$/);
    expect(() => assertNewEvidence([evidenceFile("T10-guard-unit-test", "-primary-model-calls.jsonl")])).not.toThrow();
  });
});
