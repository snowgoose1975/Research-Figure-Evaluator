"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CaseIndex, CaseSummary, PublicCase } from "@/lib/examples/case-studies";
import styles from "@/components/entry.module.css";
import {
  clearPendingVisitorJob,
  clearVisitorResults,
  consumePendingVisitorExpiryNotice,
  deleteVisitorResult,
  listVisitorResults,
  readPendingVisitorJob,
  savePendingVisitorJob,
  saveVisitorResult,
  type PendingVisitorJob,
  type VisitorResult,
} from "@/components/visitor-history";

const Workbench = dynamic(() => import("@/components/workbench"), {
  ssr: false,
  loading: () => <div className={styles.loadingWorkbench}>Opening the figure workspace…</div>,
});
const base = process.env.NEXT_PUBLIC_RFE_BASE_PATH || "";
const asset = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;
const demoOnly = process.env.NEXT_PUBLIC_RFE_DEMO_ONLY === "1";
const onlineAnalysisUrl = process.env.NEXT_PUBLIC_RFE_ANALYSIS_URL || "";
const githubUrl = "https://github.com/snowgoose1975/Research-Figure-Evaluator";
const stableSiteOrigin = "https://figure-relay.chicchair5.chatgpt.site";
const discoveryUrl = "https://raw.githubusercontent.com/snowgoose1975/Research-Figure-Evaluator/service-status/endpoint.json";
const domainNames: Record<string, string> = { physics: "Physics", materials: "Materials", mathematics: "Mathematics" };

function validTunnelUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") return null;
    return /^(?:[a-z0-9-]+\.)+(?:lhr\.life|localhost\.run)$/i.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

function safeReportProjection(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["model", "prompt_version", "reader_records", "report", "render_audit", "reconstruction_data_url", "limitations"]);
  const excluded = new Set(["image_base64", "original_image", "original_image_data_url", "uploaded_image", "filename", "file_name"]);
  const clean = (item: unknown, depth = 0): unknown => {
    if (depth > 40) throw new Error("The report is too deeply nested to save safely.");
    if (Array.isArray(item)) {
      if (item.length > 5000) throw new Error("The report contains too many items to save safely.");
      return item.map(child => clean(child, depth + 1));
    }
    if (!item || typeof item !== "object") return item;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      if (!excluded.has(key.toLowerCase())) result[key] = clean(child, depth + 1);
    }
    return result;
  };
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)).map(([key, item]) => [key, clean(item)]));
}

function safeSearchText(record: VisitorResult): string {
  const result = record.result && typeof record.result === "object" ? record.result as Record<string, unknown> : {};
  const readers = result.reader_records && typeof result.reader_records === "object" ? result.reader_records as Record<string, unknown> : {};
  const values: string[] = [record.status, record.createdAt, record.error || "", String(result.model || ""), String(result.prompt_version || "")];
  for (const reader of Object.values(readers)) {
    if (!reader || typeof reader !== "object") continue;
    const entry = reader as Record<string, unknown>;
    values.push(String(entry.title || ""), String(entry.summary || ""));
    for (const fact of Array.isArray(entry.facts) ? entry.facts : []) values.push(typeof fact === "string" ? fact : JSON.stringify(fact));
    const graph = entry.graph && typeof entry.graph === "object" ? entry.graph as Record<string, unknown> : {};
    for (const node of Array.isArray(graph.nodes) ? graph.nodes : []) values.push(typeof node === "string" ? node : JSON.stringify(node));
    for (const relation of Array.isArray(graph.relations) ? graph.relations : []) values.push(typeof relation === "string" ? relation : JSON.stringify(relation));
    for (const uncertainty of Array.isArray(entry.uncertainties) ? entry.uncertainties : []) values.push(typeof uncertainty === "string" ? uncertainty : JSON.stringify(uncertainty));
  }
  return values.join(" ").toLocaleLowerCase();
}

