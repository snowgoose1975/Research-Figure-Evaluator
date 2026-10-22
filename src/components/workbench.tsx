"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { ExampleSummary, EvaluationReport, Keypoint, MemoryRecord, RunRequest, RunSnapshot, ServiceStatus, StageRecord } from "@/lib/schemas";
import { buildReviewQueue } from "@/lib/evaluation/review";

const labels: Record<string, string> = { physics: "Physics", materials: "Materials", mathematics: "Mathematics", other: "Other", mechanism: "Mechanism", structure: "Structure", plot: "Analysis plot", geometry: "Geometry", mixed: "Mixed" };
const emptyStatus: ServiceStatus = { configured: false, model: null, protocol: "responses", base_url_host: "not configured", active_run_id: null, limits: { imageBytes: 10485760, imagePixels: 25000000, nodes: 96, relations: 160, facts: 80 } };
const steps = ["reading_a", "reconstructing", "reading_b", "evaluating"];

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = { spark: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1", image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M8 9h.01", arrow: "M5 12h14m-6-6 6 6-6 6", book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22zM4 5.5V19a3 3 0 0 1 3-3h13", clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", download: "M12 3v12m-5-5 5 5 5-5M5 21h14" };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.spark} /></svg>;
}
function asMessage(data: unknown, fallback: string) { return typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : fallback; }
function makeId() { return `kp-${Math.random().toString(36).slice(2, 9)}`; }
function isPublished(example: ExampleSummary | null | undefined) { return example?.origin === "published" || example?.supports_demo === false; }
function usageTokens(usage: Record<string, number> | null) {
  if (!usage) return null;
  if (typeof usage.total_tokens === "number") return usage.total_tokens;
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  return typeof input === "number" || typeof output === "number" ? (input || 0) + (output || 0) : null;
}
function stageUsageText(stage: StageRecord, mode: RunSnapshot["mode"], legacy: boolean) {
  if (!stage.meta) {
    if (mode === "mock") return "No model request (scripted)";
    if (stage.stage === "reconstructing") return "No model request";
    return legacy ? "Audit unavailable (legacy run)" : "No request recorded";
  }
  const parts = [stage.meta.latency_ms + " ms", (usageTokens(stage.meta.usage) ?? "usage n/a") + " tokens", `${stage.meta.attempts} request${stage.meta.attempts === 1 ? "" : "s"}`];
  if (stage.meta.usage_complete === false) parts.push("usage partial");
  if (!stage.meta.attempts_detail) parts.push("legacy audit");
  return parts.join(" · ");
}

