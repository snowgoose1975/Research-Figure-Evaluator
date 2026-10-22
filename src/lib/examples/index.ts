import { MemorySchema, type ExampleDefinition, type ExampleSummary, type Fact, type Keypoint, type MemoryRecord, type Plot } from "@/lib/schemas";

const source = "Original educational illustration; self-drawn.";
const license = "CC0-1.0";
type Domain = ExampleDefinition["domain"];
type FigureType = ExampleDefinition["figure_type"];

function keypoint(id: string, text: string, subject: string, predicate: string, object: string, qualifiers: string[] = []): Keypoint {
  return { id, text, author_confirmed: true, claim: { subject, predicate, object, qualifiers, certainty: "asserted" } };
}
function makeMemory(input: {
  title: string; domain: Domain; figure_type: FigureType; summary: string;
  nodes?: MemoryRecord["graph"]["nodes"]; relations?: MemoryRecord["graph"]["relations"];
  conditions?: MemoryRecord["graph"]["conditions"]; plots?: Plot[]; facts?: Fact[];
}): MemoryRecord {
  return MemorySchema.parse({ schema_version: "0.2.0", title: input.title, domain: input.domain, figure_type: input.figure_type, summary: input.summary,
    graph: { nodes: input.nodes || [], relations: input.relations || [], groups: [], conditions: input.conditions || [] }, plots: input.plots || [], facts: input.facts || [], uncertainties: [], evidence: [], completeness: "complete" });
}
function fact(id: string, subject: string, predicate: string, object: string, sourceIds: string[], qualifiers: string[] = []): Fact {
  return { id, subject, predicate, object, qualifiers, certainty: "asserted", source_ids: sourceIds };
}
function node(id: string, label: string, x: number | null = null, y: number | null = null): MemoryRecord["graph"]["nodes"][number] {
  return { id, label, aliases: [], group_id: null, semantic_position: x === null || y === null ? null : { x, y } };
}
function relation(id: string, sourceId: string, targetId: string, kind: MemoryRecord["graph"]["relations"][number]["kind"], label: string, direction: "directed" | "undirected" = "directed"): MemoryRecord["graph"]["relations"][number] {
  return { id, source_id: sourceId, target_id: targetId, kind, direction, line_style: "solid", evidence_status: "asserted", label };
}
function condition(id: string, text: string, target: string): MemoryRecord["graph"]["conditions"][number] {
  return { id, text, scope: "fact", target_ids: [target] };
}

const resonancePoints = (zeta: number) => Array.from({ length: 81 }, (_, i) => {
  const r = i / 40;
  return { x: r, y: 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2) };
});
const thermalPlot: Plot = { id: "thermal-plot", title: "Linear thermal expansion · ΔL/L₀ = αΔT", x_axis: { label: "Temperature change ΔT", unit: "K", scale: "linear", min: 0, max: 100 }, y_axis: { label: "Relative length change ΔL/L₀", unit: "×10⁻³", scale: "linear", min: 0, max: 2 }, series: [
  { id: "thermal-series-a", label: "Material A · α = 10 × 10⁻⁶ K⁻¹", points: [{ x: 0, y: 0 }, { x: 100, y: 1 }], style: "line", approximate: false },
  { id: "thermal-series-b", label: "Material B · α = 20 × 10⁻⁶ K⁻¹", points: [{ x: 0, y: 0 }, { x: 100, y: 2 }], style: "line", approximate: false },
], notes: ["Linear approximation over the illustrated interval; values are instructional, not experimental measurements."] };
const resonancePlot: Plot = { id: "resonance-plot", title: "Damped oscillator response · A(r, ζ) = 1 / √[(1−r²)² + (2ζr)²]", x_axis: { label: "Normalized frequency r = ω/ω₀", unit: "dimensionless", scale: "linear", min: 0, max: 2 }, y_axis: { label: "Normalized amplitude A", unit: "dimensionless", scale: "linear", min: 0, max: 3.6 }, series: [
  { id: "resonance-series-low", label: "ζ = 0.15", points: resonancePoints(0.15), style: "line", approximate: true },
  { id: "resonance-series-high", label: "ζ = 0.35", points: resonancePoints(0.35), style: "line", approximate: true },
], notes: ["Illustrative response curve sampled from the displayed equation.", "The ζ = 0.15 maximum lies slightly below r = 1; it is not exactly at r = 1."] };
const parabolaPlot: Plot = { id: "parabola-plot", title: "Function and derivative · f(x) = x², f′(x) = 2x", x_axis: { label: "x", unit: "dimensionless", scale: "linear", min: -2, max: 2 }, y_axis: { label: "Function value / derivative", unit: "dimensionless", scale: "linear", min: -4, max: 4 }, series: [
  { id: "parabola-series-f", label: "f(x) = x²", points: Array.from({ length: 65 }, (_, i) => { const x = -2 + i / 16; return { x, y: x * x }; }), style: "line", approximate: false },
  { id: "parabola-series-d", label: "f′(x) = 2x", points: Array.from({ length: 65 }, (_, i) => { const x = -2 + i / 16; return { x, y: 2 * x }; }), style: "line", approximate: false },
], notes: ["Both curves share the displayed dimensionless coordinate axes."] };

