import { activeRunId, initialize } from "@/lib/pipeline";
import { serviceStatus } from "@/lib/pipeline/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { await initialize(); return Response.json(await serviceStatus(activeRunId())); }
