import { getRun } from "@/lib/storage";
import { markdownReport } from "@/lib/pipeline/report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const run = await getRun((await context.params).id);
    if (!run) return new Response("Not found", { status: 404 });
    const markdown = new URL(request.url).searchParams.get("format") === "markdown";
    return new Response(markdown ? markdownReport(run) : JSON.stringify(run, null, 2), { headers: { "Content-Type": markdown ? "text/markdown; charset=utf-8" : "application/json", "Content-Disposition": `attachment; filename="figure-relay-${run.id}.${markdown ? "md" : "json"}"`, "Cache-Control": "no-store" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
