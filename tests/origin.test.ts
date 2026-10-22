import { describe, expect, it } from "vitest";
import { sameOrigin } from "../src/lib/pipeline/origin";
describe("request origin validation", () => {
  it("accepts the real loopback host despite Next's internal URL normalization", () => expect(sameOrigin(new Request("http://localhost:3000/api/runs", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).toBe(true));
  it("rejects another origin and malformed origin", () => {
    for (const origin of ["http://other.example", "not-a-url", "null"]) expect(sameOrigin(new Request("http://localhost:3000/api/runs", { headers: { host: "127.0.0.1:3000", origin } }))).toBe(false);
  });
});
