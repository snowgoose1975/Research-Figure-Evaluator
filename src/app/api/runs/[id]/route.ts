import { initialize, getRun } from "@/lib/pipeline";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await initialize();
  try { const run = await getRun((await context.params).id); return run ? Response.json(run) : Response.json({ error: "Run not found." }, { status: 404 }); }
  catch { return Response.json({ error: "Run not found." }, { status: 404 }); }
}
