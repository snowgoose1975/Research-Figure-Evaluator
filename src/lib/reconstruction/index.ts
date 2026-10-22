import { Resvg } from "@resvg/resvg-js";
import type { MemoryRecord, RenderInput, RenderResult } from "../schemas";

export const RENDERER_VERSION = "0.2.1";
const WIDTH = 1200;
const COLORS = {
  ink: "#172b3a", muted: "#526579", line: "#9aabba", faint: "#eaf0f4",
  blue: "#dcecf8", blueStroke: "#397da8", green: "#e2f2e8", greenStroke: "#3b8c59",
  red: "#fff0ed", redStroke: "#c55245", gold: "#fff5d8", purple: "#f0eafb",
};
const FONT = 'font-family="Arial, Segoe UI, sans-serif"';
const TEXT_FONT: Record<string, string> = {
  title: `${FONT} font-size="27px" font-weight="700"`, meta: `${FONT} font-size="14px" font-weight="400"`,
  summary: `${FONT} font-size="15px" font-weight="400"`, body: `${FONT} font-size="14px" font-weight="400"`,
  small: `${FONT} font-size="11px" font-weight="400"`, nodeLabel: `${FONT} font-size="15px" font-weight="600"`,
  group: `${FONT} font-size="13px" font-weight="600"`, edge: `${FONT} font-size="11px" font-weight="400"`,
  section: `${FONT} font-size="18px" font-weight="700"`, plotTitle: `${FONT} font-size="18px" font-weight="700"`,
  tick: `${FONT} font-size="12px" font-weight="400"`, axis: `${FONT} font-size="15px" font-weight="400"`,
  legend: `${FONT} font-size="14px" font-weight="400"`,
};

type Box = { x: number; y: number; w: number; h: number };

function esc(value: unknown): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function wrap(value: string, maxChars: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) { lines.push(line); line = ""; }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
    } else if (!line) line = word;
    else if ((line + " " + word).length <= maxChars) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(text: string, x: number, y: number, maxChars: number, lineHeight = 19, className = "body", anchor = "start"): string {
  return wrap(text, maxChars).map((line, i) => `<text class="${className}" ${TEXT_FONT[className]} x="${x}" y="${y + i * lineHeight}" text-anchor="${anchor}">${esc(line)}</text>`).join("");
}

// Readers sometimes put the unit inside the axis label and also fill the unit field.
// Appending it twice changes what the reconstruction appears to claim, so the label wins.
function axisName(label: string, unit: string, scale: string): string {
  const trimmed = label.trim();
  // "none"/"n/a" are placeholders some readers use for a unitless axis; printing them
  // would turn an absence into a visible unit claim.
  const unitText = /^(none|n\/a|na|-|—)$/i.test(unit.trim()) ? "" : unit.trim();
  const shown = unitText && !trimmed.includes(`(${unitText})`) ? `${trimmed} (${unitText})` : trimmed;
  return `${shown} · ${scale}`;
}

function certaintyLabel(c: string): string {
  return ({ asserted: "asserted", hypothesized: "hypothesized", not_shown: "not shown", unknown: "unknown" } as Record<string, string>)[c] ?? `unknown (${c})`;
}

function niceTicks(min: number, max: number, scale: "linear" | "log"): number[] {
  if (scale === "log") {
    const lo = Math.ceil(Math.log10(min)); const hi = Math.floor(Math.log10(max));
    const ticks: number[] = [];
    for (let power = lo; power <= hi && ticks.length < 8; power++) ticks.push(10 ** power);
    if (!ticks.length) ticks.push(min, max);
    return ticks;
  }
  const raw = (max - min) / 5;
  const power = 10 ** Math.floor(Math.log10(Math.abs(raw) || 1));
  const fraction = raw / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-8 && ticks.length < 9; v += step) ticks.push(Number(v.toPrecision(6)));
  if (!ticks.length) return [min, max];
  return ticks;
}

function tickLabel(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 10000 || Math.abs(n) < 0.001) return n.toExponential(1);
  return Number(n.toPrecision(3)).toString();
}

