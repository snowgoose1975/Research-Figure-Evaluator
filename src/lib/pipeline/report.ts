import type { RunSnapshot } from "../schemas";
import { buildReviewQueue } from "../evaluation/review";

export function markdownReport(run: RunSnapshot) {
  const escape = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = ["# Figure Relay — scientific information recovery", "", `Run: ${run.id}`, `Mode: ${run.mode === "mock" ? "SCRIPTED DEMO — not model output" : "LIVE MODEL RUN"}`, `Created: ${run.created_at}`, `Model: ${run.model}`, `Schema: ${run.schema_version}; prompts: ${run.prompt_version}`, `Status: ${run.status}`, "", "## Keypoint evidence", "", "| Author statement | Reader A | Reader B | Observed stage | Evidence / rationale |", "|---|---|---|---|---|"];
  for (const r of run.report?.keypoint_results ?? []) lines.push(`| ${escape(r.text)} | ${r.in_a.status} | ${r.in_b.status} | ${r.observed_stage} | ${escape(r.in_b.rationale)} |`);
  lines.push("", "## Assessment provenance", "", `Evaluation policy: ${run.report?.evaluation_version ?? "legacy — semantic statuses were not independently verified"}. These explanations are evaluator assessments, not quotations from readers A/B.`);
  for (const row of run.report?.keypoint_results ?? []) {
    lines.push("", `### ${escape(row.text)}`);
    for (const [side, judgment] of [["A", row.in_a], ["B", row.in_b]] as const) {
      const audit = judgment.evidence_audit;
      lines.push(`- ${side}: ${audit?.status ?? "audit unavailable"}; evaluator suggestion: ${audit?.requested_status ?? judgment.status}.`);
      if (audit?.suggestion_rationale) lines.push(`  - Original evaluator explanation (not reader wording): ${audit.suggestion_rationale}`);
      for (const reason of audit?.reasons ?? []) lines.push(`  - ${reason}`);
      for (const citation of audit?.citations ?? []) lines.push(`  - Extracted ${citation.type} ${citation.id}: ${citation.text}`);
    }
  }
  lines.push("", "## Graph record comparison", "", "This compares uniquely label-matched extracted records; it does not establish original-image correctness.");
  const graph = run.report?.graph_audit;
  if (!graph) lines.push("Unavailable in this legacy report.");
  else {
    lines.push(`Executed: ${graph.executed}; matched nodes: ${graph.matched_nodes}; unchanged edges: ${graph.unchanged_edges}.`);
    for (const [kind, edges] of [["Absent in B", graph.removed_edges], ["Added in B", graph.added_edges]] as const) for (const edge of edges) lines.push(`- ${kind}: ${edge.source} → ${edge.target}; ${edge.kind}, ${edge.direction}, ${edge.line_style}, ${edge.evidence_status}`);
    if (graph.ambiguous_nodes.length) lines.push(`- Ambiguous matches excluded: ${graph.ambiguous_nodes.join("; ")}`);
    if (graph.unmatched_a_nodes.length || graph.unmatched_b_nodes.length) lines.push(`- Unmatched nodes: A ${graph.unmatched_a_nodes.join("; ")}; B ${graph.unmatched_b_nodes.join("; ")}`);
  }
  lines.push("", "## What to review first", "", "Derived from saved records; these references do not locate pixels or establish defects in the original figure.");
  const queue = buildReviewQueue(run);
  if (!queue.length) lines.push("No review items from the available records. This is not proof of full fidelity.");
  for (const item of queue) {
    lines.push("", `### ${item.label}: ${item.title}`, "", item.observation, "", `Next step: ${item.action}`);
    for (const [side, refs] of [["A · first read", item.a], ["B · second read", item.b]] as const) {
      lines.push("", `${side}:`);
      if (!refs.length) lines.push("- No cited record item available.");
      for (const ref of refs) lines.push(`- ${ref.id}: ${ref.text}`);
    }
  }
  const scientificKeypoints = run.keypoints.filter(k => k.scientific);
  if (scientificKeypoints.length) {
    lines.push("", "## Project-curated scientific checks", "", "These checks were written by the project from the source figure and are not author-confirmed. They remain review_required.");
    for (const k of scientificKeypoints) lines.push(`- ${k.id}: ${k.text}`);
  }
  lines.push("", "## Detection coverage", "");
  if (!run.report?.coverage) {
    lines.push("Coverage metadata unavailable (legacy report). This report does not show which automatic checks ran; do not read an empty finding list as evidence of zero change.");
  } else {
    const coverage = run.report.coverage;
    lines.push(`- Fact-by-fact comparison: ${coverage.fact_comparison.executed ? "executed" : "NOT EXECUTED"} (A facts: ${coverage.fact_comparison.a_facts}; B facts: ${coverage.fact_comparison.b_facts}).${coverage.fact_comparison.reason ? ` ${coverage.fact_comparison.reason}` : ""}`);
    lines.push(`- Relation-direction audit: ${coverage.relation_audit.executed ? "executed" : "NOT EXECUTED"}.${coverage.relation_audit.reason ? ` ${coverage.relation_audit.reason}` : ""}`);
    lines.push(`- Condition audit: ${coverage.condition_audit.executed ? "executed" : "NOT EXECUTED"}.${coverage.condition_audit.reason ? ` ${coverage.condition_audit.reason}` : ""}`);
    const axisExecuted = coverage.plot_audit.axis_executed ?? coverage.plot_audit.executed;
    const seriesExecuted = coverage.plot_audit.series_executed ?? coverage.plot_audit.matched_series > 0;
    lines.push(`- Plot-axis audit: ${axisExecuted ? "executed" : "NOT EXECUTED"} (A plots: ${coverage.plot_audit.a_plots}; B plots: ${coverage.plot_audit.b_plots}; matched plots: ${coverage.plot_audit.matched_plots ?? coverage.plot_audit.matched_series}).`);
    lines.push(`- Series-shape audit: ${seriesExecuted ? "executed" : "NOT EXECUTED"} (matched series: ${coverage.plot_audit.matched_series}).${coverage.plot_audit.reason ? ` ${coverage.plot_audit.reason}` : ""}`);
    if (coverage.plot_audit.unmatched_a_plots?.length) lines.push(`- Unmatched A plots: ${coverage.plot_audit.unmatched_a_plots.join("; ")}`);
    if (coverage.plot_audit.unmatched_a_series.length) lines.push(`- Unmatched A series: ${coverage.plot_audit.unmatched_a_series.join("; ")}`);
    if (coverage.plot_audit.unmatched_b_plots?.length) lines.push(`- Unmatched B plots: ${coverage.plot_audit.unmatched_b_plots.join("; ")}`);
    if (coverage.plot_audit.unmatched_b_series?.length) lines.push(`- Unmatched B series: ${coverage.plot_audit.unmatched_b_series.join("; ")}`);
    if (coverage.unchecked.length) lines.push(`- Not covered by these checks: ${coverage.unchecked.join("; ")}`);
    lines.push(`- ${coverage.note}`);
  }
  lines.push("", "## Scientific findings", "");
  if (!run.report?.scientific_findings) {
    lines.push("Scientific-finding metadata unavailable (legacy report). No absence of findings can be inferred.");
  } else if (!run.report.scientific_findings.length) {
    lines.push("No rule-level scientific deviations were detected by the executed checks. This is not evidence that the figure is unchanged.");
  } else {
    for (const finding of run.report.scientific_findings) lines.push(`- [${finding.status.toUpperCase()}] ${finding.category}: ${finding.summary}${finding.review_required ? " (review required)" : ""}`);
  }
  lines.push("", "## Rendering", "", `Structural audit: ${run.render_audit?.structural_audit ?? "unavailable"}; visual review: ${run.render_audit?.visual_review ?? "unavailable"}.`);
  for (const w of run.render_audit?.warnings ?? []) lines.push(`- ${w}`);
  lines.push("", "## Limitations", "");
  for (const l of run.report?.limitations ?? []) lines.push(`- ${l}`);
  if (run.baseline) {
    lines.push("", "## Independent keypoint-aware baseline", "", "This baseline sees author keypoints and must not be treated as another blind reader.");
    if (run.baseline.error) lines.push(run.baseline.error);
    for (const r of run.baseline.result?.results ?? []) lines.push(`- ${r.keypoint_id}: ${r.judgment.status} — ${r.judgment.rationale}`);
  }
  lines.push("", "## Reproducibility", "", `Input SHA-256: ${run.input_digest}`, `Intent SHA-256: ${run.intent_digest}`, `Settings SHA-256: ${run.settings_digest}`, `Engine SHA-256: ${run.engine_version}`, "", "Observed differences do not prove causation, human readability, or scientific truth.", "");
  return lines.join("\n");
}