export default function Workbench() {
  const [status, setStatus] = useState<ServiceStatus>(emptyStatus);
  const [examples, setExamples] = useState<ExampleSummary[]>([]);
  const [runs, setRuns] = useState<RunSnapshot[]>([]);
  const [selectedExample, setSelectedExample] = useState("");
  const [version, setVersion] = useState<"clear" | "challenged">("clear");
  const [originFilter, setOriginFilter] = useState<"published" | "teaching">("published");
  const [domain, setDomain] = useState("all");
  const [kind, setKind] = useState("all");
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [current, setCurrent] = useState<RunSnapshot | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [pageError, setPageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({ a: true, b: true });
  const [comparison, setComparison] = useState<{ comparable: boolean; differences: string[]; rows: { id: string; text: string; left: string; right: string }[]; note: string } | null>(null);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [historyLimit, setHistoryLimit] = useState(10);
  const [openRunId, setOpenRunId] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [includeBaseline, setIncludeBaseline] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);

  const refresh = useCallback(async () => {
    const [s, e, r] = await Promise.allSettled([fetch("/api/status", { cache: "no-store" }), fetch("/api/examples", { cache: "no-store" }), fetch("/api/runs", { cache: "no-store" })]);
    if (s.status === "fulfilled" && s.value.ok) setStatus(await s.value.json());
    if (e.status === "fulfilled" && e.value.ok) { const data = await e.value.json(); setExamples(data.examples || []); }
    if (r.status === "fulfilled" && r.value.ok) { const data = await r.value.json(); setRuns(data.runs || []); }
    if ([s, e, r].some(x => x.status === "rejected")) setServiceError("The local API is not reachable yet. Start the app server to load examples and service status.");
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadInitialData = async () => {
      const [s, e, r] = await Promise.allSettled([fetch("/api/status", { cache: "no-store" }), fetch("/api/examples", { cache: "no-store" }), fetch("/api/runs", { cache: "no-store" })]);
      if (cancelled) return;
      if (s.status === "fulfilled" && s.value.ok) setStatus(await s.value.json());
      if (e.status === "fulfilled" && e.value.ok) { const data = await e.value.json(); if (!cancelled) setExamples(data.examples || []); }
      if (r.status === "fulfilled" && r.value.ok) { const data = await r.value.json(); if (!cancelled) setRuns(data.runs || []); }
      if (!cancelled && [s, e, r].some(x => x.status === "rejected")) setServiceError("The local API is not reachable yet. Start the app server to load examples and service status.");
    };
    void loadInitialData();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!current || !["queued", ...steps].includes(current.status)) return; const timer = window.setInterval(async () => { try { const response = await fetch(`/api/runs/${current.id}`, { cache: "no-store" }); if (response.ok) { const data: RunSnapshot = await response.json(); setCurrent(data); if (data.status === "completed" || data.status === "failed" || data.status === "interrupted") { void refresh(); setBusy(false); } } } catch { /* retain the last visible state */ } }, 1400); return () => window.clearInterval(timer); }, [current, refresh]);
  useEffect(() => {
    if (!current || !["completed", "failed", "interrupted"].includes(current.status)) return;
    const timer = window.setTimeout(() => document.getElementById("workbench-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => window.clearTimeout(timer);
  }, [current]);
  useEffect(() => () => { if (uploadUrl) URL.revokeObjectURL(uploadUrl); }, [uploadUrl]);

  const publishedCount = useMemo(() => examples.filter(isPublished).length, [examples]);
  const teachingCount = examples.length - publishedCount;
  const visibleExamples = useMemo(() => examples.filter(e => (originFilter === "published" ? (publishedCount === 0 || isPublished(e)) : !isPublished(e)) && (domain === "all" || e.domain === domain) && (kind === "all" || e.figure_type === kind)), [examples, domain, kind, originFilter, publishedCount]);
  const filteredRuns = useMemo(() => {
    const query = historyFilter.trim().toLowerCase();
    if (!query) return runs;
    return runs.filter(run => [run.id, run.example_id || "uploaded figure", run.mode, run.status].some(value => value.toLowerCase().includes(query)));
  }, [runs, historyFilter]);
  const selected = examples.find(e => e.id === selectedExample) || null;
  const selectedVersion = selected?.versions.find(v => v.id === version) || selected?.versions[0];
  const activeImage = uploadUrl || selectedVersion?.image_url || "";
  const canUseMock = !!selected && !upload && !isPublished(selected) && selected.supports_demo !== false;
  const running = current && ["queued", ...steps].includes(current.status);

  function chooseExample(id: string) { const example = examples.find(e => e.id === id); setSelectedExample(id); setUpload(null); setUploadUrl(""); setVersion(example?.versions[0]?.id || "clear"); setKeypoints(example?.keypoints.map(k => ({ ...k, author_confirmed: false })) || []); if (isPublished(example)) { setMode("live"); setIncludeBaseline(false); } setCurrent(null); setPageError(""); }
  function changeUpload(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (!/image\/(png|jpeg)/.test(file.type)) { setPageError("Choose a PNG or JPEG image."); return; } if (file.size > 10 * 1024 * 1024) { setPageError("Image exceeds the 10 MB upload limit."); return; } if (uploadUrl) URL.revokeObjectURL(uploadUrl); setUpload(file); setUploadUrl(URL.createObjectURL(file)); setSelectedExample(""); setMode("live"); setIncludeBaseline(false); setKeypoints([]); setPageError(""); }
  function editKeypoint(id: string, text: string) { setKeypoints(current => current.map(k => k.id === id ? { ...k, text, claim: null, author_confirmed: false } : k)); }
  function addKeypoint() { if (keypoints.length < 5) setKeypoints([...keypoints, { id: makeId(), text: "", claim: null, author_confirmed: false }]); }
  async function startRun(event: FormEvent) {
    event.preventDefault(); setPageError("");
    if (mode === "mock" && !canUseMock) { setPageError("Scripted demo is only available for teaching examples; published research figures and uploads require Live mode."); return; }
    if (mode === "live" && !status.configured) { setPageError("Live mode is unavailable because the model service is not configured. Published figures and uploads require a configured live model service."); return; }
    if (!activeImage) { setPageError("Select an example version or upload a PNG/JPEG image."); return; }
    if (keypoints.length < 3 || keypoints.length > 5 || keypoints.some(k => k.text.trim().length < 3)) { setPageError("Add 3–5 complete atomic keypoints before running."); return; }
    if (keypoints.some(k => !k.author_confirmed)) { setPageError("Confirm each author keypoint before running."); return; }
    setBusy(true); setComparison(null);
    const request: RunRequest = { mode, intents: { keypoints }, example_id: selected?.id || null, example_version: selected ? selectedVersion?.id || null : null, parent_run_id: null, include_baseline: mode === "live" && includeBaseline };
    try { const form = new FormData(); form.append("request", JSON.stringify(request)); if (upload) form.append("image", upload); const response = await fetch("/api/runs", { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(asMessage(data, "Could not start run.")); setCurrent(data as RunSnapshot); setHistoryOpen(false); window.history.replaceState(null, "", window.location.pathname); }
    catch (error) { setPageError(error instanceof Error ? error.message : "Could not start run."); setBusy(false); }
  }
  const loadRun = useCallback(async (id: string) => {
    const runId = id.trim();
    setPageError(""); setHistoryMessage(""); setComparison(null);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(runId)) {
      setHistoryMessage("Enter a valid run ID (letters, digits, dash or underscore).");
      setHistoryOpen(true);
      return;
    }
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      if (response.status === 404) throw new Error(`Run ${runId} was not found. Check the ID; it may belong to another workspace.`);
      if (!response.ok) throw new Error("Could not load this saved run.");
      const data: RunSnapshot = await response.json();
      setCurrent(data);
      setHistoryOpen(false);
      window.history.replaceState(null, "", `?run=${encodeURIComponent(runId)}`);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "Could not load run.");
      setHistoryOpen(true);
    }
  }, []);
  useEffect(() => {
    const linkedRun = new URLSearchParams(window.location.search).get("run");
    if (!linkedRun) return;
    const timer = window.setTimeout(() => { void loadRun(linkedRun); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRun]);
  async function compareRuns() { setComparison(null); try { const response = await fetch("/api/comparisons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ left_id: compareLeft, right_id: compareRight }) }); const data = await response.json(); if (!response.ok) throw new Error(asMessage(data, "Comparison failed.")); setComparison(data); } catch (error) { setPageError(error instanceof Error ? error.message : "Comparison failed."); } }
  async function downloadReport(format: "json" | "markdown") { if (!current) return; try { const response = await fetch(`/api/runs/${current.id}/report?format=${format}`); if (!response.ok) throw new Error("Report export is unavailable for this run."); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `figure-relay-${current.id}.${format === "json" ? "json" : "md"}`; a.click(); URL.revokeObjectURL(url); } catch (error) { setPageError(error instanceof Error ? error.message : "Report export failed."); } }

  return <main className="app-shell workbench">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Icon name="spark" /></div><div><strong>Figure Relay</strong><small>RESEARCH EVALUATION</small></div></div>
      <div className="side-label">WORKSPACE</div><a className="nav-item active" href="#setup"><span className="nav-dot"/>New evaluation</a><button className={`nav-item ${historyOpen ? "active" : ""}`} onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) window.setTimeout(() => document.getElementById("run-history")?.scrollIntoView({ behavior: "smooth" }), 0); }}><Icon name="clock"/>Run history <span className="nav-count">{runs.length}</span></button>
      <div className="sidebar-footer"><div className="privacy-mark">◈</div><div><strong>Private by design</strong><small>Runs stay in this workspace.</small></div></div>
    </aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <b>New evaluation</b>{current && <><span>/</span><b className="crumb-current">{current.id}</b></>}</div><div className="top-actions"><button type="button" className="history-button" onClick={() => { setHistoryOpen(true); window.setTimeout(() => document.getElementById("run-history")?.scrollIntoView({ behavior: "smooth" }), 0); }}><Icon name="clock"/> History <span>{runs.length}</span></button><span className={`service-dot ${status.configured ? "online" : "offline"}`}/><span className="service-copy"><strong>{status.configured ? "Service ready" : "Service not configured"}</strong><small>{status.model || "Live mode unavailable"}</small></span><button className="icon-button" title="Refresh status" onClick={() => void refresh()}><span aria-hidden="true">↻</span></button></div></header>
      <div className="content-wrap"><div className="page-heading"><div><div className="eyebrow">FIGURE WORKBENCH</div><h1>Check a scientific figure</h1><p>Choose a figure, confirm what matters, then review the reconstruction and reader comparison.</p></div></div>
      {serviceError && <div className="notice warning"><span>!</span><div><strong>Local service unavailable</strong><p>{serviceError}</p></div></div>}
      <div className="mode-banner"><div className="mode-icon"><Icon name="spark"/></div><div><strong>{mode === "mock" ? "Scripted tutorial · engineering control" : isPublished(selected) ? status.configured ? "Live evaluation · published research" : "Live evaluation · service setup required" : status.configured ? "Live evaluation · model calls enabled" : "Live evaluation · setup required"}</strong><p>{mode === "mock" ? "Uses hand-authored teaching memories to preview the workflow. This is not AI output or evaluation evidence." : isPublished(selected) ? "Published paper figures have no scripted A/B memories. Use a configured Live service; reviewed checkpoints remain separate from both readers." : "A reads the image alone. The renderer reads A’s saved memory. B reads only the reconstructed raster."}</p></div><div className="mode-switch" role="group" aria-label="Evaluation mode"><button type="button" className={mode === "live" ? "selected" : ""} onClick={() => setMode("live")}>Live</button><button type="button" className={mode === "mock" ? "selected" : ""} disabled={!canUseMock} title={canUseMock ? "Use scripted tutorial data for this engineering control." : "Scripted tutorial is unavailable for published figures and uploads."} onClick={() => { setMode("mock"); setIncludeBaseline(false); }}>Scripted tutorial</button></div></div>
      <div className="workbench-steps" aria-label="Setup progress"><span className={setupStep === 1 ? "active" : ""}>1 · Choose figure</span><span className={setupStep === 2 ? "active" : ""}>2 · Confirm message</span><span className={setupStep === 3 ? "active" : ""}>3 · Run check</span></div><form onSubmit={startRun}>
        {setupStep === 1 && <section className="card setup-card" id="setup"><div className="section-heading"><div className="step-index">01</div><div><h2>Choose a figure</h2><p>Start with a teaching example or upload your own PNG/JPEG.</p></div></div>
          <div className="source-tabs" role="group" aria-label="Figure source"><button type="button" className={originFilter === "published" ? "selected" : ""} aria-pressed={originFilter === "published"} onClick={() => setOriginFilter("published")}>Published research <span>{publishedCount}</span></button><button type="button" className={originFilter === "teaching" ? "selected" : ""} aria-pressed={originFilter === "teaching"} onClick={() => setOriginFilter("teaching")}>Engineering controls <span>{teachingCount}</span></button></div>
          <div className="filter-row"><label className="select-wrap"><span>DOMAIN</span><select value={domain} onChange={e => setDomain(e.target.value)}><option value="all">All domains</option>{["physics", "materials", "mathematics", "other"].map(x => <option key={x} value={x}>{labels[x]}</option>)}</select></label><label className="select-wrap"><span>FIGURE TYPE</span><select value={kind} onChange={e => setKind(e.target.value)}><option value="all">All types</option>{["mechanism", "structure", "plot", "geometry", "mixed"].map(x => <option key={x} value={x}>{labels[x]}</option>)}</select></label><label className="upload-button"><Icon name="image"/> Upload image<input type="file" accept="image/png,image/jpeg" onChange={changeUpload}/></label></div>
          <div className="example-grid">{visibleExamples.map(example => { const thumbnail = example.versions.find(item => item.id === "clear") || example.versions[0]; const published = isPublished(example); return <div className={`example-entry ${selectedExample === example.id ? "chosen" : ""}`} key={example.id}><button type="button" onClick={() => chooseExample(example.id)} className="example-card"><div className="example-thumb">{thumbnail && <Image src={thumbnail.image_url} alt={`${example.title} figure thumbnail`} width={480} height={280} unoptimized/>}</div><div className="example-meta"><div><Badge tone={published ? "teal" : "amber"}>{published ? "PUBLISHED RESEARCH" : "ENGINEERING CONTROL · SCRIPTED"}</Badge> <Badge>{labels[example.domain] || example.domain}</Badge> <Badge>{labels[example.figure_type] || example.figure_type}</Badge></div><h3>{example.title}</h3><p>{example.description}</p>{published && <div className="published-card-meta"><strong>{example.figure_label || "Original published figure"}</strong><span>{example.attribution || example.source}</span><span>{example.license}</span></div>}</div><span className="select-indicator" aria-label={selectedExample === example.id ? "Selected" : "Select example"}>{selectedExample === example.id ? "✓" : "+"}</span></button>{published && example.paper_url && <div className="paper-link-row"><a href={example.paper_url} target="_blank" rel="noreferrer">Open paper record <span aria-hidden="true">↗</span></a></div>}</div>; })}
            {!visibleExamples.length && <div className="empty-examples"><div className="empty-icon"><Icon name="book"/></div><strong>{examples.length ? "No examples match these filters" : "Example library is loading"}</strong><p>{examples.length ? "Adjust the domain or figure type filters." : "You can upload a PNG or JPEG while the library becomes available."}</p></div>}</div>
          {(selected || upload) && <div className="selected-preview"><div className="preview-thumb">{activeImage ? <Image src={activeImage} alt={selected ? `${selected.title} ${selectedVersion?.label || "Original"} version` : "Uploaded scientific figure"} width={200} height={140} unoptimized/> : <Icon name="image"/>}</div><div className="preview-copy"><Badge tone={upload ? "teal" : isPublished(selected) ? "teal" : "amber"}>{upload ? "YOUR IMAGE · LIVE ONLY" : isPublished(selected) ? "PUBLISHED RESEARCH" : "ENGINEERING CONTROL · SCRIPTED TUTORIAL"}</Badge><strong>{upload?.name || selected?.title}</strong><small>{upload ? `${(upload.size / 1024).toFixed(0)} KB · PNG/JPEG` : selectedVersion?.change}</small>{selected && <small className="selected-source">{selected.figure_label ? `${selected.figure_label} · ` : ""}{selected.attribution || selected.source} · {selected.license}</small>}{selected?.paper_url && <a className="selected-paper-link" href={selected.paper_url} target="_blank" rel="noreferrer">View paper and figure caption ↗</a>}</div>{selected && selected.versions.length > 1 && <label className="version-select"><span>FIGURE VERSION</span><select value={selectedVersion?.id || "clear"} onChange={e => setVersion(e.target.value as "clear" | "challenged")}>{selected.versions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}{selected && selected.versions.length === 1 && <div className="original-version"><span>FIGURE VERSION</span><strong>{selected.versions[0].label}</strong></div>}<button type="button" className="text-button" onClick={() => { setSelectedExample(""); setUpload(null); setUploadUrl(""); setKeypoints([]); setIncludeBaseline(false); }}>Remove</button></div>}
        </section>}
        {setupStep === 2 && <section className="card keypoint-card"><div className="section-heading"><div className="step-index">02</div><div><h2>Confirm the key points</h2><p>{isPublished(selected) ? "Reference checkpoints curated from the paper and caption; review and confirm them. They are not author-supplied intent." : "Write 3–5 atomic claims. Confirm each one before it is used for evaluation."}</p></div><Badge tone={keypoints.filter(k => k.author_confirmed).length === keypoints.length && keypoints.length ? "teal" : "muted"}>{keypoints.filter(k => k.author_confirmed).length}/{keypoints.length} confirmed</Badge></div>
          {keypoints.length ? <div className="keypoint-list">{keypoints.map((point, i) => <div className={`keypoint-row ${point.author_confirmed ? "confirmed" : ""}`} key={point.id}><span className="kp-num">{String(i + 1).padStart(2, "0")}</span><textarea aria-label={`Key point ${i + 1}`} maxLength={1200} value={point.text} placeholder="State one scientifically meaningful relationship, condition, or value…" onChange={e => editKeypoint(point.id, e.target.value)}/><button type="button" className={`confirm-button ${point.author_confirmed ? "is-confirmed" : ""}`} onClick={() => setKeypoints(current => current.map(k => k.id === point.id ? { ...k, author_confirmed: !k.author_confirmed } : k))}>{point.author_confirmed ? "✓ Confirmed" : "Confirm"}</button><button type="button" className="remove-kp" aria-label={`Remove key point ${i + 1}`} onClick={() => setKeypoints(keypoints.filter(k => k.id !== point.id))}>×</button></div>)}{keypoints.length < 5 && <button type="button" className="add-kp" onClick={addKeypoint}>＋ Add key point</button>}</div> : <div className="keypoint-empty"><span>✳</span><div><strong>Select an example to load its draft points</strong><p>For an uploaded image, add at least three key points below.</p></div><button type="button" className="button secondary" onClick={addKeypoint}>Add first point</button></div>}
        </section>}
        {setupStep === 3 && <section className="card run-review-card"><div className="section-heading"><div className="step-index">03</div><div><h2>Ready to run</h2><p>Review the selected figure and confirmed key points.</p></div></div>{activeImage && <div className="workbench-preview"><Image src={activeImage} alt={selected?.title || upload?.name || "Selected figure"} width={900} height={600} unoptimized/><div><strong>{upload?.name || selected?.title}</strong><span>{keypoints.length} key points confirmed</span><button type="button" className="text-button" onClick={() => setSetupStep(1)}>Change figure</button></div></div>}<button type="button" className="button secondary" onClick={() => setSetupStep(2)}>Back</button><details className="advanced-options"><summary>Advanced options</summary><div className="run-options"><div className="run-intent"><span className="run-lock">◇</span><span><strong>Checkpoint boundary</strong><small>Checkpoints go only to the evaluator, never to readers A or B.</small></span></div><label className={`baseline-toggle ${mode !== "live" || !status.configured ? "disabled" : ""}`}><input type="checkbox" checked={includeBaseline} disabled={mode !== "live" || !status.configured} onChange={e => setIncludeBaseline(e.target.checked)}/><span><strong>Independent keypoint-aware baseline</strong><small>Separate direct check of image + confirmed checkpoints. It does not feed the A → reconstruction → B results.</small></span></label></div><div className="mode-switch" role="group" aria-label="Evaluation mode"><button type="button" className={mode === "live" ? "selected" : ""} onClick={() => setMode("live")}>Live</button><button type="button" className={mode === "mock" ? "selected" : ""} disabled={!canUseMock} title={canUseMock ? "Use scripted tutorial data for this engineering control." : "Scripted tutorial is unavailable for published figures and uploads."} onClick={() => { setMode("mock"); setIncludeBaseline(false); }}>Scripted tutorial</button></div></details><div className="run-bar"><span>{!status.configured && mode === "live" ? "Live service is not configured." : mode === "mock" ? "Scripted tutorial; no model call." : "Live model check."}</span><button className="button primary" type="submit" disabled={busy || !!running || !activeImage || keypoints.length < 3 || keypoints.length > 5 || keypoints.some(k => !k.author_confirmed || k.text.trim().length < 3)} title={!status.configured && mode === "live" ? "Live model service is not configured." : "Start the check."}>{busy || !!running ? <><span className="spinner"/> Running check…</> : <>Start check <Icon name="arrow"/></>}</button></div></section>}{setupStep < 3 && <div className="step-actions">{setupStep > 1 && <button className="button secondary" type="button" onClick={() => setSetupStep(1)}>Back</button>}<button className="button primary" type="button" disabled={setupStep === 1 ? !activeImage : keypoints.length < 3 || keypoints.length > 5 || keypoints.some(k => !k.author_confirmed || k.text.trim().length < 3)} title={setupStep === 1 && !activeImage ? "Choose a figure to continue." : setupStep === 2 && keypoints.some(k => !k.author_confirmed) ? "Confirm every key point to continue." : "Continue"} onClick={() => setSetupStep(setupStep === 1 ? 2 : 3)}>Continue <Icon name="arrow"/></button></div>}
      </form>
      {pageError && <div className="notice error" role="alert"><span>!</span><div><strong>Action needed</strong><p>{pageError}</p></div><button onClick={() => setPageError("")} aria-label="Dismiss error">×</button></div>}
      {historyOpen && <section className="card history-card" id="run-history"><div className="section-heading"><div className="step-index">H</div><div><h2>Run history</h2><p>Recent 50 records are listed. Open any older saved run by its full ID; the ID lookup does not depend on the recent list.</p></div><button type="button" className="text-button history-close" onClick={() => setHistoryOpen(false)}>Close</button></div>
        <div className="history-controls"><label className="history-field"><span>FILTER SAVED RUNS</span><input value={historyFilter} onChange={e => { setHistoryFilter(e.target.value); setHistoryLimit(10); }} placeholder="Run ID, figure, mode or status" /></label><form className="history-field open-run" onSubmit={e => { e.preventDefault(); void loadRun(openRunId); }}><span>OPEN RUN BY ID</span><div><input value={openRunId} onChange={e => setOpenRunId(e.target.value)} placeholder="e.g. 1792609657136-e85156a8" aria-label="Run ID" /><button className="button secondary small" type="submit">Open</button></div></form></div>
        {historyMessage && <div className="notice warning history-message" role="status"><span>!</span><div><strong>Run history</strong><p>{historyMessage}</p></div></div>}
        {filteredRuns.length ? <div className="history-table-wrap"><div className="history-table"><div className="history-head"><span>RUN ID</span><span>FIGURE / SOURCE</span><span>MODE</span><span>STATUS</span><span>CREATED</span></div>{filteredRuns.slice(0, historyLimit).map(run => <button type="button" className="history-data-row" key={run.id} onClick={() => void loadRun(run.id)} title={`Open run ${run.id}`}><span className="history-id">{run.id}</span><span>{run.example_id || "Uploaded figure"}</span><span>{run.mode === "mock" ? "SCRIPTED" : "LIVE"}</span><span className={`history-status ${run.status}`}>{run.status}</span><span>{new Date(run.created_at).toLocaleString()}</span></button>)}</div></div> : <p className="empty-side">No saved runs match this filter.</p>}
        {filteredRuns.length > historyLimit && <button type="button" className="button secondary small show-more" onClick={() => setHistoryLimit(value => value + 10)}>Show {Math.min(10, filteredRuns.length - historyLimit)} more runs</button>}
      </section>}
      {current && <Results run={current} expanded={expanded} setExpanded={setExpanded} onDownload={downloadReport} onCompare={() => { setCompareLeft(current.id); const details = document.getElementById("history-comparison-details") as HTMLDetailsElement | null; if (details) details.open = true; window.setTimeout(() => document.getElementById("history-comparison")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} />}
      {runs.length > 1 && <details className="saved-comparison" id="history-comparison-details"><summary>Compare saved runs</summary><section className="card comparison-card" id="history-comparison"><div className="section-heading"><div className="step-index">↔</div><div><h2>Compare completed runs</h2><p>Comparison eligibility and mismatches are reported by the evaluator.</p></div></div><div className="compare-controls"><label className="select-wrap"><span>LEFT RUN</span><select value={compareLeft} onChange={e => setCompareLeft(e.target.value)}><option value="">Choose run</option>{runs.filter(r => r.status === "completed").map(r => <option key={r.id} value={r.id}>{r.id} · {r.mode.toUpperCase()} · {r.example_id || "Upload"}</option>)}</select></label><span className="compare-arrow">↔</span><label className="select-wrap"><span>RIGHT RUN</span><select value={compareRight} onChange={e => setCompareRight(e.target.value)}><option value="">Choose run</option>{runs.filter(r => r.status === "completed").map(r => <option key={r.id} value={r.id}>{r.id} · {r.mode.toUpperCase()} · {r.example_id || "Upload"}</option>)}</select></label><button className="button secondary" onClick={() => void compareRuns()} disabled={!compareLeft || !compareRight || compareLeft === compareRight}>Compare versions</button></div>{comparison && <div className="comparison-result"><div className="compare-state"><Badge tone={comparison.comparable ? "teal" : "amber"}>{comparison.comparable ? "COMPARABLE" : "NOT DIRECTLY COMPARABLE"}</Badge><span>{comparison.note}</span></div>{comparison.differences.map(d => <p className="difference" key={d}>• {d}</p>)}{comparison.rows.length > 0 && <div className="compare-table"><div className="compare-head"><span>KEY POINT</span><span>LEFT</span><span>RIGHT</span></div>{comparison.rows.map(row => <div className="compare-row" key={row.id}><strong>{row.text}</strong><span>{row.left}</span><span>{row.right}</span></div>)}</div>}</div>}</section></details>}
      </div>
    </section>
  </main>;
}

function Results({ run, expanded, setExpanded, onDownload, onCompare }: { run: RunSnapshot; expanded: { a: boolean; b: boolean }; setExpanded: (value: { a: boolean; b: boolean }) => void; onDownload: (format: "json" | "markdown") => void; onCompare: () => void }) {
  const report: EvaluationReport | null = run.report;
  const reviewItems = report ? buildReviewQueue(run) : [];
  const activeIndex = run.status === "queued" ? -1 : steps.indexOf(run.status);
  const isDone = run.status === "completed";
  return <section className="results-section" aria-live="polite"><div className="result-title"><div><div className="eyebrow">{run.mode === "mock" ? "SCRIPTED TEACHING DEMO" : "LIVE MODEL RUN"}</div><h2>Evaluation trace</h2><p>Run {run.id} · {new Date(run.created_at).toLocaleString()}</p></div><div className="result-actions"><Badge tone={run.mode === "mock" ? "amber" : "teal"}>{run.mode === "mock" ? "SCRIPTED DEMO" : "LIVE"}</Badge>{isDone && <><button className="button secondary small" onClick={() => onDownload("markdown")}><Icon name="download"/> Markdown</button><button className="button secondary small" onClick={() => onDownload("json")}>JSON</button></>}</div></div>
    {run.mode === "mock" && <div className="notice demo"><span>✳</span><div><strong>Scripted demonstration</strong><p>These hand-authored teaching memories preview the interface. They are not generated by an AI model and are not evidence of evaluation accuracy.</p></div></div>}
    {!isDone && run.status !== "failed" && run.status !== "interrupted" && <div className="progress-card"><div className="progress-top"><strong>Pipeline progress</strong><span>{run.status === "queued" ? "Waiting to start" : run.status.replaceAll("_", " ")}</span></div><div className="pipeline">{steps.map((step, i) => { const done = activeIndex > i; const active = activeIndex === i; return <div className={`pipeline-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={step}><div className="pipeline-node">{done ? "✓" : `0${i + 1}`}</div><strong>{["Read A", "Reconstruct", "Read B", "Evaluate"][i]}</strong><small>{["Image only", "Memory only", "Raster only", "Key points + A/B"][i]}</small></div>; })}</div><p className="progress-foot">Independent requests; no shared reader conversation.</p></div>}
    {(run.status === "failed" || run.status === "interrupted") && <div className="notice error"><span>!</span><div><strong>{run.status === "failed" ? "Run failed" : "Run interrupted"}</strong><p>{run.error?.message || "The run ended before a report was produced."} {run.error?.stage && <span>Stage: {run.error.stage}.</span>}</p><small>Check the service configuration and input limits, then start a new run. This record remains in history.</small></div></div>}

    {(run.a || run.b) && <><div className="image-comparison"><div className="image-panel"><div className="panel-head"><div><span className="panel-kicker">SOURCE</span><strong>Original figure</strong></div><Badge>AUTHOR INPUT</Badge></div><div className="image-canvas">{run.assets.original ? <Image src={run.assets.original} alt="Original source figure" width={1200} height={700} unoptimized/> : <div className="image-placeholder"><Icon name="image"/><span>Original image asset unavailable</span></div>}</div></div><div className="transform-arrow"><span>memory</span><i>→</i><span>reconstruction</span></div><div className="image-panel"><div className="panel-head"><div><span className="panel-kicker">RECONSTRUCTION</span><strong>{run.b?.title || run.a?.title || "Second-reader image"}</strong></div><Badge tone="teal">RASTER</Badge></div><div className="image-canvas reconstructed">{run.assets.reconstruction ? <Image src={run.assets.reconstruction} alt="Reconstructed figure raster" width={1200} height={700} unoptimized/> : <MemoryPreview memory={run.a} />}</div></div></div>
    {report && <section className="review-panel" aria-labelledby="review-title"><div className="review-heading"><div><div className="eyebrow">REVIEW GUIDE</div><h3 id="review-title">What to review first</h3><p>These items come from available records and coverage metadata. Item count does not indicate severity or figure quality.</p></div><span className="no-score">Record-based triage</span></div>{reviewItems.length === 0 ? <p className="review-empty">No review items from the available records. This is not proof of full fidelity.</p> : <><div className="review-list">{reviewItems.slice(0, 3).map(item => <ReviewQueueItem key={item.id} item={item}/>)}</div>{reviewItems.length > 3 && <details className="review-more"><summary>Show {reviewItems.length - 3} more review items</summary><div className="review-list">{reviewItems.slice(3).map(item => <ReviewQueueItem key={item.id} item={item}/>)}</div></details>}</>}</section>}
      <details className="technical-details"><summary>Reader memory and technical details</summary><div className="memory-grid">{([["a", "Reader A · first understanding", run.a], ["b", "Reader B · after reconstruction", run.b]] as const).map(([key, title, memory]) => <div className="memory-card" key={key}><button className="memory-heading" onClick={() => setExpanded({ ...expanded, [key]: !expanded[key] })}><span className={`memory-orb ${key}`}>{key.toUpperCase()}</span><span><small>{key === "a" ? "IMAGE ONLY" : "RECONSTRUCTION RASTER ONLY"}</small><strong>{title}</strong></span><span className="expand-icon">{expanded[key] ? "−" : "+"}</span></button>{expanded[key] && (memory ? <div className="memory-content"><p>{memory.summary}</p><div className="memory-facts">{memory.facts.slice(0, 8).map(f => <div className="fact-row" key={f.id}><span className={`certainty ${f.certainty}`}/><div><strong>{f.subject}</strong><span>{f.predicate} <b>{f.object}</b></span>{f.qualifiers.length > 0 && <small>{f.qualifiers.join(" · ")}</small>}</div><em>{f.certainty.replaceAll("_", " ")}</em></div>)}{memory.graph.nodes.length > 0 && <p className="memory-count">{memory.graph.nodes.length} entities · {memory.graph.relations.length} relations · {memory.plots.length} plots</p>}</div></div> : <div className="memory-unavailable">Waiting for this reader stage.</div>)}</div>)}</div></details></>}
    {report && <><div className="report-heading"><div><div className="eyebrow">KEYPOINT-BY-KEYPOINT</div><h3>What survived the journey</h3></div><span className="no-score">Evidence trace · no overall score</span></div><div className="keypoint-results">{report.keypoint_results.map((result, i) => <div className="report-row" key={result.keypoint_id}><div className="report-main"><span className="report-num">{String(i + 1).padStart(2, "0")}</span><strong>{result.text}</strong>{run.keypoints.find(k => k.id === result.keypoint_id)?.scientific && <Badge tone="amber">PROJECT-CURATED CHECK</Badge>}<Badge tone="muted">{result.observed_stage.replaceAll("_", " ")}</Badge></div><div className="judgments"><Judgment label="A · first read" judgment={result.in_a}/><Judgment label="B · second read" judgment={result.in_b}/><div className="render-status"><span>RENDER</span><b>{result.render_item_status.replaceAll("_", " ")}</b></div></div><div className="report-evidence"><p>{result.in_b.rationale}</p>{result.suggestions.length > 0 && <small>Suggestion: {result.suggestions.join(" ")}</small>}</div></div>)}</div>
      <details className="technical-details"><summary>Technical checks &amp; audit</summary><CoveragePanel report={report}/>
      <div className="audit-grid"><div className="audit-card"><div className="audit-title"><span>▤</span><strong>Rendering audit</strong></div><div className="audit-values"><span>Structure<b>{run.render_audit?.structural_audit || "unknown"}</b></span><span>Visual review<b>{run.render_audit?.visual_review || "unknown"}</b></span><span>Unsupported<b>{run.render_audit?.unsupported_item_ids.length ?? "unknown"}</b></span></div>{run.render_audit?.warnings.length ? <div className="audit-warning">{run.render_audit.warnings.map(w => <p key={w}>! {w}</p>)}</div> : null}</div><div className="audit-card"><div className="audit-title"><span>◷</span><strong>Usage & limitations</strong></div><div className="stage-usage">{run.stages.map(stage => <div key={stage.stage}><span>{stage.stage.replaceAll("_", " ")}</span><b>{stageUsageText(stage, run.mode, !run.config_snapshot)}</b></div>)}</div>{run.config_snapshot && <p className="config-snapshot">Configured {run.config_snapshot.model} · {run.config_snapshot.protocol} · ctx {run.config_snapshot.num_ctx ?? "unknown"} · digest {run.config_snapshot.model_digest ? run.config_snapshot.model_digest.slice(0, 12) : "unknown"}</p>}{report.limitations.map(item => <p className="limitation" key={item}>{item}</p>)}</div></div></details>
      {report.unmatched_b_claims.length > 0 && <div className="unmatched"><strong>Additional claims in B · review recommended</strong>{report.unmatched_b_claims.map(claim => <p key={claim.id}>{claim.text} {claim.review_required && <Badge tone="amber">REVIEW</Badge>}</p>)}</div>}</>}
    {run.baseline && <BaselinePanel baseline={run.baseline} keypoints={run.keypoints}/>}
      {run.status === "completed" && !report && <div className="notice warning"><span>!</span><div><strong>Run completed without an evaluation report</strong><p>Inspect the run record or report this API response to the project maintainer.</p></div></div>}
      <div className="result-foot"><span>Observed stages describe where evidence appeared; later differences do not establish why it was lost.</span><button className="text-button" onClick={onCompare}>Compare with another run →</button></div>
    </section>;
}

function ReviewQueueItem({ item }: { item: ReturnType<typeof buildReviewQueue>[number] }) {
  const references = (title: string, evidence: typeof item.a) => <div className="review-reference"><strong>{title}</strong>{evidence.length ? <ul>{evidence.map(record => <li key={record.id}><code>{record.id}</code><span>{record.text}</span></li>)}</ul> : <p>No cited record item available.</p>}</div>;
  return <article className="review-item" key={item.id}><div className="review-item-top"><span className="review-label">{item.label}</span></div><h4>{item.title}</h4><p className="review-observation">{item.observation}</p><p className="review-action"><strong>Next step</strong> {item.action}</p><details className="review-evidence"><summary>Show A/B record references</summary><p className="review-reference-note">These are record references, not pixel locations.</p><div className="review-reference-grid">{references("A · first read", item.a)}{references("B · second read", item.b)}</div></details></article>;
}

function CoveragePanel({ report }: { report: EvaluationReport }) {
  const coverage = report.coverage;
  const findings = report.scientific_findings;
  if (!coverage) {
    return <div className="coverage-panel legacy-coverage"><div className="coverage-head"><strong>Detection coverage unavailable</strong><Badge tone="amber">LEGACY REPORT</Badge></div><p>This saved report predates coverage metadata. It does not show which automatic checks ran; an absent or empty finding list is not evidence of zero change.</p></div>;
  }
  const axisExecuted = coverage.plot_audit.axis_executed ?? coverage.plot_audit.executed;
  const seriesExecuted = coverage.plot_audit.series_executed ?? coverage.plot_audit.matched_series > 0;
  const checks = [
    { key: "fact", label: "Fact-by-fact comparison", executed: coverage.fact_comparison.executed, detail: `${coverage.fact_comparison.a_facts} A facts · ${coverage.fact_comparison.b_facts} B facts`, reason: coverage.fact_comparison.reason },
    { key: "relation", label: "Relation-direction audit", executed: coverage.relation_audit.executed, detail: "", reason: coverage.relation_audit.reason },
    { key: "condition", label: "Condition audit", executed: coverage.condition_audit.executed, detail: "", reason: coverage.condition_audit.reason },
    { key: "axis", label: "Plot-axis audit", executed: axisExecuted, detail: `${coverage.plot_audit.a_plots} A plots · ${coverage.plot_audit.b_plots} B plots · ${coverage.plot_audit.matched_plots ?? coverage.plot_audit.matched_series} uniquely matched plots`, reason: coverage.plot_audit.reason },
    { key: "series", label: "Series-shape audit", executed: seriesExecuted, detail: `${coverage.plot_audit.matched_series} uniquely matched series`, reason: seriesExecuted ? null : coverage.plot_audit.reason },
  ];
  const findingLabels: Record<string, string> = { relation_direction: "Relation direction", condition_loss: "Condition loss", value_change: "Value change", threshold_value: "Threshold / level", axis_unit_scale: "Axis unit or scale", series_shape_change: "Series shape" };
  return <div className="coverage-panel">
    <div className="coverage-head"><div><div className="eyebrow">WHAT WAS ACTUALLY CHECKED</div><strong>Detection coverage</strong></div><Badge tone="muted">{checks.filter(check => check.executed).length}/{checks.length} rule audits executed</Badge></div>
    <div className="coverage-grid">{checks.map(check => <div className={`coverage-row ${check.executed ? "ran" : "skipped"}`} key={check.key}><span className="coverage-state">{check.executed ? "✓" : "—"}</span><div><strong>{check.label}</strong><small>{check.executed ? `Executed${check.detail ? ` · ${check.detail}` : ""}` : "NOT EXECUTED"}</small>{check.reason && <p>{check.reason}</p>}</div></div>)}</div>
    {coverage.plot_audit.unmatched_a_plots && coverage.plot_audit.unmatched_a_plots.length > 0 && <p className="coverage-note"><b>Unmatched A plots:</b> {coverage.plot_audit.unmatched_a_plots.join("; ")}</p>}
    {coverage.plot_audit.unmatched_a_series.length > 0 && <p className="coverage-note"><b>Unmatched A series:</b> {coverage.plot_audit.unmatched_a_series.join("; ")}</p>}
    {coverage.plot_audit.unmatched_b_plots && coverage.plot_audit.unmatched_b_plots.length > 0 && <p className="coverage-note"><b>Unmatched B plots:</b> {coverage.plot_audit.unmatched_b_plots.join("; ")}</p>}
    {coverage.plot_audit.unmatched_b_series && coverage.plot_audit.unmatched_b_series.length > 0 && <p className="coverage-note"><b>Unmatched B series:</b> {coverage.plot_audit.unmatched_b_series.join("; ")}</p>}
    <p className="coverage-note"><b>Not covered:</b> {coverage.unchecked.join("; ")}</p>
    <p className="coverage-note">{coverage.note}</p>
    <div className="findings-head"><strong>Scientific findings</strong><Badge tone={findings?.length ? "amber" : "muted"}>{findings?.length ?? 0} rule-level</Badge></div>
    {findings === undefined && <p className="coverage-note">Scientific-finding metadata unavailable (legacy report); no absence of findings can be inferred.</p>}
    {findings?.length ? <div className="findings-list">{findings.map(finding => <div className="finding-row" key={finding.id}><Badge tone={finding.status === "confirmed" ? "rose" : "amber"}>{finding.status.toUpperCase()}</Badge><div><strong>{findingLabels[finding.category] || finding.category}</strong><p>{finding.summary}</p></div>{finding.review_required && <span className="review-mark">REVIEW</span>}</div>)}</div> : findings ? <p className="coverage-note">No rule-level scientific deviations were detected by the executed checks. This is not evidence that the figure is unchanged.</p> : null}
  </div>;
}
function Judgment({ label, judgment }: { label: string; judgment: { status: string; method: string; rationale: string; review_required: boolean; issue_types: string[] } }) { return <div className="judgment-cell"><span>{label}</span><div><Badge tone={judgment.status === "retained" ? "teal" : judgment.status === "uncertain" ? "amber" : "rose"}>{judgment.status}</Badge><small>{judgment.method.replaceAll("_", " ")}{judgment.review_required ? " · review" : ""}{judgment.issue_types.length ? ` · ${judgment.issue_types.join(", ")}` : ""}</small></div></div>; }
function BaselinePanel({ baseline, keypoints }: { baseline: NonNullable<RunSnapshot["baseline"]>; keypoints: Keypoint[] }) {
  return <section className="baseline-panel"><div className="baseline-heading"><div><div className="eyebrow">SEPARATE REQUEST · LIVE ONLY</div><h3>Independent keypoint-aware baseline</h3></div><Badge tone="amber">NOT PART OF A → B</Badge></div><p className="baseline-explainer">This direct check received the original image and confirmed checkpoints in an independent request. Its judgments do not feed the main reader, reconstruction, or report.</p>
    {baseline.error && <div className="notice warning"><span>!</span><div><strong>Baseline did not complete</strong><p>{baseline.error}</p></div></div>}
    {baseline.result && <div className="baseline-results">{baseline.result.results.map(item => { const point = keypoints.find(k => k.id === item.keypoint_id); return <div className="baseline-row" key={item.keypoint_id}><strong>{point?.text || item.keypoint_id}</strong><Judgment label="Direct image + checkpoint" judgment={item.judgment}/></div>; })}</div>}
    {!baseline.result && !baseline.error && <div className="memory-unavailable">Waiting for the independent baseline response.</div>}
    {baseline.meta && <div className="baseline-meta">{baseline.meta.model} · {baseline.meta.latency_ms} ms · {usageTokens(baseline.meta.usage) ?? "usage n/a"} tokens · {baseline.meta.attempts} attempt{baseline.meta.attempts === 1 ? "" : "s"}{baseline.meta.usage_complete === false ? " · usage partial" : ""}{baseline.meta.attempts_detail ? "" : " · legacy audit"}</div>}
  </section>;
}
function MemoryPreview({ memory }: { memory: MemoryRecord | null }) { if (!memory) return <div className="image-placeholder"><Icon name="image"/><span>Reconstruction is not ready</span></div>; return <div className="memory-preview"><div className="preview-title">{memory.title}</div><div className="preview-summary">{memory.summary}</div>{memory.graph.nodes.slice(0, 6).map((node, i) => <div className={`preview-node node-${i}`} key={node.id}>{node.label}</div>)}{memory.graph.relations.slice(0, 5).map((r, i) => <div className={`preview-relation rel-${i}`} key={r.id}>{r.label || r.kind.replaceAll("_", " ")}</div>)}{memory.facts.slice(0, 3).map(f => <div className="preview-fact" key={f.id}>{f.subject} · {f.predicate} · {f.object}</div>)}</div>; }
