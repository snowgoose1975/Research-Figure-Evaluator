import { z } from "zod";

export const SCHEMA_VERSION = "0.2.0" as const;
export const PROMPT_VERSION = "reader-0.2.2";
export const LIMITS = { imageBytes: 10 * 1024 * 1024, imagePixels: 25_000_000, nodes: 96, relations: 160, facts: 80 };
export const DomainSchema = z.enum(["physics", "materials", "mathematics", "other"]);
export const FigureTypeSchema = z.enum(["mechanism", "structure", "plot", "geometry", "mixed"]);
export const CertaintySchema = z.enum(["asserted", "hypothesized", "not_shown", "unknown"]);
export const RelationKindSchema = z.enum(["promotes", "inhibits", "flows_to", "associated_with", "contains", "adjacent_to", "equals", "unknown"]);
export const BboxSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0).max(1), height: z.number().min(0).max(1) }).strict();
export const PositionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const NodeSchema = z.object({ id: z.string().min(1), label: z.string().min(1), aliases: z.array(z.string()), group_id: z.string().nullable(), semantic_position: PositionSchema.nullable() }).strict();
export const RelationSchema = z.object({ id: z.string().min(1), source_id: z.string(), target_id: z.string(), kind: RelationKindSchema, direction: z.enum(["directed", "undirected", "unknown"]), line_style: z.enum(["solid", "dashed", "unknown"]), evidence_status: CertaintySchema, label: z.string() }).strict();
export const GroupSchema = z.object({ id: z.string(), label: z.string() }).strict();
export const ConditionSchema = z.object({ id: z.string(), text: z.string(), scope: z.enum(["graph", "node", "relation", "group", "fact", "plot"]), target_ids: z.array(z.string()) }).strict();
export const FactSchema = z.object({ id: z.string().min(1), subject: z.string().min(1), predicate: z.string().min(1), object: z.string(), qualifiers: z.array(z.string()), certainty: CertaintySchema, source_ids: z.array(z.string()) }).strict();
export const AxisSchema = z.object({ label: z.string(), unit: z.string(), scale: z.enum(["linear", "log", "unknown"]), min: z.number(), max: z.number() }).strict();
export const SeriesSchema = z.object({ id: z.string(), label: z.string(), points: z.array(z.object({ x: z.number(), y: z.number() }).strict()).max(96), style: z.enum(["line", "scatter", "dashed"]), approximate: z.boolean() }).strict();
export const PlotSchema = z.object({ id: z.string(), title: z.string(), x_axis: AxisSchema, y_axis: AxisSchema, series: z.array(SeriesSchema).max(6), notes: z.array(z.string()) }).strict();
export const GraphSchema = z.object({ nodes: z.array(NodeSchema).max(LIMITS.nodes), relations: z.array(RelationSchema).max(LIMITS.relations), groups: z.array(GroupSchema), conditions: z.array(ConditionSchema) }).strict();
export const MemoryOutputSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION), title: z.string(), domain: DomainSchema, figure_type: FigureTypeSchema, summary: z.string(),
  graph: GraphSchema, plots: z.array(PlotSchema).max(4), facts: z.array(FactSchema).max(LIMITS.facts),
  uncertainties: z.array(z.object({ id: z.string(), item_ids: z.array(z.string()), note: z.string() }).strict()),
  evidence: z.array(z.object({ item_id: z.string(), image_bbox: BboxSchema.nullable(), visible_text: z.string().nullable(), note: z.string() }).strict()),
  completeness: z.enum(["complete", "capacity_exceeded", "unsupported"]),
}).strict();
export const MemorySchema = MemoryOutputSchema.superRefine((m, ctx) => {
  const add = (message: string) => ctx.addIssue({ code: "custom", message });
  const all = [...m.graph.nodes, ...m.graph.relations, ...m.graph.groups, ...m.graph.conditions, ...m.facts, ...m.plots, ...m.plots.flatMap(p => p.series), ...m.uncertainties];
  const ids = new Set(all.map(i => i.id));
  if (ids.size !== all.length) add("Item IDs must be globally unique within a memory record.");
  const nodes = new Set(m.graph.nodes.map(n => n.id));
  const groups = new Set(m.graph.groups.map(g => g.id));
  for (const n of m.graph.nodes) if (n.group_id !== null && !groups.has(n.group_id)) add(`Unknown group on ${n.id}`);
  for (const r of m.graph.relations) if (!nodes.has(r.source_id) || !nodes.has(r.target_id)) add(`Dangling relation ${r.id}`);
  for (const c of m.graph.conditions) for (const id of c.target_ids) if (!ids.has(id)) add(`Unknown condition target ${id}`);
  for (const f of m.facts) for (const id of f.source_ids) if (!ids.has(id)) add(`Unknown fact source ${id}`);
  for (const e of m.evidence) {
    if (!ids.has(e.item_id)) add(`Unknown evidence target ${e.item_id}`);
    if (e.image_bbox && (e.image_bbox.x + e.image_bbox.width > 1.001 || e.image_bbox.y + e.image_bbox.height > 1.001)) add("Evidence bbox exceeds image.");
  }
  for (const p of m.plots) for (const axis of [p.x_axis, p.y_axis]) {
    if (!(axis.max > axis.min)) add(`Invalid axis range in ${p.id}`);
    if (axis.scale === "log" && axis.min <= 0) add(`Log axis must be positive in ${p.id}`);
  }
  if (m.completeness === "complete" && !m.graph.nodes.length && !m.plots.length && !m.facts.length) add("A complete record cannot be empty.");
});
export type MemoryRecord = z.infer<typeof MemoryOutputSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type Plot = z.infer<typeof PlotSchema>;
export type Domain = z.infer<typeof DomainSchema>;