function oscillatorMemory(issue: "damping" | "unforced" | null = null): MemoryRecord {
  const nodes = [node("osc-wall", "Fixed support", .13, .5), node("osc-spring", "Linear spring k", .4, .35), node("osc-damper", "Viscous damper c", .4, .68), node("osc-mass", "Mass m", .76, .5)];
  const relations = [relation("osc-attach-spring", "osc-wall", "osc-mass", "associated_with", "spring force Fs = −kx"), ...(issue === "damping" ? [] : [relation("osc-attach-damper", "osc-wall", "osc-mass", "associated_with", "damping force Fd = −cv")])];
  const facts = [fact("osc-f-spring", "Spring force Fs", "equals", "−kx", ["osc-spring", "osc-attach-spring"], ["linear spring"]), ...(issue === "damping" ? [] : [fact("osc-f-damper", "Damping force Fd", "equals", "−cv", ["osc-damper", "osc-attach-damper"], ["viscous damping"])]), fact("osc-equation", "Mass acceleration m x′′", "equals", "Fs + Fd", ["osc-f-spring", ...(issue === "damping" ? [] : ["osc-f-damper"])]), ...(issue === "unforced" ? [] : [fact("osc-drive", "External driving force", "is", "absent", ["osc-equation"])])];
  const conditions = [condition("osc-cond-linear", "Spring response assumes a linear spring: Fs = −kx.", "osc-f-spring"), ...(issue === "damping" ? [] : [condition("osc-cond-viscous", "Damping force assumes viscous damping: Fd = −cv.", "osc-f-damper")])];
  return makeMemory({ title: "Mass–spring–damper oscillator", domain: "physics", figure_type: "mechanism", summary: "An unforced mass is connected to a fixed support by a linear spring and a viscous damper. The restoring and damping forces sum to m x′′; no driving force is shown.", nodes, relations, conditions, facts });
}
function resonanceMemory(issue: "peak-location" | "damping-contrast" | null = null): MemoryRecord {
  const facts = [fact("res-eq", "Normalized amplitude A(r, ζ)", "equals", "1 / √[(1−r²)² + (2ζr)²]", ["resonance-plot"]), fact("res-vars", "Frequency ratio r", "equals", "ω/ω₀", ["resonance-plot"], ["dimensionless", "range 0–2"]), ...(issue === "peak-location" ? [] : [fact("res-low-peak", "Peak for ζ = 0.15", "occurs", "slightly below r = 1", ["resonance-series-low"], ["not exactly at r = 1"])]), ...(issue === "damping-contrast" ? [] : [fact("res-damping-peak", "Peak amplitude", "is higher for", "ζ = 0.15 than for ζ = 0.35", ["resonance-series-low", "resonance-series-high"])])];
  return makeMemory({ title: "Damped oscillator frequency response", domain: "physics", figure_type: "plot", summary: "A normalized response curve compares two damping ratios. The lower damping curve has a taller peak, located slightly below the normalized frequency r = 1.", plots: [resonancePlot], facts });
}
function layeredMemory(issue: "top-contact" | "bottom-contact" | null = null): MemoryRecord {
  const nodes = [node("layer-a-top", "A · top", .5, .23), node("layer-b", "B · middle", .5, .5), node("layer-a-bottom", "A · bottom", .5, .77)];
  const relations = [...(issue === "top-contact" ? [] : [relation("layer-top-contact", "layer-a-top", "layer-b", "adjacent_to", "shared interface", "undirected")]), ...(issue === "bottom-contact" ? [] : [relation("layer-bottom-contact", "layer-b", "layer-a-bottom", "adjacent_to", "shared interface", "undirected")])];
  const facts = [fact("layer-order", "Layer sequence", "is", "A (top) / B (middle) / A (bottom)", nodes.map(n => n.id)), ...(issue === "top-contact" ? [] : [fact("layer-above", "Layer B", "is adjacent to", "top layer A", ["layer-top-contact", "layer-b", "layer-a-top"])]), ...(issue === "bottom-contact" ? [] : [fact("layer-below", "Layer B", "is adjacent to", "bottom layer A", ["layer-bottom-contact", "layer-b", "layer-a-bottom"])]), fact("layer-no-aa", "Top and bottom A layers", "are separated by", "middle layer B", ["layer-a-top", "layer-b", "layer-a-bottom"])];
  return makeMemory({ title: "Idealized A / B / A layered stack", domain: "materials", figure_type: "structure", summary: "An idealized three-layer cross-section places B between a top A layer and a bottom A layer. The two A layers do not directly contact one another. No real material properties are implied.", nodes, relations, facts });
}
function thermalMemory(issue: "linear-note" | "material-b" | null = null): MemoryRecord {
  const facts = [fact("thermal-eq", "Relative length change ΔL/L₀", "equals", "αΔT", ["thermal-plot"], issue === "linear-note" ? [] : ["linear approximation"]), fact("thermal-range", "Temperature change ΔT", "ranges", "0–100 K", ["thermal-plot"]), fact("thermal-a", "Material A expansion coefficient α", "equals", "10 × 10⁻⁶ K⁻¹", ["thermal-series-a"]), ...(issue === "material-b" ? [] : [fact("thermal-b", "Material B expansion coefficient α", "equals", "20 × 10⁻⁶ K⁻¹", ["thermal-series-b"])]), fact("thermal-ratio", "Material B slope", "is", "2× material A slope", ["thermal-series-a", "thermal-series-b"])];
  const conditions = issue === "linear-note" ? [] : [condition("thermal-condition", "Relationship shown as a linear approximation; not experimental data.", "thermal-eq")];
  return makeMemory({ title: "Linear thermal expansion", domain: "materials", figure_type: "plot", summary: "Relative length change increases linearly with temperature change in the illustrated approximation. Material B has twice material A’s slope; the lines are instructional, not measured data.", plots: [thermalPlot], facts, conditions });
}
function directedGraphMemory(issue: "extra-reverse" | "omit-paths" | null = null): MemoryRecord {
  const nodes = [node("digraph-u", "U", .2, .5), node("digraph-v", "V", .5, .28), node("digraph-w", "W", .8, .5)];
  const relations = [relation("digraph-uv", "digraph-u", "digraph-v", "flows_to", "directed edge"), relation("digraph-vw", "digraph-v", "digraph-w", "flows_to", "directed edge"), relation("digraph-uw", "digraph-u", "digraph-w", "flows_to", "directed edge"), ...(issue === "extra-reverse" ? [relation("digraph-wu", "digraph-w", "digraph-u", "flows_to", "scripted extra reverse edge")] : [])];
  const facts = [fact("digraph-edges", "Directed edges", "are", "U→V, V→W, U→W", relations.slice(0, 3).map(r => r.id)), ...(issue === "omit-paths" ? [] : [fact("digraph-paths", "Directed paths from U to W", "number", "2: direct U→W and via V", ["digraph-uv", "digraph-vw", "digraph-uw"])]), fact("digraph-cycle", "Directed cycles", "are", "absent", ["digraph-uv", "digraph-vw", "digraph-uw"]), fact("digraph-arrow-meaning", "Arrow meaning", "is", "graph direction only", relations.slice(0, 3).map(r => r.id), ["not a causal explanation"])];
  return makeMemory({ title: "Three-node directed graph", domain: "mathematics", figure_type: "structure", summary: "The directed graph contains U→V, V→W, and U→W. There are two directed paths from U to W and no directed cycle; arrows describe graph direction, not scientific causation.", nodes, relations, facts });
}
function parabolaMemory(issue: "derivative-sign" | "nonnegative" | null = null): MemoryRecord {
  const facts = [fact("para-function", "Function f(x)", "equals", "x²", ["parabola-series-f"], ["x from −2 to 2"]), fact("para-derivative", "Derivative f′(x)", "equals", "2x", ["parabola-series-d"]), fact("para-origin", "At x = 0", "f(x) is", "0 and f′(x) is 0", ["parabola-series-f", "parabola-series-d"]), ...(issue === "derivative-sign" ? [] : [fact("para-sign", "Derivative sign", "is negative for x < 0 and positive for x > 0", "with zero at x = 0", ["parabola-series-d"])]), ...(issue === "nonnegative" ? [] : [fact("para-nonnegative", "Function f(x) = x²", "is", "nonnegative on the shown interval", ["parabola-series-f"])])];
  return makeMemory({ title: "Parabola and its derivative", domain: "mathematics", figure_type: "plot", summary: "The graph shows f(x) = x² with derivative f′(x) = 2x over x ∈ [−2, 2]. The function is nonnegative and the derivative changes sign at zero.", plots: [parabolaPlot], facts });
}

