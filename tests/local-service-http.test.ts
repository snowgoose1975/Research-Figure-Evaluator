import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startService } from "../adapters/local-service/server";
import type { ServiceInput } from "../adapters/local-service/executor";

const image = readFileSync("public/published/materials-lattice-design.png").toString("base64");
const input = { image_base64: image, keypoints: [1, 2, 3].map(i => ({ id: `k${i}`, text: `Expected message ${i}`, claim: null, author_confirmed: true })), consent: true };
const services: Awaited<ReturnType<typeof startService>>[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.close())); });
async function setup(execute: (input: ServiceInput) => Promise<unknown> = async () => ({ report: { safe: true } }), resourcesOk = () => true) {
  const service = await startService({ publicPort: 0, adminPort: 0, persist: false, execute, release: async () => {}, ready: async () => true, resourcesOk });
  services.push(service);
  const pub = `http://127.0.0.1:${(service.publicServer.address() as AddressInfo).port}`;
  const admin = `http://127.0.0.1:${(service.adminServer.address() as AddressInfo).port}`;
  return { service, pub, admin };
}
const post = (root: string, route: string, payload: unknown, origin = root) => fetch(root + route, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(payload) });

describe("public local worker boundaries", () => {
  it("frames only the public analysis page in the fixed site and keeps admin unframeable", async () => {
    const { pub, admin } = await setup();
    const publicPage = await fetch(pub);
    const publicCsp = publicPage.headers.get("content-security-policy") || "";
    expect(publicCsp).toContain("frame-ancestors 'self' https://figure-relay.chicchair5.chatgpt.site");
    expect(publicPage.headers.get("x-frame-options")).toBeNull();
    const adminPage = await fetch(admin);
    expect(adminPage.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(adminPage.headers.get("x-frame-options")).toBe("DENY");
  });
  it("rejects new work when host memory is low without invoking the model", async () => {
    let calls = 0;
    const { pub } = await setup(async () => { calls++; return { report: { safe: true } }; }, () => false);
    expect((await (await fetch(pub + "/status")).json()).accepting).toBe(false);
    expect((await post(pub, "/jobs", input)).status).toBe(503);
    expect(calls).toBe(0);
  });
  it("publishes no history, private run API, model proxy, admin or cross-origin write", async () => {
    const { pub, admin } = await setup();
    for (const route of ["/api/runs", "/pause", "/resume", "/admin", "/v1/chat/completions", "/jobs", "/../runs"]) expect((await fetch(pub + route)).status).toBe(404);
    expect((await post(pub, "/jobs", input, "https://other.example")).status).toBe(403);
    expect((await post(admin, "/pause", {}, pub)).status).toBe(403);
    expect((await fetch(pub)).headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("returns only a capability-held job, and rejects malformed input and missing consent", async () => {
    const { pub } = await setup();
    expect((await post(pub, "/jobs", { ...input, consent: false })).status).toBe(400);
    expect((await post(pub, "/jobs", { ...input, image_base64: "invalid" })).status).toBe(400);
    expect((await post(pub, "/jobs", { ...input, model: "remote-paid" })).status).toBe(400);
    const response = await post(pub, "/jobs", input);
    expect(response.status).toBe(202);
    const admitted = await response.json();
    expect(admitted.id).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(admitted)).not.toContain("image_base64");
    expect((await fetch(pub + "/jobs/" + "0".repeat(64))).status).toBe(404);
    const job = await (await fetch(pub + "/jobs/" + admitted.id)).json();
    expect(job.status).toBe("completed");
    expect(job.result).toEqual({ report: { safe: true } });
    const status = await (await fetch(pub + "/status")).json();
    expect(JSON.stringify(status)).not.toContain(admitted.id);
    expect(JSON.stringify(job)).not.toContain("image_base64");
  });
  it("accepts bounded explicit record checks and forwards them only with the author keypoints", async () => {
    let received: unknown;
    const { pub } = await setup(async payload => { received = payload; return { report: { safe: true } }; });
    const recordCheck = { subject: "Source label", predicate: "flows_to", object: "Target label", qualifiers: [], certainty: null };
    const payload = { ...input, keypoints: input.keypoints.map((keypoint, index) => index === 0 ? { ...keypoint, record_checks: [recordCheck] } : keypoint) };
    expect((await post(pub, "/jobs", payload)).status).toBe(202);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(received).toEqual(expect.objectContaining({ keypoints: expect.arrayContaining([expect.objectContaining({ claim: null, record_checks: [recordCheck] })]) }));
    const tooMany = { ...input, keypoints: input.keypoints.map((keypoint, index) => index === 0 ? { ...keypoint, record_checks: Array.from({ length: 13 }, (_, i) => ({ ...recordCheck, object: `Target ${i}` })) } : keypoint) };
    expect((await post(pub, "/jobs", tooMany)).status).toBe(400);
  });
  it("local pause rejects admission, resume restores it without restarting the computer", async () => {
    const { pub, admin } = await setup();
    expect((await post(admin, "/pause", {})).status).toBe(200);
    expect((await (await fetch(pub + "/status")).json()).paused).toBe(true);
    expect((await post(pub, "/jobs", input)).status).toBe(503);
    expect((await post(admin, "/resume", {})).status).toBe(200);
    expect((await (await fetch(pub + "/status")).json()).accepting).toBe(true);
    expect((await post(pub, "/jobs", input)).status).toBe(202);
  });
});
