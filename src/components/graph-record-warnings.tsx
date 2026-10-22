export function GraphRecordWarnings({ audit }: { audit?: unknown }) {
  if (!audit || typeof audit !== "object") return null;
  const value = audit as Record<string, unknown>;
  const groups = [["Reader A · duplicate connection records", value.duplicate_edges_a, true], ["Reader B · duplicate connection records", value.duplicate_edges_b, true], ["Reader A · connections recorded in both directions", value.opposing_edges_a, false], ["Reader B · connections recorded in both directions", value.opposing_edges_b, false]] as const;
  const populated = groups.flatMap(([title, entries, duplicate]) => {
    if (!Array.isArray(entries)) return [];
    const rows = entries.filter((edge): edge is Record<string, unknown> => Boolean(edge) && typeof edge === "object" && typeof edge.source === "string" && typeof edge.target === "string");
    return rows.length ? [{ title, rows, duplicate }] : [];
  });
  if (!populated.length) return null;
  return <section aria-label="Extraction record flags"><h3>Connections to review first</h3><p>These flags describe the saved extractions. Two-way connections may be intentional in the source figure; check the original before interpreting them as errors.</p>{populated.map(group => <div key={group.title}><strong>{group.title}</strong><ul>{group.rows.map((edge, index) => <li key={index}>{String(edge.source)} → {String(edge.target)} · {String(edge.kind)}{group.duplicate ? ` · ${String(edge.count)} records of the same connection` : ""}</li>)}</ul></div>)}</section>;
}
