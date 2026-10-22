import { initialize, listRuns, startRun } from "@/lib/pipeline";
import { ModelAdapterError } from "@/lib/model";
import { LIMITS, RunRequestSchema } from "@/lib/schemas";
import { sameOrigin } from "@/lib/pipeline/origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { await initialize(); return Response.json({ runs: await listRuns() }); }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > LIMITS.imageBytes + 65536) return Response.json({ error: "Upload exceeds the 10 MB image limit." }, { status: 413 });
  try {
    const form = await request.formData();
    const raw = form.get("request");
    if (typeof raw !== "string") return Response.json({ error: "Missing run request." }, { status: 400 });
    const parsed = RunRequestSchema.parse(JSON.parse(raw));
    const file = form.get("image");
    const uploaded = file instanceof File ? Buffer.from(await file.arrayBuffer()) : undefined;
    const run = await startRun(parsed, uploaded);
    return Response.json(run, { status: 202 });
  } catch (error) {
    if (error instanceof ModelAdapterError) return Response.json({ error: error.message, code: error.code }, { status: error.code === "busy" ? 409 : 503 });
    return Response.json({ error: error instanceof Error && !("issues" in error) ? error.message : "Run request did not match the required input format." }, { status: 400 });
  }
}