export function projectForRender(memory: MemoryRecord): RenderInput {
  // Explicitly construct the renderer allowlist. Evidence/bboxes and any future fields never cross this boundary.
  return {
    title: memory.title,
    domain: memory.domain,
    figure_type: memory.figure_type,
    summary: memory.summary,
    graph: {
      nodes: memory.graph.nodes.map(({ id, label, aliases, group_id, semantic_position }) => ({ id, label, aliases: [...aliases], group_id, semantic_position: semantic_position ? { ...semantic_position } : null })),
      relations: memory.graph.relations.map(({ id, source_id, target_id, kind, direction, line_style, evidence_status, label }) => ({ id, source_id, target_id, kind, direction, line_style, evidence_status, label })),
      groups: memory.graph.groups.map(({ id, label }) => ({ id, label })),
      conditions: memory.graph.conditions.map(({ id, text, scope, target_ids }) => ({ id, text, scope, target_ids: [...target_ids] })),
    },
    plots: memory.plots.map(plot => ({ ...plot, x_axis: { ...plot.x_axis }, y_axis: { ...plot.y_axis }, series: plot.series.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })), notes: [...plot.notes] })),
    facts: memory.facts.map(({ id, subject, predicate, object, qualifiers, certainty, source_ids }) => ({ id, subject, predicate, object, qualifiers: [...qualifiers], certainty, source_ids: [...source_ids] })),
    uncertainties: memory.uncertainties.map(({ id, item_ids, note }) => ({ id, item_ids: [...item_ids], note })),
  };
}

