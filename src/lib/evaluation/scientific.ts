import type { EvaluationCoverage, Fact, Judgment, MemoryRecord, ScientificCheck, ScientificFinding } from "../schemas";

const normText = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, " ").replace(/[.,;:]+$/g, "").trim();
const same = (left: string, right: string) => normText(left) === normText(right);
const labelCore = (label: string) => normText(label).split(" · ")[0];
const unitCore = (unit: string) => { const value = normText(unit); return value === "none" || value === "n/a" ? "" : value; };
const factKey = (fact: Fact) => [fact.subject, fact.predicate, fact.object].map(normText).join("\u0001");

// Flatness is a visual property. The threshold is a fixed fraction of each
// panel's y-axis span, not a guess based on how JavaScript printed a number.
// Do not impose an absolute floor here: an absolute floor is a scientific
// tolerance with the axis's units, and it can swallow a real small-scale loss.
const PLOT_FLATNESS_FRACTION = 0.01;
function plotFlatnessTolerance(plot: MemoryRecord["plots"][number]): number {
  return Math.abs(plot.y_axis.max - plot.y_axis.min) * PLOT_FLATNESS_FRACTION;
}

// A machine-precision allowance only absorbs floating-point representation
// error. It scales with the values being compared and never adds a fixed,
// unit-bearing interval. Scientific tolerances remain explicit in the check.
const FLOATING_POINT_ULP_FACTOR = 8;
function floatingPointAllowance(...values: number[]): number {
  const scale = values.reduce((sum, value) => sum + Math.abs(value), 0);
  return Number.isFinite(scale) ? scale * Number.EPSILON * FLOATING_POINT_ULP_FACTOR : 0;
}

function numericParts(text: string): { values: number[]; skeleton: string } {
  const values: number[] = [];
  const skeleton = text.replace(/-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g, token => {
    values.push(Number(token));
    return "#";
  });
  return { values, skeleton: normText(skeleton) };
}
function numericEqualityTolerance(left: number[], right: number[]): number {
  return floatingPointAllowance(...left, ...right);
}
function plotLabel(plot: MemoryRecord["plots"][number]): string {
  return plot.title.trim() || `${plot.x_axis.label} / ${plot.y_axis.label}`;
}

function directed(predicate: string): boolean {
  return ["promotes", "inhibits", "flows_to", "contains"].includes(normText(predicate));
}

function finding(category: ScientificFinding["category"], status: ScientificFinding["status"], summary: string, aIds: string[], bIds: string[], discriminator = ""): ScientificFinding {
  const suffix = discriminator ? `-${discriminator}` : "";
  return { id: `sf-${category}-${aIds[0] ?? "plot"}-${bIds[0] ?? "none"}${suffix}`, category, status, summary, a_item_ids: aIds, b_item_ids: bIds, review_required: true };
}

