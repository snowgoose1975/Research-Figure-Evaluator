// Diagnostic only: calls the same reader adapter (including its bounded repair) that the
// pipeline uses, so a failed run can be explained without writing a new run record.
import { readFile } from "node:fs/promises";
import { ModelAdapterError, readOriginal } from "../src/lib/model/index.js";
import { modelConfig } from "../src/lib/pipeline/config.js";

const imagePath = process.argv[2];
if (!imagePath) { console.error("Usage: npx tsx scripts/probe-pipeline.ts <png>"); process.exit(2); }
const bytes = await readFile(imagePath);
const config = modelConfig();
console.log("model:", config.model, "max_output_tokens:", config.maxOutputTokens);
try {
  const result = await readOriginal({ base64: bytes.toString("base64"), mime: "image/png" }, config);
  console.log(JSON.stringify({
    completeness: result.value.completeness, repairs: result.meta.repairs, latency_ms: result.meta.latency_ms,
    nodes: result.value.graph.nodes.length, relations: result.value.graph.relations.length,
    facts: result.value.facts.length, plots: result.value.plots.length,
    series: result.value.plots.reduce((total, plot) => total + plot.series.length, 0),
    title: result.value.title,
  }, null, 2));
} catch (error) {
  if (error instanceof ModelAdapterError) console.log("ERROR", error.code, "-", error.message);
  else console.log("ERROR", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
}
