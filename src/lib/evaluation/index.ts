import type { EvaluationReport, Fact, IntentSet, Judgment, JudgeOutput, Keypoint, MemoryRecord, RenderAudit, RunSnapshot } from "../schemas";
import { auditScientific, judgeScientific } from "./scientific";

const norm = (v: string) => v.normalize("NFKC").toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, " ").replace(/[.,;:]$/g, "").trim();
const eq = (a: string, b: string) => norm(a) === norm(b);
export function factText(f: Pick<Fact, "subject" | "predicate" | "object" | "qualifiers">) {
  return `${f.subject} ${f.predicate} ${f.object}${f.qualifiers.length ? ` (${f.qualifiers.join("; ")})` : ""}`;
}
export function memoryItemIds(memory: MemoryRecord): Set<string> {
  return new Set([...memory.graph.nodes, ...memory.graph.relations, ...memory.graph.groups, ...memory.graph.conditions, ...memory.facts, ...memory.plots, ...memory.plots.flatMap(p => p.series), ...memory.uncertainties].map(x => x.id));
}
export function uncertain(reason: string): Judgment {
  return { status: "uncertain", issue_types: [], matched_item_ids: [], rationale: reason, method: "rule", review_required: true };
}
function compareFact(claim: NonNullable<Keypoint["claim"]>, fact: Fact): Judgment {
  const issues: Judgment["issue_types"] = [];
  if (!eq(claim.predicate, fact.predicate)) issues.push("relation_type");
  if (!eq(claim.object, fact.object)) issues.push(/\d/.test(claim.object + fact.object) ? "value" : "identity");
  if (claim.certainty !== null && claim.certainty !== fact.certainty) issues.push("evidence_status");
  const missing = claim.qualifiers.filter(q => !fact.qualifiers.some(f => eq(q, f)));
  if (missing.length) issues.push("condition");
  const contradicted = issues.some(i => i !== "condition");
  return {
    status: !issues.length ? "retained" : contradicted ? "contradicted" : "partial",
    issue_types: issues, matched_item_ids: [fact.id],
    rationale: !issues.length ? `Recovered: ${factText(fact)}.` : `Extracted: ${factText(fact)}. ${missing.length ? `Required qualifier not recovered: ${missing.join("; ")}.` : "The extracted assertion differs from the author statement."}`,
    method: "rule", review_required: issues.includes("identity"),
  };
}
export function judgeByRules(keypoint: Keypoint, memory: MemoryRecord): Judgment {
  if (keypoint.scientific) return judgeScientific(keypoint.scientific, memory);
  if (!keypoint.author_confirmed) return uncertain("The author has not confirmed this keypoint.");
  if (memory.completeness !== "complete") return uncertain("Extraction was not complete; omission cannot be inferred.");
  const claim = keypoint.claim;
  if (!claim) {
    const exact = memory.facts.filter(f => eq(factText(f), keypoint.text));
    if (exact.length === 1) return { status: "retained", issue_types: [], matched_item_ids: [exact[0].id], rationale: `Exact extracted assertion: ${factText(exact[0])}.`, method: "rule", review_required: false };
    return uncertain("Free-text intent needs semantic review; no exact assertion match was established.");
  }
  const sameSubject = memory.facts.filter(f => eq(f.subject, claim.subject));
  const oppositePairs: Record<string, string> = { inhibits: "promotes", promotes: "inhibits" };
  const opposite = oppositePairs[norm(claim.predicate)];
  const contrary = sameSubject.filter(f => opposite && eq(f.predicate, opposite) && eq(f.object, claim.object));
  const samePredicate = sameSubject.filter(f => eq(f.predicate, claim.predicate));
  const candidates = samePredicate.filter(f => eq(f.object, claim.object));
  if (candidates.length && contrary.length) return uncertain("The extraction contains mutually opposed relations for the same entities.");
  if (contrary.length) return { status: "contradicted", issue_types: ["relation_type"], matched_item_ids: contrary.map(f => f.id), rationale: `An explicitly opposite relation was recovered: ${factText(contrary[0])}.`, method: "rule", review_required: false };
  if (!candidates.length) {
    const reverse = memory.facts.find(f => eq(f.subject, claim.object) && eq(f.object, claim.subject) && eq(f.predicate, claim.predicate));
    if (reverse && ["promotes", "inhibits", "flows_to"].includes(norm(claim.predicate))) return { status: "contradicted", issue_types: ["direction"], matched_item_ids: [reverse.id], rationale: `The extracted directed relation reverses subject and object: ${factText(reverse)}.`, method: "rule", review_required: false };
    if (reverse || samePredicate.length) return uncertain("A related assertion uses a different object or orientation; equivalence or contradiction needs semantic review.");
    return { status: "omitted", issue_types: [], matched_item_ids: [], rationale: "No matching explicit fact was recovered. This does not establish that the original image lacks it.", method: "rule", review_required: true };
  }
  const results = candidates.map(f => compareFact(claim, f));
  const exact = results.filter(r => r.status === "retained");
  if (exact.length && results.some(r => r.status === "contradicted")) return uncertain("The memory contains conflicting assertions for this author statement.");
  if (exact.length) return exact[0];
  if (results.length > 1) return uncertain("Multiple incompatible candidate facts require semantic alignment.");
  return results[0];
}
function auditedJudgment(value: Judgment, memory: MemoryRecord, keypoint: Keypoint): Judgment {
  if (!keypoint.author_confirmed || memory.completeness !== "complete") return uncertain("Author confirmation and complete extraction are required.");
  const ids = memoryItemIds(memory);
  if (value.matched_item_ids.some(id => !ids.has(id))) return uncertain("Semantic judge returned an invalid evidence reference; the judgment was rejected.");
  if (["retained", "partial", "contradicted"].includes(value.status) && !value.matched_item_ids.length) return uncertain("Semantic judge supplied no traceable extracted evidence.");
  return { ...value, method: "semantic_assist", review_required: true };
}
function resolveJudgment(keypoint: Keypoint, memory: MemoryRecord, semantic?: Judgment): Judgment {
  const rule = judgeByRules(keypoint, memory);
  if (!semantic) return rule;
  // A project-curated scientific check is deterministic. The semantic judge may
  // describe the same evidence, but it must never turn a rule contradiction into
  // a retained result or a rule uncertainty into a confirmed one.
  if (keypoint.scientific) {
    if (semantic.status === rule.status) return rule;
    return { ...rule, rationale: `${rule.rationale} The semantic judge reported ${semantic.status}, but that suggestion was not used because the deterministic project-curated check takes precedence.` };
  }
  const audited = auditedJudgment(semantic, memory, keypoint);
  // Exact extracted contradictions are also deterministic constraints. A
  // paraphrase may resolve an omitted or uncertain rule result, but it may not
  // silently erase an explicit opposite assertion.
  if (rule.status === "contradicted" && audited.status === "retained") {
    return { ...rule, rationale: `${rule.rationale} The semantic judge reported retained, but an explicit contradictory extracted assertion takes precedence.` };
  }
  return audited;
}
function stageOf(a: Judgment, b: Judgment, changedAgain: boolean): EvaluationReport["keypoint_results"][number]["observed_stage"] {
  if (a.status === "uncertain" || b.status === "uncertain") return "unresolved";
  if (a.status === "retained" && b.status === "retained") return "none";
  if (a.status === "retained") return "round_trip";
  if (b.status === "retained") return "first_read";
  return changedAgain ? "both" : "first_read";
}
export function evaluate(input: { intents: IntentSet; a: MemoryRecord; b: MemoryRecord; render: RenderAudit; semantic?: JudgeOutput }): EvaluationReport {
  const { intents, a, b, render, semantic } = input;
  const judgeRows = new Map<string, JudgeOutput["results"][number]>();
  if (semantic) {
    const validKeys = new Set(intents.keypoints.map(k => k.id));
    if (semantic.results.length !== intents.keypoints.length || new Set(semantic.results.map(r => r.keypoint_id)).size !== semantic.results.length || semantic.results.some(r => !validKeys.has(r.keypoint_id))) throw new Error("Semantic output must cover each keypoint exactly once.");
    semantic.results.forEach(r => judgeRows.set(r.keypoint_id, r));
  }
  const aToB = a.facts.map(f => {
    const j = judgeByRules({ id: f.id, text: factText(f), claim: { subject: f.subject, predicate: f.predicate, object: f.object, qualifiers: f.qualifiers, certainty: f.certainty }, author_confirmed: true }, b);
    return { a_item_id: f.id, b_item_ids: j.matched_item_ids, status: j.status, rationale: j.rationale };
  });
  const keypointResults = intents.keypoints.map(k => {
    const s = judgeRows.get(k.id);
    const ja = resolveJudgment(k, a, s?.in_a);
    const jb = resolveJudgment(k, b, s?.in_b);
    const changedAgain = ja.matched_item_ids.some(id => aToB.some(r => r.a_item_id === id && r.status !== "retained" && r.status !== "uncertain"));
    const represented = ja.matched_item_ids.length > 0 && ja.matched_item_ids.every(id => render.rendered_item_ids.includes(id));
    const missing = ja.matched_item_ids.some(id => render.unsupported_item_ids.includes(id));
    const hasFactAlignment = ja.matched_item_ids.some(id => aToB.some(r => r.a_item_id === id && r.status !== "uncertain"));
    const observedStage = ja.status !== "retained" && jb.status !== "retained" && !hasFactAlignment ? "unresolved" : stageOf(ja, jb, changedAgain);
    const suggestions: string[] = [];
    if (observedStage === "first_read" || observedStage === "both") suggestions.push("Inspect the original labels, relation symbols, axis units and nearby qualifiers. Any proposed cause remains a hypothesis.");
    if (observedStage === "round_trip" || observedStage === "both") suggestions.push(missing ? "A remembered item was not fully rendered. Resolve the reconstruction gap before drawing conclusions about the original." : "Inspect the reconstruction and B's extracted evidence. The difference alone does not identify its cause.");
    if (observedStage === "unresolved") suggestions.push("Clarify the keypoint or review the evidence manually; the current result is inconclusive.");
    return { keypoint_id: k.id, text: k.text, in_a: ja, in_b: jb, observed_stage: observedStage, recovery_in_b: ja.status !== "retained" && jb.status === "retained", render_item_status: missing ? "unsupported" as const : represented ? "represented" as const : "unknown" as const, suggestions };
  });
  const unmatched = b.facts.filter(f => !a.facts.some(g => eq(f.subject, g.subject) && eq(f.predicate, g.predicate) && eq(f.object, g.object) && f.certainty === g.certainty && f.qualifiers.length === g.qualifiers.length && f.qualifiers.every(q => g.qualifiers.some(t => eq(q, t))))).map(f => ({ id: f.id, text: factText(f), review_required: true }));
  const scientific = auditScientific(a, b);
  return {
    keypoint_results: keypointResults, a_to_b: aToB, unmatched_b_claims: unmatched,
    summary: { retained_a: keypointResults.filter(r => r.in_a.status === "retained").length, retained_b: keypointResults.filter(r => r.in_b.status === "retained").length, total: intents.keypoints.length, unresolved: keypointResults.filter(r => r.in_a.status === "uncertain" || r.in_b.status === "uncertain").length, renderer_warnings: render.warnings.length },
    limitations: ["AI reader feedback does not establish human readability or scientific correctness.", "Independent requests to the same model do not imply independent errors.", "Unmatched B assertions are candidates for review, not proven hallucinations.", "Plot reconstruction is approximate, not precision digitization.", ...(scientific.coverage.fact_comparison.executed ? [] : ["Fact-by-fact assertion comparison was not executed; see detection coverage for what was and was not checked."]), ...(semantic ? ["Semantic judgments require review of their cited extracted items."] : ["Rules only: free-text or synonymous assertions may remain uncertain."]), ...(semantic && intents.keypoints.some(k => k.scientific) ? ["Project-curated scientific checks are deterministic and are not overridden by semantic-judge results."] : []), ...(render.visual_review !== "passed" ? ["This reconstruction has not received an independent visual-review pass."] : [])],
    coverage: scientific.coverage,
    scientific_findings: scientific.findings,
  };
}
export function compareRuns(left: RunSnapshot, right: RunSnapshot) {
  const differences: string[] = [];
  if (left.status !== "completed" || right.status !== "completed") differences.push("Both runs must be completed.");
  if (left.intent_digest !== right.intent_digest) differences.push("Author keypoints differ.");
  if (left.settings_digest !== right.settings_digest) differences.push("Model, prompts, renderer or evaluation settings differ.");
  if (left.mode !== right.mode) differences.push("Live and scripted runs are not comparable.");
  return { comparable: !differences.length, differences, rows: left.keypoints.map(k => ({ id: k.id, text: k.text, left: left.report?.keypoint_results.find(r => r.keypoint_id === k.id)?.in_b.status ?? "uncertain", right: right.report?.keypoint_results.find(r => r.keypoint_id === k.id)?.in_b.status ?? "uncertain" })), note: "Paired observations under recorded settings; this is not evidence of universal improvement." };
}
