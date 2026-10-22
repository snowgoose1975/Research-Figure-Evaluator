import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { EXAMPLES, listExamples } from "../src/lib/examples";
import type { MemoryRecord, Plot } from "../src/lib/schemas";

const W = 1200;
const H = 700;
const ink = "#17364a";
const muted = "#718794";
const teal = "#168a83";
const amber = "#d79436";
const light = "#dce6e8";
const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const line = (x1: number, y1: number, x2: number, y2: number, color = light, width = 2, extra = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const text = (x: number, y: number, value: string, size = 18, color = ink, weight = 500, extra = "") => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(value)}</text>`;
function shell(title: string, subtitle: string, challenged: boolean, body: string) {
  const labelOpacity = challenged ? ".55" : "1";
  const small = challenged ? 13 : 16;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${teal}"/></marker><linearGradient id="paper" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#f8faf9"/></linearGradient></defs><rect width="1200" height="700" rx="0" fill="url(#paper)"/><rect x="42" y="38" width="1116" height="624" rx="18" fill="#fff" stroke="#e6ecec"/><rect x="42" y="38" width="7" height="624" rx="4" fill="${teal}"/>${text(84, 91, title, 27, ink, 700)}${text(84, 121, subtitle, 15, muted, 400)}<circle cx="1108" cy="83" r="18" fill="#e8f4f2"/><path d="M1100 83h16m-8-8v16" stroke="${teal}" stroke-width="2" stroke-linecap="round"/>${line(84, 143, 1116, 143, "#e9eeee", 1)}${body}${line(84, 620, 1116, 620, "#e9eeee", 1)}${text(84, 645, "SELF-DRAWN EDUCATIONAL ILLUSTRATION", 10, muted, 700, `letter-spacing="1.4" opacity="${labelOpacity}"`)}${text(1116, 645, "CC0 1.0", 10, muted, 700, `text-anchor="end" opacity="${labelOpacity}"`)}${text(84, 598, "Original educational illustration · not experimental data", small, muted, 400, `opacity="${labelOpacity}"`)}</svg>`;
}
function oscillator(challenged: boolean) {
  const forceOpacity = challenged ? ".48" : "1";
  const forceSize = challenged ? 14 : 18;
  const spring = "M257 322 l25 -28 25 56 25 -56 25 56 25 -56 25 28";
  return shell("Mass–spring–damper oscillator", "Unforced motion · linear spring and viscous damping", challenged, `
    <rect x="135" y="245" width="34" height="250" rx="4" fill="#dfe9e9" stroke="#b9cbcd"/><path d="M143 260l18 18m-18 18 18 18m-18 18 18 18m-18 18 18 18m-18 18 18 18m-18 18 18 18" stroke="#a9bdbf" stroke-width="2"/>
    ${line(169, 335, 257, 335, "#8ea5a8", 3)}<path d="${spring}" fill="none" stroke="${teal}" stroke-width="4" stroke-linejoin="round"/>${line(407, 335, 432, 335, "#8ea5a8", 3)}<path d="M169 430h38v-18h50v36h50v-18h50" fill="none" stroke="${amber}" stroke-width="5" stroke-linejoin="round"/>${line(357, 430, 432, 430, "#8ea5a8", 3)}
    <rect x="432" y="265" width="300" height="230" rx="20" fill="#edf4f3" stroke="#b8cecc" stroke-width="2"/><rect x="465" y="296" width="234" height="168" rx="12" fill="#fff" stroke="#d5e2e1"/><text x="582" y="364" text-anchor="middle" fill="${ink}" font-size="30" font-weight="700">mass m</text><text x="582" y="403" text-anchor="middle" fill="${muted}" font-size="15">displacement x(t)</text>
    ${line(735, 380, 784, 380, teal, 3, 'marker-end="url(#arrow)"')}${text(787, 386, "x", 16, teal, 700)}
    <rect x="812" y="214" width="257" height="82" rx="11" fill="#f0f7f6" stroke="#d9e9e6"/><text x="835" y="247" font-size="17" fill="${ink}" font-weight="700" opacity="${forceOpacity}">Linear spring</text><text x="835" y="278" font-size="${forceSize}" fill="${teal}" font-weight="600" opacity="${forceOpacity}">Fₛ = −kx</text>
    <rect x="812" y="307" width="257" height="82" rx="11" fill="#fff8ed" stroke="#f0e3ce"/><text x="835" y="340" font-size="17" fill="${ink}" font-weight="700" opacity="${forceOpacity}">Viscous damper</text><text x="835" y="371" font-size="${forceSize}" fill="#b77927" font-weight="600" opacity="${forceOpacity}">Fᵈ = −cv</text>
    <rect x="812" y="420" width="257" height="74" rx="11" fill="#f6f8f8" stroke="#e4ebeb"/><text x="835" y="451" font-size="14" fill="${muted}" font-weight="600">Unforced equation</text><text x="835" y="480" font-size="21" fill="${ink}" font-weight="700">m x′′ = Fₛ + Fᵈ</text>
    ${text(258, 317, "k", 14, muted, 600, `opacity="${forceOpacity}"`)}${text(258, 414, "c", 14, muted, 600, `opacity="${forceOpacity}"`)}${text(210, 530, "Fixed support", 14, muted, 500)}${text(535, 530, "No external driving force", 14, muted, 500)}`);
}
function plotSvg(title: string, plot: Plot, challenged: boolean, annotations: string[]) {
  const left = 160, top = 205, width = 800, height = 330;
  const xmin = plot.x_axis.min, xmax = plot.x_axis.max, ymin = plot.y_axis.min, ymax = plot.y_axis.max;
  const px = (x: number) => left + (x - xmin) / (xmax - xmin) * width;
  const py = (y: number) => top + height - (y - ymin) / (ymax - ymin) * height;
  const faint = challenged ? ".52" : "1";
  const axisSize = challenged ? 14 : 17;
  let body = `${line(left, top + height, left + width, top + height, "#8fa4aa", 2)}${line(left, top, left, top + height, "#8fa4aa", 2)}`;
  for (let i = 0; i <= 4; i++) {
    const x = xmin + (xmax - xmin) * i / 4;
    const y = ymin + (ymax - ymin) * i / 4;
    body += `${line(px(x), top, px(x), top + height, "#edf1f1", 1)}${line(left, py(y), left + width, py(y), "#edf1f1", 1)}${text(px(x), top + height + 24, Number(x.toPrecision(3)).toString(), 12, muted, 500, 'text-anchor="middle"')}${text(left - 14, py(y) + 4, Number(y.toPrecision(3)).toString(), 12, muted, 500, 'text-anchor="end"')}`;
  }
  const colors = [teal, amber, "#697fb3", "#be6c67"];
  plot.series.forEach((series, si) => {
    const points = series.points.map(point => `${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`).join(" ");
    body += `<polyline points="${points}" fill="none" stroke="${colors[si % colors.length]}" stroke-width="${challenged ? 3 : 4}" stroke-linecap="round" stroke-linejoin="round" opacity="${challenged ? ".77" : "1"}"/>`;
  });
  body += text(left + width / 2, 582, `${plot.x_axis.label} (${plot.x_axis.unit})`, axisSize, ink, 600, 'text-anchor="middle" opacity="' + faint + '"');
  body += `<text x="74" y="${top + height / 2}" transform="rotate(-90 74 ${top + height / 2})" text-anchor="middle" fill="${ink}" font-size="${axisSize}" font-weight="600" opacity="${faint}">${esc(`${plot.y_axis.label} (${plot.y_axis.unit})`)}</text>`;
  body += `<rect x="980" y="${top + 8}" width="137" height="${challenged ? 151 : 166}" rx="11" fill="#f8faf9" stroke="#e5eceb"/>`;
  plot.series.forEach((series, si) => {
    const yy = top + 40 + si * 42;
    body += line(998, yy, 1026, yy, colors[si % colors.length], 4, `opacity="${challenged ? ".5" : "1"}"`);
    body += text(1035, yy + 5, series.label, challenged ? 12 : 14, ink, 600, `opacity="${faint}"`);
  });
  const eqSize = challenged ? 11 : 12;
  annotations.forEach((label, i) => { body += text(988, top + 226 + i * 24, label, eqSize, muted, 500, `opacity="${faint}"`); });
  const noteY = top + 276;
  body += `<rect x="980" y="${noteY}" width="137" height="62" rx="8" fill="#fff8e9" stroke="#f1e6cd"/>${text(992, noteY + 23, "Illustrative", 12, "#896c39", 700, `opacity="${faint}"`)}${text(992, noteY + 42, "teaching plot", 11, "#896c39", 500, `opacity="${faint}"`)}`;
  return shell(title, plot.title, challenged, body);
}
function layered(challenged: boolean) {
  const alpha = challenged ? ".54" : "1";
  const labelSize = challenged ? 26 : 34;
  return shell("Idealized A / B / A layered stack", "Schematic cross-section · no real material properties implied", challenged, `
    <text x="600" y="194" fill="${muted}" font-size="14" text-anchor="middle" letter-spacing="1.3">VERTICAL LAYER ORDER</text>
    <rect x="365" y="229" width="470" height="104" rx="14" fill="#e9f2f1" stroke="#bad0ce" stroke-width="2"/><rect x="365" y="351" width="470" height="104" rx="14" fill="#f3e7d4" stroke="#dec59d" stroke-width="2" opacity="${alpha}"/><rect x="365" y="473" width="470" height="104" rx="14" fill="#e9f2f1" stroke="#bad0ce" stroke-width="2"/>
    <text x="600" y="293" text-anchor="middle" fill="${ink}" font-size="${labelSize}" font-weight="700">A</text><text x="600" y="415" text-anchor="middle" fill="${ink}" font-size="${labelSize}" font-weight="700" opacity="${alpha}">B</text><text x="600" y="537" text-anchor="middle" fill="${ink}" font-size="${labelSize}" font-weight="700">A</text>
    <path d="M860 310h16v62h-16M860 432h16v62h-16" fill="none" stroke="${teal}" stroke-width="${challenged ? 2 : 3}" opacity="${alpha}"/>${text(892, 350, "adjacent", 15, teal, 600, `opacity="${alpha}"`)}${text(892, 472, "adjacent", 15, teal, 600, `opacity="${alpha}"`)}
    ${line(284, 275, 284, 531, "#97aab0", 2)}${text(142, 344, "Top", 14, muted, 600)}${text(142, 406, "Middle", 14, muted, 600)}${text(142, 466, "Bottom", 14, muted, 600)}
    `);
}
function digraph(challenged: boolean) {
  const opacity = challenged ? ".72" : "1";
  const nodeSize = challenged ? 19 : 24;
  return shell("Three-node directed graph", "Directed acyclic graph · arrows encode graph direction, not causation", challenged, `
    ${line(278, 385, 568, 271, teal, challenged ? 3 : 4, `marker-end="url(#arrow)" opacity="${opacity}"`)}${line(620, 271, 908, 385, teal, challenged ? 3 : 4, `marker-end="url(#arrow)" opacity="${opacity}"`)}${line(300, 408, 894, 408, amber, challenged ? 3 : 4, 'marker-end="url(#arrow)" opacity="' + opacity + '"')}
    <circle cx="274" cy="400" r="52" fill="#edf5f4" stroke="#9bc7c1" stroke-width="3"/><circle cx="600" cy="250" r="52" fill="#f3f1e9" stroke="#d4c39c" stroke-width="3"/><circle cx="926" cy="400" r="52" fill="#edf5f4" stroke="#9bc7c1" stroke-width="3"/>
    <text x="274" y="${400 + nodeSize / 3}" text-anchor="middle" fill="${ink}" font-size="${nodeSize}" font-weight="700">U</text><text x="600" y="${250 + nodeSize / 3}" text-anchor="middle" fill="${ink}" font-size="${nodeSize}" font-weight="700">V</text><text x="926" y="${400 + nodeSize / 3}" text-anchor="middle" fill="${ink}" font-size="${nodeSize}" font-weight="700">W</text>
    ${text(400, 302, "U → V", challenged ? 13 : 16, teal, 700, `opacity="${opacity}"`)}${text(765, 302, "V → W", challenged ? 13 : 16, teal, 700, `opacity="${opacity}"`)}${text(588, 393, "U → W", challenged ? 13 : 16, "#b77927", 700, `opacity="${opacity}"`)}
    <rect x="250" y="500" width="700" height="73" rx="12" fill="#f7f9f8" stroke="#e5eceb"/><text x="600" y="530" text-anchor="middle" fill="${ink}" font-size="16" font-weight="700">Two directed paths from U to W</text><text x="600" y="554" text-anchor="middle" fill="${muted}" font-size="13">direct U → W · via V: U → V → W · no directed cycle</text>`);
}
function renderSvg(id: string, memory: MemoryRecord, challenged: boolean): string {
  switch (id) {
    case "physics-oscillator": return oscillator(challenged);
    case "physics-resonance": return plotSvg("Damped oscillator frequency response", memory.plots[0], challenged, ["ζ = .15 higher peak", "Peak frequency r < 1"]);
    case "materials-layered-stack": return layered(challenged);
    case "materials-thermal-expansion": return plotSvg("Linear thermal expansion", memory.plots[0], challenged, ["Linear approximation", "Instructional only"]);
    case "mathematics-directed-graph": return digraph(challenged);
    case "mathematics-parabola": return plotSvg("Parabola and its derivative", memory.plots[0], challenged, ["f(x) = x²", "f′(x) = 2x"]);
    default: throw new Error(`No illustration renderer for ${id}`);
  }
}

