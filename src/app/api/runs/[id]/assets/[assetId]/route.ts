import { getRun, readAsset } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const { id, assetId } = await context.params;
    const run = await getRun(id);
    if (!run) return new Response("Not found", { status: 404 });
    const data = await readAsset(run, assetId);
    if (!data) return new Response("Not found", { status: 404 });
    const mime = assetId.endsWith(".svg") ? "image/svg+xml" : assetId.endsWith(".jpg") ? "image/jpeg" : "image/png";
    return new Response(new Uint8Array(data), { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
