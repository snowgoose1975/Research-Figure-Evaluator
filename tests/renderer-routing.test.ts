import { describe, expect, it } from "vitest";
import type { RenderInput } from "../src/lib/schemas";
import { renderMemory } from "../src/lib/reconstruction";

function input(): RenderInput {
  return {
    title: "A private model generated title",
    domain: "physics",
    figure_type: "mechanism",
    summary: "A private model generated summary that must never reach the raster reconstruction",
    graph: {
      nodes: [0, 1, 2, 3].map(i => ({ id: `n${i}`, label: `Node ${i}`, aliases: [], group_id: null, semantic_position: { x: i / 3, y: 0.5 } })),
      relations: [], groups: [], conditions: [],
    },
    plots: [], facts: [], uncertainties: [],
  };
}

describe("renderer 0.2.3 routing and answer isolation", () => {
  it("does not render free-form summary or title text", async () => {
    const result = await renderMemory(input());
    expect(result.svg).toContain("Reconstructed figure");
    expect(result.svg).not.toContain("A private model generated");
    expect(result.png.includes(Buffer.from("A private model generated summary"))).toBe(false);
  });

  it("routes around a non-endpoint node and preserves destination arrow and inhibition bar direction", async () => {
    const data = input();
    data.graph.relations = [
      { id: "flow", source_id: "n0", target_id: "n3", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "flow" },
      { id: "inhibit", source_id: "n0", target_id: "n3", kind: "inhibits", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "inhibits" },
    ];
    const result = await renderMemory(data);
    const group = (id: string) => result.svg.match(new RegExp(`<g data-item-id="${id}">([\\s\\S]*?)<\\/g>`))?.[1] ?? "";
    const flow = group("flow"); const inhibit = group("inhibit");
    expect(flow.match(/<path d="([^"]+)"/)?.[1]).toContain("L");
    expect(inhibit.match(/<path d="([^"]+)"/)?.[1]).not.toBe(flow.match(/<path d="([^"]+)"/)?.[1]);
    expect(flow).toContain("<polygon points=");
    expect(inhibit).toContain("stroke-width=\"4\"/>");
    expect(result.unsupported_item_ids).not.toEqual(expect.arrayContaining(["flow", "inhibit"]));
    expect(result.warnings.some(warning => warning.includes("no collision-free route"))).toBe(false);
  });

  it("gives unobstructed reverse edges separate lanes and places labels at the path midpoint", async () => {
    const data = input();
    data.graph.nodes = [data.graph.nodes[0], data.graph.nodes[3]];
    data.graph.relations = [
      { id: "forward", source_id: "n0", target_id: "n3", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "forward" },
      { id: "reverse", source_id: "n3", target_id: "n0", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "reverse" },
    ];
    const result = await renderMemory(data);
    const group = (id: string) => result.svg.match(new RegExp(`<g data-item-id="${id}">([\\s\\S]*?)<\\/g>`))?.[1] ?? "";
    const forward = group("forward"); const reverse = group("reverse");
    const forwardPath = forward.match(/<path d="([^"]+)"/)?.[1] ?? "";
    const reversePath = reverse.match(/<path d="([^"]+)"/)?.[1] ?? "";
    expect(forwardPath).not.toBe(reversePath);
    expect(forwardPath.split("L")).toHaveLength(4);
    expect(reversePath.split("L")).toHaveLength(4);
    const labelX = Number(forward.match(/class="edge"[^>]* x="([\d.]+)"/)?.[1]);
    expect(labelX).toBeGreaterThan(400);
    expect(labelX).toBeLessThan(800);
    const pathYs = [...forwardPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(match => Number(match[2]));
    const svgHeight = Number(result.svg.match(/height="(\d+)" viewBox/)?.[1]);
    expect(svgHeight).toBeGreaterThan(Math.max(...pathYs));
    expect(result.unsupported_item_ids).not.toEqual(expect.arrayContaining(["forward", "reverse"]));
  });

  it("uses a global corner channel when direct, top, bottom, and side routes are blocked", async () => {
    const data = input();
    data.graph.nodes = [
      { ...data.graph.nodes[0], id: "source", semantic_position: { x: 0.1, y: 0.5 } },
      { ...data.graph.nodes[0], id: "middle-blocker", semantic_position: { x: 0.5, y: 0.5 } },
      { ...data.graph.nodes[0], id: "target", semantic_position: { x: 0.9, y: 0.5 } },
      { ...data.graph.nodes[0], id: "target-column-blocker", semantic_position: { x: 0.9, y: 0.25 } },
      { ...data.graph.nodes[0], id: "target-column-blocker-low", semantic_position: { x: 0.9, y: 0.75 } },
    ];
    data.graph.relations = [
      { id: "corner-route", source_id: "source", target_id: "target", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "corner route" },
    ];
    const result = await renderMemory(data);
    const group = result.svg.match(/<g data-item-id="corner-route">([\s\S]*?)<\/g>/)?.[1] ?? "";
    const path = group.match(/<path d="([^"]+)"/)?.[1] ?? "";
    expect(path.split("L").length).toBeGreaterThanOrEqual(5);
    expect(path).toContain("1154");
    expect(result.unsupported_item_ids).not.toContain("corner-route");
    expect(result.warnings.some(warning => warning.includes("corner-route") && warning.includes("route"))).toBe(false);
    const pathYs = [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(match => Number(match[2]));
    const svgHeight = Number(result.svg.match(/height="(\d+)" viewBox/)?.[1]);
    expect(svgHeight).toBeGreaterThan(Math.max(...pathYs));
  });

  it("routes unobstructed vertical reverse edges through different x channels", async () => {
    const data = input();
    data.graph.nodes = [
      { ...data.graph.nodes[0], id: "upper", semantic_position: { x: 0.5, y: 0.2 } },
      { ...data.graph.nodes[0], id: "lower", semantic_position: { x: 0.5, y: 0.8 } },
    ];
    data.graph.relations = [
      { id: "down", source_id: "upper", target_id: "lower", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "down" },
      { id: "up", source_id: "lower", target_id: "upper", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "up" },
    ];
    const result = await renderMemory(data);
    const pathFor = (id: string) => result.svg.match(new RegExp(`<g data-item-id="${id}">([\\s\\S]*?)<\\/g>`))?.[1]?.match(/<path d="([^"]+)"/)?.[1] ?? "";
    const xsFor = (path: string) => [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(match => Number(match[1]));
    const downXs = xsFor(pathFor("down")); const upXs = xsFor(pathFor("up"));
    const downChannel = downXs.find(x => x !== downXs[0]);
    const upChannel = upXs.find(x => x !== upXs[0]);
    expect(downChannel).toBeDefined();
    expect(upChannel).toBeDefined();
    expect(downChannel).not.toBe(upChannel);
    expect(Math.abs(downChannel! - upChannel!)).toBeGreaterThan(178);
    expect(result.unsupported_item_ids).not.toEqual(expect.arrayContaining(["down", "up"]));
  });
});
