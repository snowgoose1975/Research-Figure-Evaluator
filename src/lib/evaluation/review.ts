import type { MemoryRecord, RunSnapshot } from "../schemas";

export interface ReviewEvidence { id: string; text: string }
export interface ReviewItem {
  id: string;
  source: "record_difference" | "reconstruction" | "checkpoint" | "coverage";
  label: string;
  title: string;
  observation: string;
  action: string;
  a: ReviewEvidence[];
  b: ReviewEvidence[];
}

// Resolve each side separately: local IDs never establish A/B correspondence.
function evidence(memory: MemoryRecord | null, ids: string[]): ReviewEvidence[] {
  return ids.map(id => {
    if (!memory) return { id, text: "Record unavailable." };
    const fact = memory.facts.find(item => item.id === id);
    if (fact) return { id, text: `${fact.subject} ${fact.predicate} ${fact.object}${fact.qualifiers.length ? ` (${fact.qualifiers.join("; ")})` : ""}; ${fact.certainty}` };
    const node = memory.graph.nodes.find(item => item.id === id);
    if (node) return { id, text: node.label };
    const relation = memory.graph.relations.find(item => item.id === id);
    if (relation) {
      const name = (nodeId: string) => memory.graph.nodes.find(item => item.id === nodeId)?.label ?? nodeId;
      const connector = relation.direction === "directed" ? "→" : relation.direction === "undirected" ? "—" : "?";
      return { id, text: `${name(relation.source_id)} ${connector} ${name(relation.target_id)}: ${relation.kind}; ${relation.direction}; ${relation.evidence_status}` };
    }
    const condition = memory.graph.conditions.find(item => item.id === id);
    if (condition) return { id, text: condition.text };
    const group = memory.graph.groups.find(item => item.id === id);
    if (group) return { id, text: group.label };
    const plot = memory.plots.find(item => item.id === id);
    if (plot) return { id, text: `${plot.title}; x: ${plot.x_axis.label} [${plot.x_axis.unit || "unit unspecified"}], ${plot.x_axis.scale}; y: ${plot.y_axis.label} [${plot.y_axis.unit || "unit unspecified"}], ${plot.y_axis.scale}` };
    for (const panel of memory.plots) {
      const series = panel.series.find(item => item.id === id);
      if (series) return { id, text: `${panel.title} / ${series.label}: ${series.points.map(point => `(${point.x}, ${point.y})`).join(" → ")}${series.approximate ? " [approximate samples]" : ""}` };
    }
    const uncertainty = memory.uncertainties.find(item => item.id === id);
    return { id, text: uncertainty?.note ?? "Referenced item unavailable in this record; verify the saved report." };
  });
}

const actions = {
  relation_direction: "Compare the cited A/B relation endpoints and arrow direction in the reconstruction. Check the original before attributing this difference to its design.",
  condition_loss: "Compare the cited qualifier and its target in A, the reconstruction and B. Restore a missing qualifier in the reconstruction before judging the original.",
  value_change: "Compare the cited values and units in both records with the reconstruction, then verify against the original.",
  threshold_value: "Check the reference-line height against the axis ticks and units in both images; verify the stated tolerance independently.",
  axis_unit_scale: "Check the cited panel's axis labels, units and linear/log scale in both images. A record difference does not prove that the original axis is wrong.",
  series_shape_change: "Trace the cited series through its sampled coordinates in A, the reconstructed curve and B. Confirm whether the renderer or the second read introduced the shape change.",
};

