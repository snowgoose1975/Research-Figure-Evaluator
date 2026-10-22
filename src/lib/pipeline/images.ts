import { LIMITS, type ReaderImageInput } from "../schemas";
import sharp from "sharp";

export async function normalizeImage(bytes: Buffer): Promise<Buffer> {
  inspectImage(bytes);
  try { return await sharp(bytes, { limitInputPixels: LIMITS.imagePixels, failOn: "warning" }).rotate().png().toBuffer(); }
  catch { throw new Error("The image could not be decoded as a complete PNG/JPEG."); }
}

export function inspectImage(bytes: Buffer): { mime: ReaderImageInput["mime"]; width: number; height: number } {
  if (!bytes.length || bytes.length > LIMITS.imageBytes) throw new Error("Image must be non-empty and no larger than 10 MB.");
  let width = 0, height = 0, mime: ReaderImageInput["mime"];
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 33 || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Invalid PNG header.");
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); mime = "image/png";
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = "image/jpeg";
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const size = bytes.readUInt16BE(i + 2);
      if (size < 2 || i + size + 2 > bytes.length) throw new Error("Invalid JPEG segment.");
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) { height = bytes.readUInt16BE(i + 5); width = bytes.readUInt16BE(i + 7); break; }
      i += size + 2;
    }
  } else throw new Error("Only PNG and JPEG images are accepted.");
  if (!width || !height || width * height > LIMITS.imagePixels) throw new Error("Image dimensions are invalid or exceed 25 megapixels.");
  return { mime, width, height };
}
