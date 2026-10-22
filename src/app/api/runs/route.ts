import { initialize, listRuns, startRun } from "@/lib/pipeline";
import { ModelAdapterError } from "@/lib/model";
import { LIMITS, RunRequestSchema } from "@/lib/schemas";
import { sameOrigin } from "@/lib/pipeline/origin";
import { searchRunHistory } from "@/lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function integerParam(value: string | null, fallback: number, maximum: number) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}
export async function GET(request: Request) {
  await initialize();
  const url = new URL(request.url);
  if (url.searchParams.get("history") !== "1") return Response.json({ runs: await listRuns() }, { headers: { "cache-control": "no-store" } });
  const query = url.searchParams.get("q") ?? "";
  const offset = integerParam(url.searchParams.get("offset"), 0, 1_000_000);
  const limit = integerParam(url.searchParams.get("limit"), 20, 50);
  if (query.length > 120 || offset === null || limit === null || limit < 1) {
    return Response.json({ error: "History query must be at most 120 characters; offset and limit must be valid integers (limit 1–50)." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  return Response.json(await searchRunHistory(query, offset, limit), { headers: { "cache-control": "no-store" } });
}
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