export const ClaimSchema = z.object({ subject: z.string(), predicate: z.string(), object: z.string(), qualifiers: z.array(z.string()), certainty: CertaintySchema.nullable() }).strict();
export const ScientificCheckSchema = z.object({
  kind: z.literal("plot_reference_line"),
  series_label: z.string().min(1).max(200),
  expected_y: z.number(),
  value_tolerance: z.number().nonnegative(),
  flatness_tolerance: z.number().nonnegative(),
  expected_unit: z.string().max(80).nullable(),
  expected_scale: z.enum(["linear", "log", "unknown"]).nullable(),
  tolerance_basis: z.string().min(1).max(400).optional(),
  source: z.literal("project_curated"),
}).strict();
export type ScientificCheck = z.infer<typeof ScientificCheckSchema>;
export const KeypointSchema = z.object({ id: z.string(), text: z.string().min(3).max(1200), claim: ClaimSchema.nullable(), author_confirmed: z.boolean(), scientific: ScientificCheckSchema.nullable().optional() }).strict();
export const IntentSetSchema = z.object({ keypoints: z.array(KeypointSchema).min(3).max(5) }).strict().superRefine((v, ctx) => {
  if (new Set(v.keypoints.map(k => k.id)).size !== v.keypoints.length) ctx.addIssue({ code: "custom", message: "Keypoint IDs must be unique." });
});
export type Keypoint = z.infer<typeof KeypointSchema>;
export type IntentSet = z.infer<typeof IntentSetSchema>;

