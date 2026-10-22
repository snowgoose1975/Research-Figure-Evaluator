import { listExamples } from "@/lib/examples";
import { listPublishedExamples } from "@/lib/examples/published";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ examples: [...listPublishedExamples(), ...listExamples().map(e => ({ ...e, origin: "teaching", supports_demo: true }))] }); }
