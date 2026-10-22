"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CaseIndex, CaseSummary, PublicCase } from "@/lib/examples/case-studies";
import styles from "@/components/entry.module.css";

const Workbench = dynamic(() => import("@/components/workbench"), {
  ssr: false,
  loading: () => <div className={styles.loadingWorkbench}>Opening the figure workspace…</div>,
});
const base = process.env.NEXT_PUBLIC_RFE_BASE_PATH || "";
const asset = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;
const demoOnly = process.env.NEXT_PUBLIC_RFE_DEMO_ONLY === "1";
const githubUrl = "https://github.com/snowgoose1975/Research-Figure-Evaluator";
const domainNames: Record<string, string> = { physics: "Physics", materials: "Materials", mathematics: "Mathematics" };

function Figure({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) {
      dialog.close();
    }
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key === "Tab") {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter(element => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        if (!first || focusable.length === 1) {
          event.preventDefault();
          (first || dialog).focus();
        } else if (event.shiftKey && (currentIndex <= 0)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (currentIndex === -1 || currentIndex === focusable.length - 1)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
  };

  return <>
    <button ref={triggerRef} type="button" className={styles.figureLink} onClick={() => setIsOpen(true)} aria-label={`View full-size: ${alt}`} aria-haspopup="dialog">
      <span className={styles.figureFrame}><Image src={asset(src)} alt={alt} width={1200} height={900} unoptimized priority={priority} sizes="(max-width: 700px) 94vw, 48vw" /></span>
    </button>
    <dialog ref={dialogRef} tabIndex={-1} className={styles.imageDialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setIsOpen(false); triggerRef.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.dialogPanel}>
        <div className={styles.dialogHeader}><h2 id={titleId}>{alt}</h2><button type="button" className={styles.closeImage} onClick={close} autoFocus>Close image</button></div>
        <Image className={styles.dialogImage} src={asset(src)} alt={alt} width={1600} height={1200} unoptimized sizes="96vw" />
      </div>
    </dialog>
  </>;
}

export default function Home() {
  const [index, setIndex] = useState<CaseIndex | null>(null);
  const [caseData, setCaseData] = useState<PublicCase | null>(null);
  const [active, setActive] = useState(false);
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestedCase, setRequestedCase] = useState("");
  const caseRequest = useRef(0);
  const caseController = useRef<AbortController | null>(null);

  const openCase = useCallback(async (summary: CaseSummary) => {
    caseController.current?.abort();
    const request = ++caseRequest.current;
    setRequestedCase(summary.id);
    setCaseData(null);
    setError("");
    setLoading(true);
    const controller = new AbortController();
    caseController.current = controller;
    const requestId = summary.id;
    try {
      const response = await fetch(asset(summary.record), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load this saved case (${response.status}).`);
      const data = await response.json() as PublicCase;
      if (caseRequest.current === request && summary.id === requestId) setCaseData(data);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (caseRequest.current === request) setError(reason instanceof Error ? reason.message : "Could not load this saved case.");
    } finally {
      if (caseRequest.current === request) setLoading(false);
    }
  }, []);

  const syncUrl = useCallback((next: { caseId?: string; workspace?: boolean; clear?: boolean }) => {
    const params = new URLSearchParams(window.location.search);
    params.delete("case");
    if (next.clear) { params.delete("run"); params.delete("workspace"); }
    if (next.caseId) { params.set("case", next.caseId); params.delete("workspace"); }
    if (next.workspace) { params.set("workspace", "1"); params.delete("case"); }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  const goHome = useCallback(() => {
    caseController.current?.abort();
    caseRequest.current += 1;
    setActive(false); setShowDemoInfo(false); setCaseData(null); setError(""); setRequestedCase(""); setLoading(false);
    syncUrl({ clear: true });
  }, [syncUrl]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(asset("/case-studies/index-v2.json"), { signal: controller.signal, cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("Case index could not be loaded."); return response.json() as Promise<CaseIndex>; })
      .then(data => {
        setIndex(data);
        const params = new URLSearchParams(window.location.search);
        const caseId = params.get("case");
        if (caseId) {
          const found = data.cases.find(item => item.id === caseId);
          if (found) void openCase(found);
        } else if (params.has("run") || params.get("workspace") === "1") {
          setActive(true);
        }
      })
      .catch(reason => { if (reason instanceof DOMException && reason.name === "AbortError") return; setError("The saved case list could not be loaded. Check your connection and retry."); });
    return () => controller.abort();
  }, [openCase]);

  const enterWorkbench = () => {
    if (demoOnly) { setShowDemoInfo(true); setActive(false); return; }
    setShowDemoInfo(false); setCaseData(null); setActive(true); syncUrl({ workspace: true });
  };
  const selectCase = (item: CaseSummary) => { setActive(false); setShowDemoInfo(false); syncUrl({ caseId: item.id }); void openCase(item); };
  const retryIndex = () => { setError(""); window.location.reload(); };

  if (active && !demoOnly) return <main className={styles.workspace}><div className={styles.workspaceBar}><a className={styles.brand} href={asset("/")} onClick={event => { event.preventDefault(); goHome(); }}>Figure Relay</a><button className={styles.backButton} onClick={goHome}>← Back to home</button></div><Workbench /></main>;

  const selected = index?.cases.find(item => item.id === requestedCase) || null;
  const showDetail = Boolean(selected && (caseData || loading || error));
  return <main className={styles.site}>
    <header className={styles.header}>
      <a href={asset("/")} className={styles.brand} onClick={event => { event.preventDefault(); goHome(); }}><span className={styles.brandMark}>FR</span>Figure Relay</a>
      <nav aria-label="Main navigation"><a href="#cases" onClick={goHome}>View cases</a><button onClick={enterWorkbench}>Check my figure</button><a href={githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a></nav>
    </header>

    {showDemoInfo ? <section className={`${styles.section} ${styles.demoInfo}`}><p className={styles.kicker}>PUBLIC DEMO · READ ONLY</p><h1>Online analysis is not connected yet.</h1><p>The public site currently shows saved historical replays. To check a figure locally, clone the repository, install project dependencies with <code>npm ci</code>, then start the app with <code>npm run dev</code>.</p><div className={styles.buttonRow}><button className={styles.primaryButton} onClick={goHome}>Back to cases</button><a className={styles.secondaryButton} href={githubUrl} target="_blank" rel="noreferrer">Project on GitHub ↗</a></div></section> : showDetail ? <CaseDetail item={selected!} data={caseData} loading={loading} error={error} onBack={goHome} onRetry={() => void openCase(selected!)} /> : <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}><p className={styles.kicker}>REVIEW THE MESSAGE YOUR FIGURE CARRIES</p><h1>Will readers understand your scientific figure?</h1><p className={styles.heroText}>Compare 3–5 points you expect readers to take away with an AI-simulated reader’s account. Review what it missed, changed, or found uncertain, then use the visual comparison to guide revisions. This does not measure human understanding or prove a figure is wrong.</p><div className={styles.buttonRow}><a className={styles.primaryButton} href="#cases">View real cases <span>↓</span></a><button className={styles.secondaryButton} onClick={enterWorkbench}>Check my figure <span>↗</span></button></div><div className={styles.flow} aria-label="Expected message, simulated reader understanding, review and revise"><span>Your intended message</span><i>→</i><span>Simulated reader understanding</span><i>→</i><span>Review and revise</span></div></div>
        <div className={styles.heroVisual}><div className={styles.visualLabel}>A SAVED MATERIALS CASE <span>RECORDED REAL RUN</span></div><div className={styles.heroImages}><Figure src="/published/materials-lattice-design.png" alt="Original published materials lattice figure" priority/><span>→</span><Figure src="/case-studies/materials-lattice-design/reconstruction.png" alt="AI reconstruction from saved materials case memory" priority/></div><div className={styles.imageCaptions}><span>Original paper figure</span><span>Reconstructed from saved memory</span></div><p className={styles.captionNote}>Images are shown in full; reconstruction is a concept rendering and needs visual review.</p></div>
      </section>
      <section className={styles.processBand}><div><span>01</span><strong>Your intended message</strong><small>Choose 3–5 points readers should take away</small></div><b>→</b><div><span>02</span><strong>A simulated reader’s understanding</strong><small>Review what was missed, changed, or uncertain</small></div><b>→</b><div><span>03</span><strong>Review, revise, compare</strong><small>Reconstruction is a diagnostic aid, not a verdict</small></div></section>
      <section className={styles.section} id="cases"><div className={styles.sectionHeading}><div><p className={styles.kicker}>HISTORICAL MODEL REPLAYS</p><h2>Four figures. Four different things to inspect.</h2><p>These are saved runs, not new live analyses. No model or API setup is needed to browse them.</p></div><span className={styles.runBadge}>Recorded real runs</span></div>
        {error && !showDetail && <div className={styles.errorBox}><p>{error}</p><button onClick={retryIndex}>Retry</button></div>}
        {index ? <div className={styles.caseGrid}>{index.cases.map(item => <button className={styles.caseCard} key={item.id} onClick={() => selectCase(item)}><div className={styles.cardImage}><Image src={asset(item.original)} alt={`Original figure: ${item.title}`} width={800} height={600} unoptimized sizes="(max-width: 700px) 92vw, (max-width: 1000px) 45vw, 24vw"/></div><div className={styles.cardBody}><div className={styles.cardMeta}><span>{domainNames[item.domain] || item.domain}</span><b className={item.status === "failed" ? styles.failed : styles.completed}>{item.status === "failed" ? "Reader failed" : "Recorded real run"}</b></div><h3>{item.title}</h3><p>{item.takeaway}</p><span className={styles.cardLink}>Inspect this replay <b>↗</b></span></div></button>)}</div> : <div className={styles.loadingBox}>Loading saved cases…</div>}
      </section>
      {index && <section className={`${styles.section} ${styles.protocol}`}><details><summary><span><b>{index.protocol.completed}/{index.protocol.total} runs completed</b> in the fixed protocol</span><span>{index.protocol.failed} failed · completion rate, not accuracy ↗</span></summary><p className={styles.selectionNote}>{index.selection}</p><div className={styles.protocolMeta}>Model: {index.protocol.model} · Prompt: {index.protocol.prompt_version}</div><div className={styles.tableScroll}><table><thead><tr><th>Figure</th><th>Attempt</th><th>Saved run</th><th>Status</th></tr></thead><tbody>{index.protocol.rows.map((row, i) => <tr key={`${row.run_id}-${i}`}><td>{row.example_id}</td><td>{row.attempt}</td><td><code>{row.run_id}</code></td><td><b className={row.status === "failed" ? styles.failed : styles.completed}>{row.status}</b></td></tr>)}</tbody></table></div></details></section>}
      <footer className={styles.footer}><a href={asset("/")} className={styles.brand}>Figure Relay</a><span>AI simulated reader feedback · saved replays · no human-memory measurement</span><button onClick={enterWorkbench}>Check my figure</button></footer>
    </>}
  </main>;
}

function CaseDetail({ item, data, loading, error, onBack, onRetry }: { item: CaseSummary; data: PublicCase | null; loading: boolean; error: string; onBack: () => void; onRetry: () => void }) {
  return <article className={styles.detail}>
    <button className={styles.backButton} onClick={onBack}>← Back to cases</button>
    {loading && <div className={styles.loadingBox}>Loading the saved record…</div>}
    {error && <div className={styles.errorBox}><p>{error}</p><button onClick={onRetry}>Retry</button></div>}
    {data && <>
      <div className={styles.detailHeading}><div><p className={styles.kicker}>{domainNames[item.domain] || item.domain} · {item.status === "failed" ? "READER FAILED" : "RECORDED REAL RUN"}</p><h1>{item.title}</h1><p>{item.takeaway}</p></div><span className={item.status === "failed" ? styles.failedBadge : styles.runBadge}>{item.status === "failed" ? "Reader failed" : "Recorded real run"}</span></div>
      <div className={styles.compare}><div><div className={styles.compareTitle}>Original published figure</div><Figure src={data.original} alt={`Original figure: ${data.title}`} /></div><span className={styles.compareArrow}>→</span><div><div className={styles.compareTitle}>Reconstruction from saved memory</div>{data.reconstruction ? <Figure src={data.reconstruction} alt={`Reconstruction of ${data.title}`} /> : <div className={styles.unavailableImage}>No reconstruction: the first read failed.</div>}</div></div>
      <p className={styles.attribution}>{data.attribution} <a href={data.paper_url} target="_blank" rel="noreferrer">View paper ↗</a></p>
      <div className={styles.detailGrid}><section className={styles.paper}><p className={styles.kicker}>WHAT MAY NEED REVIEW BEFORE YOU REVISE</p><h2>Trace each difference to its source</h2><p>{data.takeaway}</p><p>First check the original figure and its author checkpoints, then compare Reader A’s first account with the reconstruction and Reader B’s second account. If information is missing from the reconstruction, review that rendering gap first; it is not evidence by itself that the original figure caused the loss. Use the comparison as a prompt for your own review, not as a full-fidelity score or proof of scientific correctness.</p>{data.status === "failed" && <div className={styles.failureNote}>This run failed at {data.error?.stage || "an unavailable stage"}. There is no complete extraction, reconstruction, or evaluation to present as a success.</div>}</section><section className={styles.paper}><p className={styles.kicker}>PROVENANCE</p><h2>Historical local-model replay</h2><p>{data.provenance.note}</p><dl className={styles.metaList}><div><dt>Model</dt><dd>{data.provenance.model}</dd></div><div><dt>Recorded</dt><dd>{data.provenance.created_at}</dd></div><div><dt>Prompt version</dt><dd>{data.provenance.prompt_version}</dd></div><div><dt>Source run</dt><dd>{data.source_run_id}</dd></div></dl><p className={styles.smallNote}>This page reads a saved historical run. It does not make a new model call.</p></section></div>
      {data.report && <section className={styles.report}><p className={styles.kicker}>ORIGINAL SAVED REPORT</p><h2>Checkpoint results</h2><p>These are the original A/B judgments. “Retained” for every checkpoint does not mean full visual fidelity; semantic judgments require review.</p><div className={styles.checkpointTable}><div className={styles.checkpointHead}><span>Author checkpoint</span><span>A · first read</span><span>B · second read</span><span>Render</span></div>{data.report.keypoint_results.map(row => <div className={styles.checkpointRow} key={row.keypoint_id}><span>{row.text}</span><span>{row.in_a.status}<small>{row.in_a.method.replaceAll("_", " ")}{row.in_a.review_required ? " · review" : ""}</small></span><span>{row.in_b.status}<small>{row.in_b.method.replaceAll("_", " ")}{row.in_b.review_required ? " · review" : ""}</small></span><span>{row.render_item_status}</span></div>)}</div><details className={styles.dataDetails}><summary>Read saved reader summaries and full JSON</summary><h3>A · First reader summary</h3><p>{data.a?.summary || "No first-reader memory was saved."}</p><h3>B · Second reader summary</h3><p>{data.b?.summary || "No second-reader memory was saved."}</p><pre>{JSON.stringify({ keypoints: data.keypoints, a: data.a, b: data.b, report: data.report, render_audit: data.render_audit }, null, 2)}</pre></details></section>}
      {data.offline_audit && <section className={styles.report}><p className={styles.kicker}>CURRENT OFFLINE AUDIT OF SAVED MEMORIES</p><h2>Deterministic rule checks</h2><p>{data.offline_audit.note}</p><p><b>Not checked:</b> {data.offline_audit.coverage.unchecked.join(" · ")}</p>{data.offline_audit.findings.length ? <ul>{data.offline_audit.findings.map(f => <li key={f.id}><b>{f.status} · {f.category}</b> — {f.summary} {f.review_required && <span>Review required.</span>}</li>)}</ul> : <p>No rule-level findings were recorded by these offline checks. This does not mean the figure is unchanged.</p>}<details className={styles.dataDetails}><summary>Show complete offline audit coverage</summary><pre>{JSON.stringify(data.offline_audit, null, 2)}</pre></details></section>}
      {data.error && <section className={styles.failureNote}><b>Recorded failure:</b> {data.error.message}</section>}
    </>}
  </article>;
}