export const JudgmentSchema = z.object({ status: z.enum(["retained", "partial", "omitted", "contradicted", "uncertain"]), issue_types: z.array(z.enum(["identity", "direction", "relation_type", "condition", "scope", "evidence_status", "value", "unit", "scale", "geometry"])), matched_item_ids: z.array(z.string()), rationale: z.string(), method: z.enum(["rule", "semantic_assist", "manual"]), review_required: z.boolean() }).strict();
export type Judgment = z.infer<typeof JudgmentSchema>;
export const JudgeOutputSchema = z.object({ results: z.array(z.object({ keypoint_id: z.string(), in_a: JudgmentSchema, in_b: JudgmentSchema }).strict()) }).strict();
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
export interface RenderInput { title: string; domain: Domain; figure_type: MemoryRecord["figure_type"]; summary: string; graph: MemoryRecord["graph"]; plots: MemoryRecord["plots"]; facts: MemoryRecord["facts"]; uncertainties: MemoryRecord["uncertainties"] }
export interface RenderResult { svg: string; png: Buffer; width: number; height: number; rendered_item_ids: string[]; unsupported_item_ids: string[]; warnings: string[]; structural_audit: "complete" | "incomplete" | "failed"; visual_review: "not_reviewed" | "passed" | "failed"; renderer_version: string }
export type RenderAudit = Omit<RenderResult, "svg" | "png">;
export interface ReaderImageInput { base64: string; mime: "image/png" | "image/jpeg" }
export interface ModelConfig { apiKey: string; baseUrl: string; model: string; protocol: "responses" | "chat"; timeoutMs: number; maxOutputTokens: number }
export type ModelAttemptOutcome = "success" | "failure";
export type ModelAttemptValidation = "schema_passed" | "schema_failed" | "semantic_passed" | "semantic_failed" | "not_run";
export interface ModelAttemptAudit {
  index: number;
  phase: "initial" | "repair";
  stage: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  request_id: string | null;
  model: string | null;
  usage: Record<string, number> | null;
  finish_reason: string | null;
  http_status: number | null;
  outcome: ModelAttemptOutcome;
  validation: ModelAttemptValidation;
  error_code: string | null;
}
export interface ModelCallMeta { request_id: string | null; model: string; latency_ms: number; usage: Record<string, number> | null; attempts: number; prompt_version: string; repairs?: number; attempts_detail?: ModelAttemptAudit[]; usage_complete?: boolean }
export interface ModelResult<T> { value: T; meta: ModelCallMeta }
export interface ConfigSnapshot { model: string; protocol: "responses" | "chat"; timeout_ms: number; max_output_tokens: number; base_url_host: string; model_digest: string | null; num_ctx: number | null }
export interface JudgeInput { keypoints: Keypoint[]; a: MemoryRecord; b: MemoryRecord }
export const DirectOutputSchema = z.object({ results: z.array(z.object({ keypoint_id: z.string(), judgment: JudgmentSchema }).strict()) }).strict();
export type DirectOutput = z.infer<typeof DirectOutputSchema>;
export interface DirectCheckInput { image: ReaderImageInput; keypoints: Keypoint[] }
export interface EvaluationCoverage {
  fact_comparison: { executed: boolean; a_facts: number; b_facts: number; reason: string | null };
  relation_audit: { executed: boolean; reason: string | null };
  condition_audit: { executed: boolean; reason: string | null };
  plot_audit: { executed: boolean; axis_executed?: boolean; series_executed?: boolean; a_plots: number; b_plots: number; matched_plots?: number; matched_series: number; unmatched_a_plots?: string[]; unmatched_a_series: string[]; unmatched_b_plots?: string[]; unmatched_b_series?: string[]; reason: string | null };
  unchecked: string[];
  note: string;
}
export type ScientificFindingCategory = "relation_direction" | "condition_loss" | "value_change" | "threshold_value" | "axis_unit_scale" | "series_shape_change";
export interface ScientificFinding {
  id: string;
  category: ScientificFindingCategory;
  status: "confirmed" | "uncertain";
  summary: string;
  a_item_ids: string[];
  b_item_ids: string[];
  review_required: boolean;
}
export interface EvaluationReport {
  keypoint_results: { keypoint_id: string; text: string; in_a: Judgment; in_b: Judgment; observed_stage: "first_read" | "round_trip" | "both" | "none" | "unresolved"; recovery_in_b: boolean; render_item_status: "represented" | "unsupported" | "unknown"; suggestions: string[] }[];
  a_to_b: { a_item_id: string; b_item_ids: string[]; status: Judgment["status"]; rationale: string }[];
  unmatched_b_claims: { id: string; text: string; review_required: boolean }[];
  summary: { retained_a: number; retained_b: number; total: number; unresolved: number; renderer_warnings: number };
  limitations: string[];
  coverage?: EvaluationCoverage;
  scientific_findings?: ScientificFinding[];
}
export interface ExampleDefinition { id: string; title: string; domain: Domain; figure_type: MemoryRecord["figure_type"]; description: string; split: "dev" | "holdout"; keypoints: Keypoint[]; versions: { id: "clear" | "challenged"; label: string; image_url: string; change: string }[]; gold: MemoryRecord; demo_a: MemoryRecord; demo_b: MemoryRecord; source: string; license: string }
export interface ExampleSummary { id: string; title: string; domain: Domain; figure_type: MemoryRecord["figure_type"]; description: string; split: "dev" | "holdout"; keypoints: Keypoint[]; versions: ExampleDefinition["versions"]; source: string; license: string; origin?: "teaching" | "published"; supports_demo?: boolean; paper_url?: string; figure_label?: string; attribution?: string }
export type RunStatus = "queued" | "reading_a" | "reconstructing" | "reading_b" | "evaluating" | "completed" | "failed" | "interrupted";
export interface StageRecord { stage: string; at: string; input_digests: string[]; meta: ModelCallMeta | null }
export interface RunSnapshot {
  id: string; created_at: string; completed_at: string | null; mode: "live" | "mock"; status: RunStatus;
  example_id: string | null; example_version: string | null; parent_run_id: string | null;
  input_digest: string; intent_digest: string; settings_digest: string;
  model: string; protocol: string; schema_version: string; prompt_version: string; engine_version: string;
  keypoints: Keypoint[]; a: MemoryRecord | null; b: MemoryRecord | null; report: EvaluationReport | null;
  render_audit: RenderAudit | null; stages: StageRecord[]; assets: Record<string, string>;
  config_snapshot?: ConfigSnapshot | null;
  baseline: { result: DirectOutput | null; meta: ModelCallMeta | null; error: string | null } | null;
  error: { code: string; message: string; stage: string } | null;
}
export interface ServiceStatus { configured: boolean; model: string | null; protocol: "responses" | "chat"; base_url_host: string; active_run_id: string | null; limits: typeof LIMITS }
export const RunRequestSchema = z.object({ mode: z.enum(["live", "mock"]), intents: IntentSetSchema, example_id: z.string().nullable(), example_version: z.enum(["clear", "challenged"]).nullable(), parent_run_id: z.string().nullable(), include_baseline: z.boolean() }).strict();
export type RunRequest = z.infer<typeof RunRequestSchema>;