function auditFacts(a: MemoryRecord, b: MemoryRecord): ScientificFinding[] {
  const findings: ScientificFinding[] = [];
  const aGroups = new Map<string, Fact[]>();
  for (const fact of a.facts) aGroups.set(factKey(fact), [...(aGroups.get(factKey(fact)) ?? []), fact]);

  for (const fact of a.facts) {
    const sameOrientation = b.facts.filter(candidate => same(candidate.subject, fact.subject) && same(candidate.predicate, fact.predicate) && same(candidate.object, fact.object));
    if (directed(fact.predicate)) {
      const reversed = b.facts.filter(candidate => same(candidate.predicate, fact.predicate) && same(candidate.subject, fact.object) && same(candidate.object, fact.subject));
      if (reversed.length) {
        const conflict = sameOrientation.length > 0;
        const ambiguous = reversed.length > 1 || (aGroups.get(factKey(fact))?.length ?? 0) > 1;
        findings.push(finding(
          "relation_direction",
          conflict || ambiguous ? "uncertain" : "confirmed",
          conflict
            ? `Both orientations of "${fact.subject} ${fact.predicate} ${fact.object}" appear in B; direction alignment is ambiguous.`
            : ambiguous
              ? `B reverses "${fact.subject} ${fact.predicate} ${fact.object}", but repeated matching assertions prevent a unique alignment.`
              : `B records the reverse direction: "${reversed[0].subject} ${reversed[0].predicate} ${reversed[0].object}".`,
          [fact.id], reversed.map(candidate => candidate.id),
        ));
      }
    }
    if (fact.qualifiers.length) {
      const matches = b.facts.filter(candidate => same(candidate.subject, fact.subject) && same(candidate.predicate, fact.predicate) && same(candidate.object, fact.object));
      const baseUnique = (aGroups.get(factKey(fact))?.length ?? 0) === 1;
      if (matches.length && baseUnique) {
        const missingByMatch = matches.map(match => fact.qualifiers.filter(qualifier => !match.qualifiers.some(candidate => same(candidate, qualifier))));
        const missing = missingByMatch.find(list => list.length) ?? [];
        if (missing.length) {
          findings.push(finding(
            "condition_loss",
            matches.length > 1 ? "uncertain" : "confirmed",
            matches.length > 1
              ? `Multiple B assertions match "${fact.subject} ${fact.predicate} ${fact.object}"; condition alignment is ambiguous (missing text: ${missing.join("; ")}).`
              : `The matched B assertion omits recorded condition text: ${missing.join("; ")}.`,
            [fact.id], matches.map(candidate => candidate.id),
          ));
        }
      }
    }
    const aNumbers = numericParts(fact.object);
    if (aNumbers.values.length) {
      const sameSubjectPredicate = a.facts.filter(candidate => same(candidate.subject, fact.subject) && same(candidate.predicate, fact.predicate));
      const candidates = b.facts.filter(candidate => same(candidate.subject, fact.subject) && same(candidate.predicate, fact.predicate) && numericParts(candidate.object).skeleton === aNumbers.skeleton);
      if (sameSubjectPredicate.length === 1 && candidates.length >= 1) {
        const parsedCandidates = candidates.map(candidate => ({ candidate, numbers: numericParts(candidate.object) })).filter(entry => entry.numbers.values.length === aNumbers.values.length);
        if (parsedCandidates.length) {
          const tolerance = numericEqualityTolerance(aNumbers.values, parsedCandidates[0].numbers.values);
          const differing = parsedCandidates.filter(entry => aNumbers.values.some((value, index) => Math.abs(value - entry.numbers.values[index]) > tolerance));
          if (differing.length) {
            const threshold = /(?:^|\s)(?:threshold|cut-?off)\b/i.test(fact.object) || /(?:^|\s)(?:p(?:-value)?|α|alpha)\s*[=<>≤≥]/i.test(fact.object) || /[<>≤≥]/.test(fact.object);
            findings.push(finding(
              threshold ? "threshold_value" : "value_change",
              candidates.length > 1 ? "uncertain" : "confirmed",
              `A records "${fact.object}"; B records "${differing[0].candidate.object}" for the same subject and predicate. Difference exceeds the numeric-equality tolerance (${tolerance}).${candidates.length > 1 ? " Multiple B candidates prevent a unique alignment." : ""}`,
              [fact.id], candidates.map(candidate => candidate.id),
            ));
          }
        }
      }
    }
  }
  return findings;
}