async function writeImmutable(filePath: string, contents: Buffer | string) {
  try {
    const existing = await readFile(filePath);
    const expected = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    if (!existing.equals(expected)) throw new Error(`Refusing to overwrite a different existing sample asset: ${filePath}. Add a new version ID.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(filePath, contents, { flag: "wx" });
  }
}

async function main() {
  const outputDir = path.join(process.cwd(), "public", "examples");
  await mkdir(outputDir, { recursive: true });
  const firstPairOnly = process.argv.includes("--first-pair");
  const batch = firstPairOnly ? EXAMPLES.slice(0, 1) : EXAMPLES;
  for (const example of batch) {
    for (const version of example.versions) {
      const challenged = version.id === "challenged";
      const svg = renderSvg(example.id, example.gold, challenged);
      const png = new Resvg(svg, { fitTo: { mode: "original" }, background: "#ffffff" }).render().asPng();
      const base = path.basename(version.image_url, ".png");
      await writeImmutable(path.join(outputDir, `${base}.svg`), svg);
      await writeImmutable(path.join(outputDir, `${base}.png`), png);
      console.log(`${base}: ${W}×${H} SVG/PNG written or verified`);
    }
  }
  if (!firstPairOnly) {
    const manifest = { schema_version: "0.2.0", generated_at: "reproducible-build", items: listExamples().map(example => ({ ...example, authored_as: "original-self-drawn-educational-illustration", source: "Original educational illustration; self-drawn.", license: "CC0-1.0", scripted_demo_only: true })) };
    await writeFile(path.join(process.cwd(), "data", "manifests", "examples.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Manifest: ${manifest.items.length} examples written or verified`);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
