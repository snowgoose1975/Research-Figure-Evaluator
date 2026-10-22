import { getRun } from "@/lib/storage";
import { compareRuns } from "@/lib/evaluation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const p = await request.json() as { left_id: string; right_id: string };
    const [left, right] = await Promise.all([getRun(p.left_id), getRun(p.right_id)]);
    if (!left || !right) return Response.json({ error: "Both run IDs must exist." }, { status: 404 });
    return Response.json(compareRuns(left, right));
  } catch { return Response.json({ error: "Invalid comparison request." }, { status: 400 }); }
}