function auditPlots(a: MemoryRecord, b: MemoryRecord): { findings: ScientificFinding[]; matchedSeries: number; matchedPlots: number; unmatched: string[]; unmatchedPlots: string[]; unmatchedBPlots: string[]; unmatchedBSeries: string[] } {
  const findings: ScientificFinding[] = [];
  const unmatched: string[] = [];
  const unmatchedPlots: string[] = [];
  const unmatchedBPlots: string[] = [];
  const unmatchedBSeries: string[] = [];
  let matchedSeries = 0;
  let matchedPlots = 0;
  const plotKey = (plot: MemoryRecord["plots"][number]) => normText(plot.title) || `${normText(plot.x_axis.label)}|${normText(plot.y_axis.label)}`;
  const group = (plots: MemoryRecord["plots"]) => {
    const groups = new Map<string, MemoryRecord["plots"]>();
    for (const plot of plots) groups.set(plotKey(plot), [...(groups.get(plotKey(plot)) ?? []), plot]);
    return groups;
  };
  const aGroups = group(a.plots);
  const bGroups = group(b.plots);
  const matchedKeys = new Set<string>();
  for (const [key, aPlots] of aGroups) {
    const label = plotLabel(aPlots[0]);
    // A duplicated panel key on either side makes the correspondence
    // one-to-many. Do not score axis or series differences in that case.
    if (aPlots.length !== 1) {
      unmatchedPlots.push(`${label} (duplicate panel key in A; no unique correspondence)`);
      for (const plot of aPlots) for (const series of plot.series) unmatched.push(`${label} / ${series.label} (panel not matched: duplicate panel key in A)`);
      continue;
    }
    const bPlots = bGroups.get(key) ?? [];
    if (bPlots.length !== 1) {
      unmatchedPlots.push(`${label} (${bPlots.length ? "duplicate panel key in B" : "no B panel match"})`);
      for (const series of aPlots[0].series) unmatched.push(`${label} / ${series.label} (panel not matched)`);
      continue;
    }
    const aPlot = aPlots[0];
    const bPlot = bPlots[0];
    matchedKeys.add(key);
    matchedPlots++;
    for (const [axisName, aAxis, bAxis] of [["x", aPlot.x_axis, bPlot.x_axis], ["y", aPlot.y_axis, bPlot.y_axis]] as const) {
      if (unitCore(aAxis.unit) !== unitCore(bAxis.unit)) {
        findings.push(finding("axis_unit_scale", "confirmed", `Panel "${aPlot.title}" ${axisName}-axis unit field changed from "${aAxis.unit}" to "${bAxis.unit}".`, [aPlot.id], [bPlot.id], `${axisName}-unit`));
      }
      if (aAxis.scale !== bAxis.scale) {
        findings.push(finding("axis_unit_scale", "confirmed", `Panel "${aPlot.title}" ${axisName}-axis scale changed from "${aAxis.scale}" to "${bAxis.scale}".`, [aPlot.id], [bPlot.id], `${axisName}-scale`));
      }
    }
    const aByLabel = new Map<string, MemoryRecord["plots"][number]["series"]>();
    const bByLabel = new Map<string, MemoryRecord["plots"][number]["series"]>();
    for (const series of aPlot.series) aByLabel.set(labelCore(series.label), [...(aByLabel.get(labelCore(series.label)) ?? []), series]);
    for (const series of bPlot.series) bByLabel.set(labelCore(series.label), [...(bByLabel.get(labelCore(series.label)) ?? []), series]);
    for (const [labelKey, aSeriesList] of aByLabel) {
      if (aSeriesList.length !== 1) { unmatched.push(`${labelKey} (duplicate label in A)`); continue; }
      const bSeriesList = bByLabel.get(labelKey) ?? [];
      if (bSeriesList.length === 0) { unmatched.push(labelKey); continue; }
      if (bSeriesList.length > 1) {
        unmatched.push(`${labelKey} (duplicate label in B)`);
        findings.push(finding("series_shape_change", "uncertain", `Series "${aSeriesList[0].label}" appears more than once in B; flatness cannot be aligned uniquely.`, [aSeriesList[0].id], bSeriesList.map(series => series.id)));
        continue;
      }
      const aSeries = aSeriesList[0];
      const bSeries = bSeriesList[0];
      if (aSeries.points.length < 2 || bSeries.points.length < 2) { unmatched.push(`${labelKey} (fewer than two points)`); continue; }
      matchedSeries++;
      const valuesA = aSeries.points.map(point => point.y);
      const valuesB = bSeries.points.map(point => point.y);
      const toleranceA = plotFlatnessTolerance(aPlot);
      const toleranceB = plotFlatnessTolerance(bPlot);
      const rangeA = Math.max(...valuesA) - Math.min(...valuesA);
      const rangeB = Math.max(...valuesB) - Math.min(...valuesB);
      const flatA = rangeA <= toleranceA;
      const flatB = rangeB <= toleranceB;
      if (flatA !== flatB) {
        findings.push(finding(
          "series_shape_change",
          "confirmed",
          `Series "${aSeries.label}" is ${flatA ? "flat" : "not flat"} in A but ${flatB ? "flat" : "not flat"} in B (A range ${rangeA}, B range ${rangeB}; tolerance is 1% of each panel's y-axis span: A ${toleranceA}, B ${toleranceB}).`,
          [aSeries.id], [bSeries.id],
        ));
      }
    }
    for (const [labelKey, bSeriesList] of bByLabel) if (!aByLabel.has(labelKey)) unmatchedBSeries.push(`${label} / ${bSeriesList[0].label} (not present in A)`);
  }
  for (const [key, bPlots] of bGroups) {
    if (matchedKeys.has(key)) continue;
    const label = plotLabel(bPlots[0]);
    unmatchedBPlots.push(`${label} (${bPlots.length > 1 ? "duplicate panel key in B" : "no unique A panel match"})`);
    for (const plot of bPlots) for (const series of plot.series) unmatchedBSeries.push(`${label} / ${series.label} (panel not matched)`);
  }
  return { findings, matchedSeries, matchedPlots, unmatched, unmatchedPlots, unmatchedBPlots, unmatchedBSeries };
}

