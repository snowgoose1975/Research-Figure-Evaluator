import { describe, it, expect } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { inspectImage, normalizeImage } from "../src/lib/pipeline/images";
describe("uploaded image decoding", () => {
  it("decodes an actual PNG and strips it to pixels", async () => {
    const png = Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="12"><rect width="20" height="12" fill="red"/></svg>').render().asPng());
    expect(inspectImage(await normalizeImage(png))).toMatchObject({ width: 20, height: 12, mime: "image/png" });
  });
  it("rejects disguised SVG and truncated image payloads", async () => {
    expect(() => inspectImage(Buffer.from("<svg/>"))).toThrow();
    const fake = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(fake); fake.write("IHDR",12); fake.writeUInt32BE(10,16); fake.writeUInt32BE(10,20);
    await expect(normalizeImage(fake)).rejects.toThrow();
  });
});