/** Display-only triage. Does not rescore or mutate saved runs or infer causes. */
export function buildReviewQueue(run: RunSnapshot): ReviewItem[] {
  const report = run.report;
  if (!report) return [];
  const entries: { priority: number; item: ReviewItem }[] = [];
  const add = (priority: number, item: ReviewItem) => entries.push({ priority, item });
  for (const finding of report.scientific_findings ?? []) {
    // Show content changes before repetitive axis-field bookkeeping. This is a
    // reading order, not a scientific severity estimate.
    add(finding.status === "confirmed" ? finding.category === "axis_unit_scale" ? 15 : 10 : 40, {
      id: `finding-${finding.id}`, source: "record_difference",
      label: finding.status === "confirmed" ? "RULE-LEVEL RECORD DIFFERENCE" : "POSSIBLE RECORD DIFFERENCE · REVIEW",
      title: finding.category.replaceAll("_", " "), observation: finding.summary,
      action: actions[finding.category],
      a: evidence(run.a, finding.a_item_ids), b: evidence(run.b, finding.b_item_ids),
    });
  }
  for (const row of report.keypoint_results) {
    const gap = row.render_item_status === "unsupported";
    if (!gap && row.in_a.status === "retained" && row.in_b.status === "retained") continue;
    const unresolved = row.in_a.status === "uncertain" || row.in_b.status === "uncertain";
    add(gap ? 20 : unresolved ? 50 : 30, {
      id: `checkpoint-${row.keypoint_id}`, source: gap ? "reconstruction" : "checkpoint",
      label: gap ? "RECONSTRUCTION GAP" : "CHECKPOINT · REVIEW",
      title: row.text,
      observation: `A: ${row.in_a.status} — ${row.in_a.rationale} B: ${row.in_b.status} — ${row.in_b.rationale}${row.recovery_in_b ? " Later recovery does not make the first reading lossless." : ""}`,
      action: gap
        ? "Inspect the unsupported remembered item in the reconstruction. Resolve this rendering gap before proposing changes to the original figure."
        : row.in_a.status === "retained" && row.in_b.status !== "retained"
          ? "Inspect A's cited content in the reconstruction, then compare B's evidence. Review the reconstruction and second reading before editing the original."
          : "Compare A's cited evidence with the original label, arrow, qualifier or axis for this checkpoint. If a mismatch is verified, test one expression change with the same checkpoints and settings; the cause is not established here.",
      a: evidence(run.a, row.in_a.matched_item_ids), b: evidence(run.b, row.in_b.matched_item_ids),
    });
  }
  const unsupported = run.render_audit?.unsupported_item_ids ?? [];
  if (unsupported.length && !report.keypoint_results.some(row => row.render_item_status === "unsupported")) {
    add(20, { id: "renderer-gap", source: "reconstruction", label: "RECONSTRUCTION GAP", title: "Remembered content was not fully rendered", observation: `${unsupported.length} remembered item(s) are listed as unsupported by the renderer.`, action: "Check these items against the reconstruction before attributing later losses to the original figure.", a: evidence(run.a, unsupported), b: [] });
  }
  const coverage = report.coverage;
  const skipped = coverage ? [!coverage.fact_comparison.executed && "facts", !coverage.relation_audit.executed && "relation direction", !coverage.condition_audit.executed && "conditions", !(coverage.plot_audit.axis_executed ?? coverage.plot_audit.executed) && "plot axes", !(coverage.plot_audit.series_executed ?? coverage.plot_audit.matched_series > 0) && "series shape"].filter(Boolean) : [];
  if (!coverage || skipped.length || coverage.unchecked.length || report.scientific_findings === undefined) {
    add(60, { id: "coverage-limit", source: "coverage", label: "COVERAGE LIMIT", title: "Unverified content remains", observation: !coverage ? "Coverage metadata unavailable in this saved report." : `${skipped.length ? `Audits not executed: ${skipped.join(", ")}. ` : ""}${coverage.unchecked.length ? `Not covered: ${coverage.unchecked.join("; ")}.` : ""}${report.scientific_findings === undefined ? " Scientific-finding metadata unavailable." : ""}`, action: "Review unchecked visual content manually. Retained checkpoints and an empty finding list do not establish full visual or scientific fidelity.", a: [], b: [] });
  }
  return entries.sort((a, b) => a.priority - b.priority).map(entry => entry.item);
}