export function auditScientific(a: MemoryRecord, b: MemoryRecord): { coverage: EvaluationCoverage; findings: ScientificFinding[] } {
  const factFindings = auditFacts(a, b);
  // Run the plot audit whenever either side has a plot. It is responsible for
  // listing every panel and series that has no unique counterpart, including
  // the case where Reader A recorded no plots but Reader B introduced one.
  const plotResult = a.plots.length || b.plots.length ? auditPlots(a, b) : { findings: [] as ScientificFinding[], matchedSeries: 0, matchedPlots: 0, unmatched: [] as string[], unmatchedPlots: [] as string[], unmatchedBPlots: [] as string[], unmatchedBSeries: [] as string[] };
  const factsExecuted = a.facts.length > 0 && b.facts.length > 0;
  const directedCount = a.facts.filter(fact => directed(fact.predicate)).length;
  const conditionCount = a.facts.filter(fact => fact.qualifiers.length).length;
  const factReason = !a.facts.length
    ? "Reader A recorded no explicit facts. Fact-by-fact comparison was not executed. Node and curve differences outside the recorded plots are not covered by this report."
    : !b.facts.length
      ? "Reader B recorded no explicit facts. Fact-by-fact comparison was not executed. Node and curve differences outside the recorded plots are not covered by this report."
      : null;
  const relationReason = factReason ?? (directedCount ? null : "A recorded no directed facts, so relation-direction comparison was not executed.");
  const conditionReason = factReason ?? (conditionCount ? null : "A recorded no qualified facts, so condition comparison was not executed.");
  const plotExecuted = a.plots.length > 0 && b.plots.length > 0 && plotResult.matchedPlots > 0;
  const seriesExecuted = plotResult.matchedSeries > 0;
  const plotReason = !a.plots.length ? "A recorded no plots, so plot-axis and series-shape comparison was not executed." : !b.plots.length ? "B recorded no plots, so plot-axis and series-shape comparison was not executed." : !plotResult.matchedPlots ? "No panels matched one-to-one by title or axis labels, so plot-axis and series-shape comparison was not executed." : seriesExecuted ? null : "Panels matched one-to-one, but no series labels matched uniquely, so series-shape comparison was not executed.";
  const hasUnmatched = plotResult.unmatched.length > 0 || plotResult.unmatchedPlots.length > 0 || plotResult.unmatchedBPlots.length > 0 || plotResult.unmatchedBSeries.length > 0;
  const unchecked = [
    ...(factsExecuted ? [] : ["Fact-by-fact assertion comparison"]),
    "Unlabelled node and edge changes",
    "Geometry and relative position",
    "Confidence bands and shaded ranges",
    ...(plotExecuted ? [] : ["Axis units and scales"]),
    ...(seriesExecuted ? [] : ["Series shapes"]),
    "Precision digitization of plotted values",
    "Semantic equivalence of paraphrased labels and conditions",
    ...(hasUnmatched ? ["Axis and series checks for unmatched or ambiguous panels"] : []),
  ];
  return {
    coverage: {
      fact_comparison: { executed: factsExecuted, a_facts: a.facts.length, b_facts: b.facts.length, reason: factReason },
      relation_audit: { executed: factsExecuted && directedCount > 0, reason: relationReason },
      condition_audit: { executed: factsExecuted && conditionCount > 0, reason: conditionReason },
      plot_audit: {
        executed: plotExecuted,
        axis_executed: plotExecuted,
        series_executed: seriesExecuted,
        a_plots: a.plots.length,
        b_plots: b.plots.length,
        matched_plots: plotResult.matchedPlots,
        matched_series: plotResult.matchedSeries,
        unmatched_a_plots: plotResult.unmatchedPlots,
        unmatched_a_series: plotResult.unmatched,
        unmatched_b_plots: plotResult.unmatchedBPlots,
        unmatched_b_series: plotResult.unmatchedBSeries,
        reason: plotReason,
      },
      unchecked,
      note: "Coverage states which automatic checks ran. An empty finding list does not mean the figure is unchanged. Panels are matched only by a unique title or axis-label key, and series only by a unique label within a uniquely matched panel.",
    },
    findings: [...factFindings, ...plotResult.findings],
  };
}