const recipes: ExampleDefinition[] = [
  { id: "physics-oscillator", title: "Mass–spring–damper oscillator", domain: "physics", figure_type: "mechanism", split: "dev", description: "An unforced oscillator with linear spring and viscous damping forces. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("osc-k1", "The spring force follows Fs = −kx for a linear spring.", "Spring force Fs", "equals", "−kx", ["linear spring"]), keypoint("osc-k2", "The damping force follows Fd = −cv for viscous damping.", "Damping force Fd", "equals", "−cv", ["viscous damping"]), keypoint("osc-k3", "The mass equation is m x′′ = Fs + Fd.", "Mass acceleration m x′′", "equals", "Fs + Fd"), keypoint("osc-k4", "No external driving force is shown.", "External driving force", "is", "absent")], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/physics-oscillator-clear-v2.png", change: "Reference rendering with legible force labels and explicit linear/viscous assumptions." },
      { id: "challenged", label: "Challenged", image_url: "/examples/physics-oscillator-challenged-v2.png", change: "Same mechanism and equations; force labels and assumption tags are lighter and smaller." }], gold: oscillatorMemory(), demo_a: oscillatorMemory("damping"), demo_b: oscillatorMemory("unforced") },
  { id: "physics-resonance", title: "Damped oscillator response", domain: "physics", figure_type: "plot", split: "holdout", description: "Normalized response curves for ζ = 0.15 and ζ = 0.35. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("res-k1", "The horizontal frequency ratio r = ω/ω₀ spans 0 to 2 and is dimensionless.", "Frequency ratio r", "equals", "ω/ω₀", ["dimensionless", "range 0–2"]), keypoint("res-k2", "Amplitude follows the displayed A(r, ζ) equation.", "Normalized amplitude A(r, ζ)", "equals", "1 / √[(1−r²)² + (2ζr)²]"), keypoint("res-k3", "The ζ = 0.15 peak is higher than the ζ = 0.35 peak.", "Peak amplitude", "is higher for", "ζ = 0.15 than for ζ = 0.35"), keypoint("res-k4", "The ζ = 0.15 peak lies slightly below r = 1, not exactly at 1.", "Peak for ζ = 0.15", "occurs", "slightly below r = 1", ["not exactly at r = 1"])], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/physics-resonance-clear-v3.png", change: "Reference rendering with readable equation, normalized axes, and damping legend." },
      { id: "challenged", label: "Challenged", image_url: "/examples/physics-resonance-challenged-v3.png", change: "Same plotted curves; equation and legend are reduced and the legend swatches are lighter." }], gold: resonanceMemory(), demo_a: resonanceMemory("peak-location"), demo_b: resonanceMemory("damping-contrast") },
  { id: "materials-layered-stack", title: "Idealized A / B / A layered stack", domain: "materials", figure_type: "structure", split: "dev", description: "A three-layer cross-section showing B between two non-contacting A layers. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("layer-k1", "The vertical layer order is A on top, B in the middle, and A on the bottom.", "Layer sequence", "is", "A (top) / B (middle) / A (bottom)"), keypoint("layer-k2", "The middle B layer is adjacent to the top A layer.", "Layer B", "is adjacent to", "top layer A"), keypoint("layer-k3", "The middle B layer is adjacent to the bottom A layer.", "Layer B", "is adjacent to", "bottom layer A"), keypoint("layer-k4", "The two A layers do not directly contact one another.", "Top and bottom A layers", "are separated by", "middle layer B")], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/materials-layered-stack-clear-v4.png", change: "Reference cross-section with clear interfaces and layer labels." },
      { id: "challenged", label: "Challenged", image_url: "/examples/materials-layered-stack-challenged-v4.png", change: "Same A/B/A stack; interface strokes and the middle-layer label are lighter and smaller." }], gold: layeredMemory(), demo_a: layeredMemory("top-contact"), demo_b: layeredMemory("bottom-contact") },
  { id: "materials-thermal-expansion", title: "Linear thermal expansion", domain: "materials", figure_type: "plot", split: "dev", description: "An instructional ΔL/L₀ versus ΔT plot with two expansion coefficients. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("thermal-k1", "The shown relationship is the linear approximation ΔL/L₀ = αΔT.", "Relative length change ΔL/L₀", "equals", "αΔT", ["linear approximation"]), keypoint("thermal-k2", "The temperature-change axis spans 0 to 100 K.", "Temperature change ΔT", "ranges", "0–100 K"), keypoint("thermal-k3", "Material A has α = 10 × 10⁻⁶ K⁻¹.", "Material A expansion coefficient α", "equals", "10 × 10⁻⁶ K⁻¹"), keypoint("thermal-k4", "Material B’s slope is twice material A’s slope.", "Material B slope", "is", "2× material A slope")], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/materials-thermal-expansion-clear-v3.png", change: "Reference rendering with visible linear-approximation note, units, and endpoint scale." },
      { id: "challenged", label: "Challenged", image_url: "/examples/materials-thermal-expansion-challenged-v3.png", change: "Same instructional lines; approximation note and units are lighter and smaller." }], gold: thermalMemory(), demo_a: thermalMemory("linear-note"), demo_b: thermalMemory("material-b") },
  { id: "mathematics-directed-graph", title: "Three-node directed graph", domain: "mathematics", figure_type: "structure", split: "dev", description: "A directed acyclic graph with a direct and an indirect U-to-W path. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("graph-k1", "The graph has directed edges U→V, V→W, and U→W.", "Directed edges", "are", "U→V, V→W, U→W"), keypoint("graph-k2", "There are two directed paths from U to W: directly and through V.", "Directed paths from U to W", "number", "2: direct U→W and via V"), keypoint("graph-k3", "There is no directed cycle.", "Directed cycles", "are", "absent"), keypoint("graph-k4", "The arrows encode graph direction, not scientific causation.", "Arrow meaning", "is", "graph direction only", ["not a causal explanation"])], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/mathematics-directed-graph-clear-v3.png", change: "Reference graph with distinct arrowheads and clearly separated labels." },
      { id: "challenged", label: "Challenged", image_url: "/examples/mathematics-directed-graph-challenged-v3.png", change: "Same three arrows; arrowheads and edge labels are smaller and lower contrast." }], gold: directedGraphMemory(), demo_a: directedGraphMemory("omit-paths"), demo_b: directedGraphMemory("extra-reverse") },
  { id: "mathematics-parabola", title: "Parabola and its derivative", domain: "mathematics", figure_type: "plot", split: "holdout", description: "The curves f(x) = x² and f′(x) = 2x on shared dimensionless axes. Scripted demo data is hand-authored, not a measured AI result.", source, license,
    keypoints: [keypoint("para-k1", "The function is f(x) = x² on the interval −2 to 2.", "Function f(x)", "equals", "x²", ["x from −2 to 2"]), keypoint("para-k2", "The derivative is f′(x) = 2x.", "Derivative f′(x)", "equals", "2x"), keypoint("para-k3", "The function is nonnegative on the shown interval.", "Function f(x) = x²", "is", "nonnegative on the shown interval"), keypoint("para-k4", "The derivative is zero at x = 0, negative for x < 0, and positive for x > 0.", "Derivative sign", "is negative for x < 0 and positive for x > 0", "with zero at x = 0")], versions: [
      { id: "clear", label: "Clear", image_url: "/examples/mathematics-parabola-clear-v3.png", change: "Reference plot with legible function and derivative labels and shared axes." },
      { id: "challenged", label: "Challenged", image_url: "/examples/mathematics-parabola-challenged-v3.png", change: "Same mathematical curves; curve labels and the zero crossing marker are smaller and lighter." }], gold: parabolaMemory(), demo_a: parabolaMemory("derivative-sign"), demo_b: parabolaMemory("nonnegative") },
];

for (const item of recipes) {
  item.gold = MemorySchema.parse(item.gold);
  item.demo_a = MemorySchema.parse(item.demo_a);
  item.demo_b = MemorySchema.parse(item.demo_b);
}

export const EXAMPLES: ExampleDefinition[] = recipes;
export function getExample(id: string): ExampleDefinition | undefined { return EXAMPLES.find(example => example.id === id); }
export function listExamples(): ExampleSummary[] {
  return EXAMPLES.map(example => ({ id: example.id, title: example.title, domain: example.domain, figure_type: example.figure_type, description: example.description, split: example.split, keypoints: example.keypoints, versions: example.versions, source: example.source, license: example.license }));
}