export async function renderMemory(input: RenderInput): Promise<RenderResult> {
  const pieces: string[] = [];
  const rendered = new Set<string>();
  const unsupported = new Set<string>();
  const warnings: string[] = [];
  const addItem = (id: string, svg: string) => { pieces.push(`<g data-item-id="${esc(id)}">${svg}</g>`); rendered.add(id); };
  const markUnsupported = (id: string, why: string) => { unsupported.add(id); warnings.push(`${id}: ${why}`); };

  let y = 40;
  const title = input.title || "Untitled scientific figure";
  const titleLines = wrap(title, 68);
  pieces.push(titleLines.map((line, i) => `<text class="title" ${TEXT_FONT.title} x="56" y="${y + i * 32}">${esc(line)}</text>`).join(""));
  y += titleLines.length * 32 + 4;
  pieces.push(`<text class="meta" ${TEXT_FONT.meta} x="58" y="${y}">${esc(input.domain)} · ${esc(input.figure_type)}</text>`);
  y += 20;
  if (input.summary) { y += 8; pieces.push(textLines(input.summary, 58, y, 115, 20, "summary")); y += Math.max(1, wrap(input.summary, 115).length) * 20; }
  y += 16;

  const nodes = input.graph.nodes;
  const itemLabels = new Map<string, string>([
    ...nodes.map(item => [item.id, item.label] as [string, string]),
    ...input.graph.relations.map(item => [item.id, item.label || item.kind] as [string, string]),
    ...input.graph.groups.map(item => [item.id, item.label] as [string, string]),
    ...input.graph.conditions.map(item => [item.id, item.text] as [string, string]),
    ...input.plots.map(item => [item.id, item.title] as [string, string]),
    ...input.plots.flatMap(plot => plot.series.map(item => [item.id, item.label] as [string, string])),
    ...input.facts.map(item => [item.id, item.subject] as [string, string]),
    ...input.uncertainties.map(item => [item.id, item.note] as [string, string]),
  ]);
  const nodeBoxes = new Map<string, Box>();
  const relationNotices: { id: string; text: string }[] = [];
  const cardW = 178; const gapX = 72; const gapY = 72; const left = 74;
  const cols = Math.max(1, Math.min(5, Math.floor((WIDTH - 2 * left + gapX) / (cardW + gapX))));
  const nodeHeights = nodes.map(node => Math.max(74, 34 + wrap(node.label, 23).length * 20 + (node.aliases.length ? wrap(`Aliases: ${node.aliases.join(", ")}`, 27).length * 14 : 0)));
  const useSemantic = (input.figure_type === "structure" || input.figure_type === "geometry") && nodes.some(n => n.semantic_position !== null);
  const positioned = nodes.map((node, i) => ({ node, i })).filter(({ node }) => useSemantic && node.semantic_position !== null);
  const unpositioned = nodes.map((node, i) => ({ node, i })).filter(({ node }) => !useSemantic || node.semantic_position === null);
  const autoRows = Math.ceil(unpositioned.length / cols);
  const autoRowHeights = Array.from({ length: autoRows }, (_, row) => Math.max(0, ...unpositioned.slice(row * cols, (row + 1) * cols).map(({ i }) => nodeHeights[i])));
  const autoRowsHeight = autoRowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, autoRows - 1) * gapY;
  const groupHeaderHeight = Math.max(0, ...input.graph.groups.map(group => wrap(group.label, 18).length * 16 + 22));
  const graphTop = y + Math.max(30, groupHeaderHeight + 12);
  const positionRange = positioned.length ? Math.max(...positioned.map(({ node }) => node.semantic_position!.y)) - Math.min(...positioned.map(({ node }) => node.semantic_position!.y)) : 0;
  let semanticCanvasH = 600;
  for (let i = 0; i < positioned.length; i++) for (let j = i + 1; j < positioned.length; j++) {
    const a = positioned[i]; const b = positioned[j];
    const ax = 80 + a.node.semantic_position!.x * (WIDTH - 160 - cardW);
    const bx = 80 + b.node.semantic_position!.x * (WIDTH - 160 - cardW);
    if (ax < bx + cardW && ax + cardW > bx) {
      const dy = Math.abs(a.node.semantic_position!.y - b.node.semantic_position!.y);
      if (dy > 0) semanticCanvasH = Math.max(semanticCanvasH, (nodeHeights[a.i] + nodeHeights[b.i]) / (2 * dy) + gapY / dy);
    }
  }
  const semanticNodeTail = positioned.length ? Math.max(...positioned.map(({ i }) => nodeHeights[i])) + gapY : 0;
  const graphH = (useSemantic ? semanticCanvasH + semanticNodeTail + (unpositioned.length ? gapY : 0) : 0) + autoRowsHeight + 12;
  nodes.forEach((node, i) => {
    let x: number; let ny: number;
    const isPositioned = useSemantic && node.semantic_position !== null;
    const autoIndex = unpositioned.findIndex(item => item.i === i);
    const row = Math.floor(autoIndex / cols);
    const rowTop = graphTop + (useSemantic ? semanticCanvasH + (unpositioned.length ? gapY : 0) : 0) + autoRowHeights.slice(0, row).reduce((sum, h) => sum + h + gapY, 0);
    if (isPositioned && node.semantic_position) {
      x = 80 + node.semantic_position.x * (WIDTH - 160 - cardW);
      const minY = Math.min(...positioned.map(({ node: placed }) => placed.semantic_position!.y));
      ny = graphTop + (positionRange ? (node.semantic_position.y - minY) / positionRange * semanticCanvasH : semanticCanvasH / 2 - nodeHeights[i] / 2);
    } else {
      const col = i % cols;
      x = left + col * (cardW + gapX);
      ny = rowTop;
    }
    nodeBoxes.set(node.id, { x, y: ny, w: cardW, h: nodeHeights[i] });
  });
  if (useSemantic) {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodeBoxes.get(nodes[i].id)!; const b = nodeBoxes.get(nodes[j].id)!;
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
        markUnsupported(nodes[i].id, `semantic position overlaps node ${nodes[j].label}`);
        markUnsupported(nodes[j].id, `semantic position overlaps node ${nodes[i].label}`);
      }
    }
  }

  // Show one-layer group containers behind member nodes.
  for (const group of input.graph.groups) {
    const members = nodes.filter(n => n.group_id === group.id).map(n => nodeBoxes.get(n.id)).filter((b): b is Box => Boolean(b));
    if (!members.length) { markUnsupported(group.id, "group has no visible member nodes"); continue; }
    const minX = Math.min(...members.map(b => b.x)) - 18;
    const maxX = Math.max(...members.map(b => b.x + b.w)) + 18; const maxY = Math.max(...members.map(b => b.y + b.h)) + 16;
    const labelChars = Math.max(18, Math.floor((maxX - minX - 24) / 7));
    const groupLabelLines = wrap(group.label, labelChars);
    const groupTop = Math.min(...members.map(b => b.y)) - (groupLabelLines.length * 16 + 22);
    addItem(group.id, `<rect x="${minX}" y="${groupTop}" width="${maxX - minX}" height="${maxY - groupTop}" rx="15" fill="#f5f8fa" stroke="#afbfca" stroke-dasharray="7 5"/>${textLines(group.label, minX + 12, groupTop + 20, labelChars, 16, "group")}`);
  }

  for (const relation of input.graph.relations) {
    const a = nodeBoxes.get(relation.source_id); const b = nodeBoxes.get(relation.target_id);
    if (!a || !b) { markUnsupported(relation.id, "relation endpoint is not rendered"); continue; }
    if (relation.source_id === relation.target_id) {
      markUnsupported(relation.id, "self-relations are not geometrically represented");
      relationNotices.push({ id: relation.id, text: `${relation.label || relation.kind} · ${relation.kind} · ${relation.direction} · ${relation.line_style} line · ${certaintyLabel(relation.evidence_status)}` });
      continue;
    }
    const p1 = { x: a.x + a.w / 2, y: a.y + a.h / 2 }; const p2 = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const dx = p2.x - p1.x; const dy = p2.y - p1.y; const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len; const uy = dy / len;
    const rectExit = (box: Box) => Math.min(ux === 0 ? Infinity : box.w / 2 / Math.abs(ux), uy === 0 ? Infinity : box.h / 2 / Math.abs(uy));
    const startDistance = rectExit(a); const endDistance = rectExit(b);
    const start = { x: p1.x + ux * (startDistance + 1), y: p1.y + uy * (startDistance + 1) };
    const end = { x: p2.x - ux * (endDistance + 3), y: p2.y - uy * (endDistance + 3) };
    const stroke = relation.kind === "promotes" ? COLORS.greenStroke : relation.kind === "inhibits" ? COLORS.redStroke : COLORS.blueStroke;
    const dash = relation.line_style === "dashed" ? ` stroke-dasharray="8 6"` : relation.line_style === "unknown" ? ` stroke-dasharray="2 5"` : "";
    let line = `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${stroke}" stroke-width="2.5"${dash}/>`;
    const directed = relation.direction === "directed";
    if (directed && relation.kind === "inhibits") {
      // Inhibition is a blunt T bar, never a positive arrow.
      const tx = end.x - ux * 8; const ty = end.y - uy * 8; const px = -uy * 9; const py = ux * 9;
      line += `<line x1="${tx + px}" y1="${ty + py}" x2="${tx - px}" y2="${ty - py}" stroke="${stroke}" stroke-width="4"/>`;
    } else if (directed) {
      const px = -uy * 7; const py = ux * 7;
      line += `<polygon points="${end.x},${end.y} ${end.x - ux * 15 + px},${end.y - uy * 15 + py} ${end.x - ux * 15 - px},${end.y - uy * 15 - py}" fill="${stroke}"/>`;
    }
    const relationText = relation.label || relation.kind;
    const mx = (start.x + end.x) / 2; const my = (start.y + end.y) / 2 - 9;
    const shortLabel = relationText.length > 24 ? `${relationText.slice(0, 21)}…` : relationText;
    addItem(relation.id, `${line}<rect x="${mx - 80}" y="${my - 14}" width="160" height="20" rx="8" fill="white" fill-opacity="0.96"/><text class="edge" ${TEXT_FONT.edge} x="${mx}" y="${my}" text-anchor="middle">${esc(shortLabel)}</text>`);
  }

  for (const node of nodes) {
    const box = nodeBoxes.get(node.id)!;
    const fill = node.group_id ? COLORS.purple : COLORS.blue;
    const aliases = node.aliases.length ? `Aliases: ${node.aliases.join(", ")}` : "";
    const lines = wrap(node.label, 23);
    const content = lines.map((line, i) => `<text class="nodeLabel" ${TEXT_FONT.nodeLabel} x="${box.x + box.w / 2}" y="${box.y + 27 + i * 20}" text-anchor="middle">${esc(line)}</text>`).join("");
    const aliasSvg = aliases ? textLines(aliases, box.x + box.w / 2, box.y + 27 + lines.length * 20, 27, 14, "small", "middle") : "";
    addItem(node.id, `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="13" fill="${fill}" stroke="${COLORS.blueStroke}" stroke-width="1.5"/>${content}${aliasSvg}`);
  }

  if (nodes.length) y = Math.max(y, graphTop + graphH + 4);
  for (const notice of relationNotices) {
    addItem(notice.id, `<rect x="58" y="${y}" width="1084" height="42" rx="9" fill="#fff5d8" stroke="#d6ad47"/><text class="body" ${TEXT_FONT.body} x="76" y="${y + 26}">Self relation not drawn: ${esc(notice.text)}</text>`);
    y += 52;
  }
  if (input.graph.relations.length) {
    pieces.push(`<text class="section" ${TEXT_FONT.section} x="58" y="${y + 8}">Relations</text>`); y += 22;
    for (const relation of input.graph.relations) {
      const source = itemLabels.get(relation.source_id) ?? "unresolved source";
      const target = itemLabels.get(relation.target_id) ?? "unresolved target";
      const details = `${source} → ${target} · ${relation.label || relation.kind} · kind: ${relation.kind} · direction: ${relation.direction} · certainty: ${certaintyLabel(relation.evidence_status)} · line style: ${relation.line_style}`;
      const lines = wrap(details, 112); const h = Math.max(52, 20 + lines.length * 18);
      addItem(relation.id, `<rect x="58" y="${y}" width="1084" height="${h}" rx="9" fill="#f1f6f9" stroke="#c4d2dc"/>${textLines(details, 76, y + 23, 112, 18, "body")}`);
      y += h + 8;
    }
  }

  // Explicit condition cards retain scope and target association in visible text.
  for (const condition of input.graph.conditions) {
    const targetNames = condition.target_ids.map(id => itemLabels.get(id) ?? "unresolved target");
    const label = `${condition.scope} condition${targetNames.length ? ` for ${targetNames.join(", ")}` : ""}: ${condition.text}`;
    const conditionLines = wrap(label, 118); const conditionHeight = Math.max(56, 28 + conditionLines.length * 18);
    addItem(condition.id, `<rect x="58" y="${y}" width="1084" height="${conditionHeight}" rx="10" fill="${COLORS.gold}" stroke="#d6ad47"/>${textLines(label, 76, y + 23, 118, 18, "body")}`);
    y += conditionHeight + 12;
  }

  if (input.plots.length) {
    y += 16;
    pieces.push(`<text class="section" ${TEXT_FONT.section} x="58" y="${y + 8}">Quantitative relationships</text>`); y += 24;
    const singlePlot = input.plots.length === 1;
    const plotW = singlePlot ? 1084 : 526; const plotH = singlePlot ? 540 : 450; const plotGap = 54;
    input.plots.forEach((plot, idx) => {
      const x = singlePlot ? 58 : 58 + (idx % 2) * (plotW + plotGap); const py = y + Math.floor(idx / 2) * (plotH + 24);
      const xAxis = plot.x_axis; const yAxis = plot.y_axis;
      const scaleKnown = xAxis.scale !== "unknown" && yAxis.scale !== "unknown";
      if (!scaleKnown) markUnsupported(plot.id, "one or more axis scales are unknown; data-space mapping is withheld");
      const plotRendered = scaleKnown;
      const legendWidth = singlePlot ? 260 : 142;
      const leftX = x + 82; const rightX = x + plotW - legendWidth; const topY = py + 66; const bottomY = py + plotH - 150;
      const mapX = (v: number) => xAxis.scale === "log" ? leftX + (Math.log10(v) - Math.log10(xAxis.min)) / (Math.log10(xAxis.max) - Math.log10(xAxis.min)) * (rightX - leftX) : leftX + (v - xAxis.min) / (xAxis.max - xAxis.min) * (rightX - leftX);
      const mapY = (v: number) => yAxis.scale === "log" ? bottomY - (Math.log10(v) - Math.log10(yAxis.min)) / (Math.log10(yAxis.max) - Math.log10(yAxis.min)) * (bottomY - topY) : bottomY - (v - yAxis.min) / (yAxis.max - yAxis.min) * (bottomY - topY);
      let svg = `<rect x="${x}" y="${py}" width="${plotW}" height="${plotH}" rx="14" fill="white" stroke="#c3d0d9"/><text class="plotTitle" ${TEXT_FONT.plotTitle} x="${x + 18}" y="${py + 32}">${esc(plot.title)}</text>`;
      if (plotRendered) {
        svg += `<line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${bottomY}" stroke="${COLORS.ink}" stroke-width="1.6"/><line x1="${leftX}" y1="${bottomY}" x2="${rightX}" y2="${bottomY}" stroke="${COLORS.ink}" stroke-width="1.6"/>`;
        for (const tick of niceTicks(xAxis.min, xAxis.max, xAxis.scale as "linear" | "log")) {
          const tx = mapX(tick); svg += `<line x1="${tx}" y1="${bottomY}" x2="${tx}" y2="${bottomY + 5}" stroke="${COLORS.ink}"/><text class="tick" ${TEXT_FONT.tick} x="${tx}" y="${bottomY + 20}" text-anchor="middle">${esc(tickLabel(tick))}</text>`;
        }
        for (const tick of niceTicks(yAxis.min, yAxis.max, yAxis.scale as "linear" | "log")) {
          const ty = mapY(tick); svg += `<line x1="${leftX - 5}" y1="${ty}" x2="${leftX}" y2="${ty}" stroke="${COLORS.ink}"/><text class="tick" ${TEXT_FONT.tick} x="${leftX - 9}" y="${ty + 4}" text-anchor="end">${esc(tickLabel(tick))}</text>`;
        }
        const xName = axisName(xAxis.label, xAxis.unit, xAxis.scale);
        const yName = axisName(yAxis.label, yAxis.unit, yAxis.scale);
        svg += `<text class="axis" ${TEXT_FONT.axis} x="${(leftX + rightX) / 2}" y="${bottomY + 50}" text-anchor="middle">${esc(xName)}</text><text class="axis" ${TEXT_FONT.axis} transform="translate(${x + 22},${(topY + bottomY) / 2}) rotate(-90)" text-anchor="middle">${esc(yName)}</text>`;
      } else {
        svg += `<rect x="${x + 24}" y="${py + 52}" width="${plotW - 48}" height="${plotH - 90}" rx="10" fill="#fff5d8"/><text class="body" ${TEXT_FONT.body} x="${x + 42}" y="${py + 87}">Plot not drawn: axis scale is unknown.</text>`;
      }
      let legendY = py + 82;
      plot.series.forEach((series, si) => {
        const color = ["#3479a8", "#d65b4a", "#459568", "#9369b5", "#d18a2d", "#3d9b9b"][si % 6];
        const validScale = plotRendered;
        const validPoints = series.points.filter(p => p.x >= xAxis.min && p.x <= xAxis.max && p.y >= yAxis.min && p.y <= yAxis.max && (xAxis.scale !== "log" || p.x > 0) && (yAxis.scale !== "log" || p.y > 0));
        if (!validScale) markUnsupported(series.id, "series coordinates cannot be mapped while axis scale is unknown");
        else if (validPoints.length !== series.points.length) markUnsupported(series.id, "one or more series points lie outside the declared axis domain");
        let pointsSvg = "";
        if (validScale) {
          const coords = validPoints.map(p => `${mapX(p.x)},${mapY(p.y)}`).join(" ");
          if (series.style !== "scatter" && validPoints.length > 1) pointsSvg += `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2.5"${series.style === "dashed" ? ` stroke-dasharray="7 5"` : ""}/>`;
          for (const p of validPoints) pointsSvg += `<circle cx="${mapX(p.x)}" cy="${mapY(p.y)}" r="4" fill="white" stroke="${color}" stroke-width="2.5"/>`;
        }
        const outOfRangeCount = series.points.length - validPoints.length;
        const label = `${series.label}${series.approximate ? " · approximate" : ""}${outOfRangeCount ? ` · ${outOfRangeCount} out-of-range point(s) not plotted` : ""}`;
        const legendLeft = x + plotW - (singlePlot ? 238 : 128);
        const legendChars = singlePlot ? 32 : 18;
        svg += `<g data-item-id="${esc(series.id)}"><line x1="${legendLeft}" y1="${legendY - 4}" x2="${legendLeft + 18}" y2="${legendY - 4}" stroke="${color}" stroke-width="2.5"/>${textLines(label, legendLeft + 26, legendY, legendChars, 18, "legend")}${pointsSvg}</g>`;
        legendY += Math.max(26, wrap(label, legendChars).length * 18 + 6);
      });
      if (plot.notes.length) svg += textLines(`Notes: ${plot.notes.join("; ")}`, x + 18, py + plotH - 34, singlePlot ? 145 : 75, 18, "small");
      if (plotRendered) addItem(plot.id, svg);
      else { // The panel and title are still visibly disclosed as unsupported.
        pieces.push(`<g data-item-id="${esc(plot.id)}">${svg}</g>`);
      }
      for (const series of plot.series) if (plotRendered && !unsupported.has(series.id)) rendered.add(series.id);
    });
    y += Math.ceil(input.plots.length / 2) * (plotH + 24);
  }

  if (input.facts.length) {
    y += 16;
    pieces.push(`<text class="section" ${TEXT_FONT.section} x="58" y="${y + 8}">Remembered facts and mathematical statements</text>`); y += 22;
    for (const fact of input.facts) {
      const statements = [`${fact.subject} — ${fact.predicate}: ${fact.object}`, `Certainty: ${certaintyLabel(fact.certainty)}`];
      if (fact.qualifiers.length) statements.push(`Qualifiers: ${fact.qualifiers.join("; ")}`);
      if (fact.source_ids.length) statements.push(`References: ${fact.source_ids.map(id => itemLabels.get(id) ?? "unresolved reference").join("; ")}`);
      const body = statements.join(" · "); const lines = wrap(body, 112); const h = Math.max(64, 24 + lines.length * 18);
      addItem(fact.id, `<rect x="58" y="${y}" width="1084" height="${h}" rx="10" fill="#f3f0fa" stroke="#b6a2d7"/>${textLines(body, 76, y + 24, 112, 18, "body")}`);
      y += h + 10;
    }
  }

  for (const uncertainty of input.uncertainties) {
    y += 8;
    const names = uncertainty.item_ids.map(id => itemLabels.get(id) ?? "unresolved item");
    const body = `${names.length ? `Uncertainty about ${names.join(", ")}: ` : "Uncertainty: "}${uncertainty.note}`;
    const h = Math.max(58, 24 + wrap(body, 112).length * 18);
    addItem(uncertainty.id, `<rect x="58" y="${y}" width="1084" height="${h}" rx="10" fill="#fff3e6" stroke="#d99654"/>${textLines(body, 76, y + 24, 112, 18, "body")}`);
    y += h + 10;
  }

  if (!nodes.length && !input.plots.length && !input.facts.length) {
    pieces.push(`<text class="body" ${TEXT_FONT.body} x="58" y="${y}">No readable visual content was supplied for reconstruction.</text>`);
    warnings.push("No graph nodes, plots, or facts were provided.");
  }

  const allIds = [
    ...input.graph.nodes.map(x => x.id), ...input.graph.relations.map(x => x.id), ...input.graph.groups.map(x => x.id),
    ...input.graph.conditions.map(x => x.id), ...input.plots.flatMap(p => [p.id, ...p.series.map(s => s.id)]),
    ...input.facts.map(x => x.id), ...input.uncertainties.map(x => x.id),
  ];
  for (const id of allIds) if (!rendered.has(id) && !unsupported.has(id)) markUnsupported(id, "semantic item was not represented by visible output");

  const height = Math.max(240, Math.ceil(y + 40));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}"><defs><style>
    .title{fill:${COLORS.ink}}.meta{fill:${COLORS.muted}}.summary,.body{fill:${COLORS.ink}}.small{fill:${COLORS.muted}}.nodeLabel{fill:${COLORS.ink}}.group{fill:${COLORS.muted}}.edge{fill:${COLORS.ink}}.section,.plotTitle{fill:${COLORS.ink}}.tick{fill:${COLORS.muted}}.axis,.legend{fill:${COLORS.ink}}
  </style></defs><rect width="100%" height="100%" fill="#ffffff"/>${pieces.join("")}</svg>`;
  const png = Buffer.from(new Resvg(svg, {
    fitTo: { mode: "original" }, background: "#ffffff",
    font: { loadSystemFonts: true, defaultFontFamily: "Arial", sansSerifFamily: "Arial" },
  }).render().asPng());
  return {
    svg, png, width: WIDTH, height,
    rendered_item_ids: [...rendered], unsupported_item_ids: [...unsupported], warnings,
    structural_audit: allIds.length === 0 ? "failed" : unsupported.size ? "incomplete" : "complete", visual_review: "not_reviewed", renderer_version: RENDERER_VERSION,
  };
}