function historyTitle(record: VisitorResult): string {
  const result = record.result && typeof record.result === "object" ? record.result as Record<string, unknown> : {};
  const readers = result.reader_records && typeof result.reader_records === "object" ? result.reader_records as Record<string, unknown> : {};
  const readerA = readers.a && typeof readers.a === "object" ? readers.a as Record<string, unknown> : {};
  return typeof readerA.title === "string" && readerA.title.trim() ? readerA.title : "Figure check";
}

function downloadVisitorResult(record: VisitorResult) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `figure-relay-check-${record.createdAt.slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function SavedVisitorReport({ record }: { record: VisitorResult }) {
  const result = record.result && typeof record.result === "object" ? record.result as Record<string, unknown> : {};
  const report = result.report && typeof result.report === "object" ? result.report as Record<string, unknown> : {};
  const readers = result.reader_records && typeof result.reader_records === "object" ? result.reader_records as Record<string, unknown> : {};
  const rows = Array.isArray(report.keypoint_results) ? report.keypoint_results as Record<string, unknown>[] : [];
  const reader = (side: "a" | "b") => readers[side] && typeof readers[side] === "object" ? readers[side] as Record<string, unknown> : null;
  const reconstruction = typeof result.reconstruction_data_url === "string" && /^data:image\/(?:png|jpeg);base64,/i.test(result.reconstruction_data_url) ? result.reconstruction_data_url : "";
  const facts = (entry: Record<string, unknown> | null) => entry && Array.isArray(entry.facts) ? entry.facts : [];
  const nodes = (entry: Record<string, unknown> | null) => {
    const graph = entry?.graph && typeof entry.graph === "object" ? entry.graph as Record<string, unknown> : {};
    return Array.isArray(graph.nodes) ? graph.nodes : [];
  };
  const relations = (entry: Record<string, unknown> | null) => {
    const graph = entry?.graph && typeof entry.graph === "object" ? entry.graph as Record<string, unknown> : {};
    return Array.isArray(graph.relations) ? graph.relations : [];
  };
  const renderList = (items: unknown[]) => items.map(item => typeof item === "string" ? item : JSON.stringify(item));
  return <section className={styles.savedReport} aria-label="Saved report details">
    <div className={styles.savedReportHead}><div><p className={styles.kicker}>SAVED IN THIS BROWSER</p><h2>{historyTitle(record)}</h2><p>{new Date(record.createdAt).toLocaleString()} · {String(result.model || "Model not reported")} · {record.status}</p></div></div>
    {record.error && <p className={styles.storageWarning}>{record.error}</p>}
    {Boolean(record.result) && <>
      <h3>What readers A and B recorded</h3>
      <div className={styles.savedReaderGrid}>{(["a", "b"] as const).map(side => {
        const entry = reader(side);
        return <article key={side}><h4>Reader {side.toUpperCase()} · {side === "a" ? "original figure" : "reconstruction"}</h4>
          {entry ? <><b>{String(entry.title || "Untitled reading")}</b><p>{String(entry.summary || "No summary was saved.")}</p>
            {facts(entry).length > 0 && <><strong>Recorded facts</strong><ul>{renderList(facts(entry)).map((text, index) => <li key={`f-${index}`}>{text}</li>)}</ul></>}
            {nodes(entry).length > 0 && <><strong>Nodes</strong><ul>{renderList(nodes(entry)).map((text, index) => <li key={`n-${index}`}>{text}</li>)}</ul></>}
            {relations(entry).length > 0 && <><strong>Relations</strong><ul>{renderList(relations(entry)).map((text, index) => <li key={`r-${index}`}>{text}</li>)}</ul></>}
          </> : <p>Reader extraction is unavailable in this saved report.</p>}
        </article>;
      })}</div>
      {rows.length > 0 && <><h3>Author statements and evidence review</h3><div className={styles.savedFindings}>{rows.map((row, index) => {
        const a = row.in_a && typeof row.in_a === "object" ? row.in_a as Record<string, unknown> : {};
        const b = row.in_b && typeof row.in_b === "object" ? row.in_b as Record<string, unknown> : {};
        return <article key={String(row.keypoint_id || index)}><b>{String(row.text || row.keypoint_id || "Statement")}</b><span>A: {String(a.status || "unknown")} · B: {String(b.status || "unknown")}</span><small>{String((a.evidence_audit as Record<string, unknown> | undefined)?.status || "Evidence unverified")} / {String((b.evidence_audit as Record<string, unknown> | undefined)?.status || "Evidence unverified")}</small></article>;
      })}</div></>}
      {reconstruction && <><h3>Reconstruction</h3><Image className={styles.savedReconstruction} src={reconstruction} width={1400} height={1000} unoptimized alt="Saved reconstruction image" /></>}
      <details className={styles.savedJson}><summary>Downloadable report contents</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
    </>}
  </section>;
}

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

function VisitorWorkspace({ onHome }: { onHome: () => void }) {
  const [serviceUrl, setServiceUrl] = useState("");
  const [serviceMessage, setServiceMessage] = useState("Finding the current free host address…");
  const [records, setRecords] = useState<VisitorResult[]>([]);
  const [pending, setPending] = useState<PendingVisitorJob | null>(null);
  const [pendingExpired, setPendingExpired] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const serviceUrlRef = useRef("");
  const serviceOrigin = serviceUrl ? new URL(serviceUrl).origin : "";

  const reloadHistory = useCallback(async () => {
    try {
      setRecords(await listVisitorResults());
      setStorageMessage("");
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "Could not read this browser’s saved reports.");
    }
  }, []);

  const refreshEndpoint = useCallback(async () => {
    if (window.location.origin !== stableSiteOrigin) {
      setServiceMessage("Live analysis is available from the fixed public site. Saved reports on this browser remain available here.");
      setServiceUrl("");
      setIframeReady(false);
      return;
    }
    try {
      const response = await fetch(`${discoveryUrl}?t=${Math.floor(Date.now() / 10000)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The host is not reachable right now.");
      const current = await response.json() as { url?: unknown; online?: unknown; updated_at?: unknown };
      const origin = validTunnelUrl(current.url);
      const updated = typeof current.updated_at === "string" ? Date.parse(current.updated_at) : NaN;
      if (current.online !== true || !origin || !Number.isFinite(updated) || Date.now() - updated > 6 * 60 * 60 * 1000 || updated > Date.now() + 60_000) {
        setServiceMessage("The computer host is offline or its temporary address has expired. Saved reports remain available here.");
        serviceUrlRef.current = "";
        setServiceUrl("");
        setIframeReady(false);
        return;
      }
      setServiceMessage("Connected to the current temporary host. It may pause or change address.");
      if (serviceUrlRef.current !== origin) setIframeReady(false);
      serviceUrlRef.current = origin;
      setServiceUrl(origin);
    } catch {
      setServiceMessage("The computer host is temporarily unreachable. Saved reports remain available here.");
      serviceUrlRef.current = "";
      setServiceUrl("");
      setIframeReady(false);
    }
  }, []);

  useEffect(() => {
    const historyTimer = window.setTimeout(() => void reloadHistory(), 0);
    const pendingTimer = window.setTimeout(() => {
      setPending(readPendingVisitorJob());
      if (consumePendingVisitorExpiryNotice()) setPendingExpired(true);
    }, 0);
    const endpointTimer = window.setTimeout(() => void refreshEndpoint(), 0);
    const timer = window.setInterval(() => void refreshEndpoint(), 30_000);
    return () => { window.clearTimeout(historyTimer); window.clearTimeout(pendingTimer); window.clearTimeout(endpointTimer); window.clearInterval(timer); };
  }, [reloadHistory, refreshEndpoint]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !serviceOrigin) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (window.location.origin !== stableSiteOrigin || event.source !== frame.contentWindow || event.origin !== serviceOrigin || !event.data || typeof event.data !== "object") return;
      const message = event.data as Record<string, unknown>;
      if (message.type === "rfe:ready") {
        setIframeReady(true);
        const pendingJob = pending || readPendingVisitorJob();
        if (pendingJob) {
          setPending(pendingJob);
          frame.contentWindow?.postMessage({ type: "rfe:restore-job", jobId: pendingJob.capability || pendingJob.jobId }, serviceOrigin);
        } else {
          if (consumePendingVisitorExpiryNotice()) setPendingExpired(true);
          const record = records.find(item => item.id === selectedId);
          if (record) frame.contentWindow?.postMessage({ type: "rfe:show-saved", record }, serviceOrigin);
        }
        return;
      }
      if (message.type === "rfe:job-accepted") {
        if (typeof message.jobId !== "string" || !/^[a-f0-9]{64}$/i.test(message.jobId)) return;
        const capability = typeof message.capability === "string" && message.capability ? message.capability : message.jobId;
        if (!/^[a-f0-9]{64}$/i.test(capability)) return;
        const acceptedAt = typeof message.acceptedAt === "string" && Number.isFinite(Date.parse(message.acceptedAt)) ? message.acceptedAt : new Date().toISOString();
        const current = pending?.jobId === message.jobId ? pending : null;
        const next: PendingVisitorJob = { localId: current?.localId || crypto.randomUUID(), jobId: message.jobId, capability, createdAt: current?.createdAt || acceptedAt };
        try {
          savePendingVisitorJob(next);
          setPending(next);
          setPendingExpired(false);
          setStorageMessage("");
        } catch {
          setStorageMessage("Browser storage is unavailable. Keep this tab open until the result is saved; the check cannot be recovered after a refresh.");
        }
        return;
      }
      if (message.type === "rfe:job-finished") {
        const jobId = typeof message.jobId === "string" ? message.jobId : "";
        const capability = typeof message.capability === "string" ? message.capability : "";
        const current = pending && (pending.jobId === jobId || pending.capability === capability || pending.capability === jobId) ? pending : null;
        if (!current) return;
        const status = message.status === "completed" ? "completed" : message.status === "cancelled" ? "cancelled" : "failed";
        const rawResult = message.result;
        if (rawResult && (typeof rawResult !== "object" || Array.isArray(rawResult))) return;
        if (rawResult) {
          try {
            const serialized = JSON.stringify(rawResult);
            if (!serialized || serialized.length > 12 * 1024 * 1024) {
              setStorageMessage("The report is too large to save in this browser. Download or keep the result available in the open analysis tab.");
              return;
            }
          } catch {
            setStorageMessage("The report payload could not be read safely; no browser copy was saved.");
            return;
          }
        }
        let projected: unknown;
        try { projected = rawResult ? safeReportProjection(rawResult) : undefined; }
        catch (error) {
          setStorageMessage(error instanceof Error ? error.message : "The report payload could not be saved safely.");
          return;
        }
        if (status === "completed" && rawResult && (!projected || typeof projected !== "object" || !("report" in projected))) {
          setStorageMessage("The completed result did not contain a readable report. The pending capability was kept so you can check again.");
          return;
        }
        const safeError = typeof message.error === "string"
          ? message.error.replaceAll(current.capability, "[redacted]").replaceAll(current.jobId, "[redacted]").replace(/(?:[A-Za-z]:\\|\/)(?:[^\s:]+[\\/])+[^\s:]*/g, "[private path]").slice(0, 500)
          : "";
        const record: VisitorResult = {
          id: current.localId,
          createdAt: current.createdAt,
          status: status === "completed" && rawResult ? "completed" : status === "cancelled" ? "cancelled" : "failed",
          ...(status === "completed" && rawResult ? { result: projected } : {}),
          ...(safeError ? { error: safeError } : status === "completed" && !rawResult ? { error: "The service returned no report." } : {}),
        };
        void saveVisitorResult(record).then(() => {
          clearPendingVisitorJob(current.jobId);
          setPending(null);
          setSelectedId(record.id);
          setStorageMessage("");
          void reloadHistory();
        }).catch(error => {
          setStorageMessage(`The result is visible in this tab but could not be saved locally: ${error instanceof Error ? error.message : "storage error"}. Keep this page open and retry by refreshing only after saving succeeds.`);
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [serviceOrigin, pending, records, selectedId, reloadHistory]);

  const visibleRecords = records.filter(record => !search.trim() || safeSearchText(record).includes(search.trim().toLocaleLowerCase()));
  const selectedRecord = records.find(record => record.id === selectedId) || null;
  const openRecord = (record: VisitorResult) => {
    setSelectedId(record.id);
    if (iframeReady && iframeRef.current && serviceOrigin) iframeRef.current.contentWindow?.postMessage({ type: "rfe:show-saved", record }, serviceOrigin);
    else setServiceMessage("Saved report selected. It will open in the analysis panel when the host page is ready.");
  };
  const removeRecord = async (id: string) => {
    try {
      await deleteVisitorResult(id);
      if (selectedId === id) setSelectedId("");
      await reloadHistory();
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "Could not remove the local report.");
    }
  };
  const removeAll = async () => {
    try {
      await clearVisitorResults();
      setSelectedId("");
      await reloadHistory();
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "Could not clear local reports.");
    }
  };

  return <main className={styles.site}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} onClick={event => { event.preventDefault(); onHome(); }}><span className={styles.brandMark}>FR</span>Figure Relay</Link>
      <nav aria-label="Workspace navigation"><button onClick={onHome}>View cases</button><a href={githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a></nav>
    </header>
    <section className={`${styles.section} ${styles.visitorWorkspace}`}>
      <div className={styles.visitorHeading}><div><p className={styles.kicker}>PRIVATE TO THIS BROWSER</p><h1>Your figure checks</h1><p>Submit a public figure to the author’s computer, then return to reports saved in this browser—even after the temporary tunnel changes.</p></div><span className={styles.runBadge}>{records.length} saved</span></div>
      <div className={styles.visitorGrid}>
        <section className={styles.analysisPanel} aria-label="Live analysis">
          <div className={styles.analysisPanelHead}><div><b>Check a figure</b><p>{serviceMessage}</p></div><button className={styles.smallButton} onClick={() => void refreshEndpoint()}>Refresh connection</button></div>
          {selectedRecord && (!serviceUrl || !iframeReady) && <SavedVisitorReport record={selectedRecord} />}
          {serviceUrl ? <iframe key={serviceOrigin} ref={iframeRef} className={styles.analysisFrame} src={serviceUrl} title="Figure Relay live figure analysis" sandbox="allow-scripts allow-forms allow-same-origin" referrerPolicy="no-referrer" onLoad={() => setIframeReady(false)} /> : <div className={styles.offlinePanel}><b>Live analysis is unavailable</b><span>You can still search and open reports already saved on this device.</span></div>}
          <p className={styles.privacyNote}>Only the result report, A/B reader extractions, reconstruction and time are saved here. The original image and its filename are not stored in this history. Clearing a browser copy does not delete private audit records retained on the host computer.</p>
        </section>
        <section className={styles.historyPanel} aria-label="Saved visitor reports">
          <div className={styles.historyHead}><div><b>Saved checks</b><p>Stored only in this browser</p></div>{records.length > 0 && <button className={styles.textButton} onClick={() => void removeAll()}>Clear all</button>}</div>
          <label className={styles.historySearch}>Search reports<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reader notes or date" /></label>
          {pending && <div className={styles.pendingCard}><b>Check in progress</b><span>Trying to reconnect your saved request. It will not be submitted again.</span><small>The recovery link stays in this browser for up to six hours.</small>{!serviceUrl && <small>Reconnect the host or return later to check again.</small>}</div>}
          {pendingExpired && <div className={styles.pendingCard}><b>Pending recovery expired</b><span>The local recovery link expired after six hours and has been removed. If the run had not reached a terminal result, it can no longer be recovered. No duplicate check was submitted.</span></div>}
          {visibleRecords.length ? <ul className={styles.historyList}>{visibleRecords.map(record => <li key={record.id} className={selectedId === record.id ? styles.historySelected : ""}>
            <button className={styles.historyOpen} onClick={() => openRecord(record)}><span className={styles.cardMeta}><span>{new Date(record.createdAt).toLocaleString()}</span><b className={record.status === "completed" ? styles.completed : styles.failed}>{record.status}</b></span><strong>{historyTitle(record)}</strong><small>{record.error || (record.result && typeof record.result === "object" ? String((record.result as Record<string, unknown>).model || "Saved analysis report") : "No report payload was returned")}</small></button>
            <div className={styles.historyActions}><button onClick={() => downloadVisitorResult(record)}>Download JSON</button><button onClick={() => void removeRecord(record.id)}>Remove local copy</button></div>
          </li>)}</ul> : <div className={styles.historyEmpty}>{search ? "No saved reports match this search." : "No checks saved in this browser yet."}</div>}
          {storageMessage && <p className={styles.storageWarning} role="status">{storageMessage}</p>}
        </section>
      </div>
    </section>
    <footer className={styles.footer}><Link href="/" className={styles.brand} onClick={event => { event.preventDefault(); onHome(); }}>Figure Relay</Link><span>Host-computer analysis may pause or become unavailable · AI reader feedback requires human review</span><button onClick={onHome}>Return to cases</button></footer>
  </main>;
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

  const enterWorkbench = async () => {
    if (demoOnly) {
      setShowDemoInfo(false); setCaseData(null); setActive(true); syncUrl({ workspace: true }); return;
    }
    setShowDemoInfo(false); setCaseData(null); setActive(true); syncUrl({ workspace: true });
  };
  const selectCase = (item: CaseSummary) => { setActive(false); setShowDemoInfo(false); syncUrl({ caseId: item.id }); void openCase(item); };
  const retryIndex = () => { setError(""); window.location.reload(); };

  if (active && demoOnly) return <VisitorWorkspace onHome={goHome} />;
  if (active) return <main className={styles.workspace}><div className={styles.workspaceBar}><a className={styles.brand} href={asset("/")} onClick={event => { event.preventDefault(); goHome(); }}>Figure Relay</a><button className={styles.backButton} onClick={goHome}>← Back to home</button></div><Workbench /></main>;

  const selected = index?.cases.find(item => item.id === requestedCase) || null;
  const showDetail = Boolean(selected && (caseData || loading || error));
  return <main className={styles.site}>
    <header className={styles.header}>
      <a href={asset("/")} className={styles.brand} onClick={event => { event.preventDefault(); goHome(); }}><span className={styles.brandMark}>FR</span>Figure Relay</a>
      <nav aria-label="Main navigation"><a href="#cases" onClick={goHome}>View cases</a>{demoOnly && <button onClick={enterWorkbench}>Saved checks</button>}<button onClick={enterWorkbench}>Check my figure</button><a href={githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a></nav>
    </header>

    {showDemoInfo ? <section className={`${styles.section} ${styles.demoInfo}`}><p className={styles.kicker}>{onlineAnalysisUrl ? "HOST-COMPUTER TRIAL" : "PUBLIC DEMO · READ ONLY"}</p><h1>{onlineAnalysisUrl ? "The live host is temporarily unavailable." : "Online analysis is not connected yet."}</h1><p>{onlineAnalysisUrl ? "This free analysis service runs on the author's computer. It may pause, rotate its temporary address or go offline. Browse the recorded cases while it is unavailable, or try again later." : <>The public site currently shows saved historical replays. To check a figure locally, clone the repository, install project dependencies with <code>npm ci</code>, then start the app with <code>npm run dev</code>.</>}</p><div className={styles.buttonRow}><button className={styles.primaryButton} onClick={goHome}>Back to cases</button><a className={styles.secondaryButton} href={githubUrl} target="_blank" rel="noreferrer">Project on GitHub ↗</a></div></section> : showDetail ? <CaseDetail item={selected!} data={caseData} loading={loading} error={error} onBack={goHome} onRetry={() => void openCase(selected!)} /> : <>
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
      <footer className={styles.footer}><a href={asset("/")} className={styles.brand}>Figure Relay</a><span>{demoOnly && onlineAnalysisUrl ? "Live analysis: free host-computer trial · may pause or go offline" : "AI simulated reader feedback · saved replays · no human-memory measurement"}</span><button onClick={enterWorkbench}>Check my figure</button></footer>
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