export function judgeScientific(check: ScientificCheck, memory: MemoryRecord): Judgment {
  if (memory.completeness !== "complete") return { status: "uncertain", issue_types: [], matched_item_ids: [], rationale: "Extraction was not complete; the project-curated plot check cannot be evaluated.", method: "rule", review_required: true };
  const matches = memory.plots.flatMap(plot => plot.series.filter(series => labelCore(series.label) === labelCore(check.series_label)).map(series => ({ plot, series })));
  if (matches.length !== 1) return { status: "uncertain", issue_types: [], matched_item_ids: matches.flatMap(match => [match.plot.id, match.series.id]), rationale: `Project-curated plot check: expected one series labelled "${check.series_label}", found ${matches.length}. No unique alignment is possible.`, method: "rule", review_required: true };
  const { plot, series } = matches[0];
  const ids = [plot.id, series.id];
  const axisIssues: Judgment["issue_types"] = [];
  const axisNotes: string[] = [];
  if (check.expected_scale !== null && plot.y_axis.scale !== check.expected_scale) { axisIssues.push("scale"); axisNotes.push(`y-axis scale is ${plot.y_axis.scale}, expected ${check.expected_scale}`); }
  if (check.expected_unit !== null && unitCore(plot.y_axis.unit) !== unitCore(check.expected_unit)) { axisIssues.push("unit"); axisNotes.push(`y-axis unit is "${plot.y_axis.unit}", expected "${check.expected_unit}"`); }
  if (axisIssues.length) return { status: "contradicted", issue_types: axisIssues, matched_item_ids: ids, rationale: `Project-curated plot check (not author-confirmed): ${axisNotes.join("; ")}.`, method: "rule", review_required: true };
  if (series.points.length < 2) return { status: "uncertain", issue_types: [], matched_item_ids: ids, rationale: "Project-curated plot check: fewer than two sampled points, so threshold level and flatness cannot be assessed.", method: "rule", review_required: true };
  const basis = check.tolerance_basis?.trim();
  if (!basis) return { status: "uncertain", issue_types: [], matched_item_ids: ids, rationale: "Project-curated plot check: no independent tolerance basis was frozen with the check, so threshold recovery cannot be scored.", method: "rule", review_required: true };
  if (check.expected_y !== 0 && check.value_tolerance >= Math.abs(check.expected_y)) {
    return { status: "uncertain", issue_types: [], matched_item_ids: ids, rationale: `Project-curated plot check: value tolerance ${check.value_tolerance} is not smaller than the reference magnitude ${Math.abs(check.expected_y)}; zero and the expected level cannot be distinguished. A tolerance this wide cannot confirm retention.`, method: "rule", review_required: true };
  }
  const span = Math.abs(plot.y_axis.max - plot.y_axis.min);
  if (check.flatness_tolerance >= span) {
    return { status: "uncertain", issue_types: [], matched_item_ids: ids, rationale: `Project-curated plot check: flatness tolerance ${check.flatness_tolerance} covers the entire y-axis span ${span}; flatness cannot be distinguished from any series.`, method: "rule", review_required: true };
  }
  const values = series.points.map(point => point.y);
  const range = Math.max(...values) - Math.min(...values);
  const rangeAllowance = floatingPointAllowance(...values);
  const deviations = values.filter(value => Math.abs(value - check.expected_y) > check.value_tolerance + floatingPointAllowance(value, check.expected_y));
  const rationale = `Project-curated plot check (not author-confirmed): expected a flat "${check.series_label}" series near y=${check.expected_y} (value tolerance ${check.value_tolerance}, flatness tolerance ${check.flatness_tolerance}; basis: ${basis}); observed y range ${range} across ${values.length} sampled points.`;
  if (range > check.flatness_tolerance + rangeAllowance) return { status: "contradicted", issue_types: ["value"], matched_item_ids: ids, rationale, method: "rule", review_required: true };
  if (deviations.length === values.length) return { status: "contradicted", issue_types: ["value"], matched_item_ids: ids, rationale, method: "rule", review_required: true };
  if (deviations.length) return { status: "partial", issue_types: ["value"], matched_item_ids: ids, rationale, method: "rule", review_required: true };
  return { status: "retained", issue_types: [], matched_item_ids: ids, rationale, method: "rule", review_required: true };
}
