import type { EvaluationCoverage, EvaluationReport, MemoryRecord, RenderAudit, ScientificFinding, Keypoint } from "../schemas";

export interface CaseSummary {
  id: string; title: string; domain: string; status: "completed" | "failed";
  takeaway: string; original: string; reconstruction: string | null; record: string;
  source_run_id: string; paper_url: string; attribution: string; license: string;
}
export interface CaseIndex {
  version: string; selection: string;
  protocol: { completed: number; failed: number; total: number; model: string; prompt_version: string; rows: { example_id: string; attempt: number; run_id: string; status: string }[] };
  cases: CaseSummary[];
}
export interface PublicCase extends CaseSummary {
  provenance: { kind: "recorded_local_model_run"; created_at: string; model: string; prompt_version: string; source_manifest_sha256: string; note: string };
  keypoints: (Omit<Keypoint, "author_confirmed"> & { confirmation_provenance: "protocol_marked_not_independently_confirmed" })[]; a: MemoryRecord | null; b: MemoryRecord | null;
  report: EvaluationReport | null; render_audit: RenderAudit | null;
  error: { code: string; stage: string | null; message: string } | null;
  offline_audit: { note: string; coverage: EvaluationCoverage; findings: ScientificFinding[] } | null;
}
