import { describe, expect, it } from "vitest";
import type { RenderInput } from "../src/lib/schemas";
import { renderMemory } from "../src/lib/reconstruction";

function mechanismInput(): RenderInput {
  const nodes = Array.from({ length: 11 }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
    aliases: [],
    group_id: null,
    semantic_position: i === 1 ? { x: 0.82, y: 0.12 } : i === 8 ? { x: 0.12, y: 0.88 } : null,
  }));
  return {
    title: "Three row mechanism layout",
    domain: "physics",
    figure_type: "mechanism",
    summary: "Synthetic layout fixture",
    graph: {
      nodes,
      relations: [{ id: "edge-0-10", source_id: "n0", target_id: "n10", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "flows to" }],
      groups: [],
      conditions: [],
    },
    plots: [], facts: [], uncertainties: [],
  };
}

function positionedMechanism(positions: { x: number; y: number }[]): RenderInput {
  const input = mechanismInput();
  input.graph.nodes = positions.map((semantic_position, i) => ({
    id: `p${i}`, label: `Position ${i}`, aliases: [], group_id: null, semantic_position,
  }));
  input.graph.relations = [];
  return input;
}

function rectFor(svg: string, id: string): { x: number; y: number } {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const group = svg.match(new RegExp(`<g data-item-id="${escapedId}">([\\s\\S]*?)<\\/g>`))?.[1];
  const rect = group?.match(/<rect x="([\d.]+)" y="([\d.]+)"/);
  if (!rect) throw new Error(`No node rectangle found for ${id}`);
  return { x: Number(rect[1]), y: Number(rect[2]) };
}

describe("renderer semantic layout", () => {
  it("uses partial semantic positions in mechanism figures and lays out remaining nodes in three compact rows", async () => {
    const result = await renderMemory(mechanismInput());

    expect(rectFor(result.svg, "n1").x).toBeGreaterThan(rectFor(result.svg, "n8").x);
    expect(rectFor(result.svg, "n1").y).toBeLessThan(rectFor(result.svg, "n8").y);

    const automatic = [0, 2, 3, 4, 5, 6, 7, 9, 10].map(i => rectFor(result.svg, `n${i}`));
    const rowYs = [...new Set(automatic.map(({ y }) => y))];
    expect(rowYs).toHaveLength(3);
    expect(automatic.slice(0, 4).map(({ x }) => x)).toEqual([74, 324, 574, 824]);
    expect(automatic[4].x).toBe(74);
    expect(result.rendered_item_ids).toContain("edge-0-10");
    expect(result.svg).toContain('data-item-id="edge-0-10"');
    expect(result.svg).not.toContain("Relations</text>");
  });

  it("warns and marks structurally indistinguishable zero-span positions", async () => {
    const input = mechanismInput();
    input.graph.nodes[1].semantic_position = { x: 0.4, y: 0.4 };
    input.graph.nodes[8].semantic_position = { x: 0.4, y: 0.4 };

    const result = await renderMemory(input);

    expect(result.unsupported_item_ids).toEqual(expect.arrayContaining(["n1", "n8"]));
    expect(result.warnings.some(warning => warning.includes("zero span"))).toBe(true);
    expect(result.structural_audit).toBe("incomplete");
  });

  it("normalizes four semantic columns across three rows without overlap", async () => {
    const xValues = [0.15, 0.35, 0.55, 0.75];
    const positions = [0.1, 0.5, 0.9].flatMap(y => xValues.map(x => ({ x, y })));
    const result = await renderMemory(positionedMechanism(positions));
    const boxes = positions.map((_, i) => rectFor(result.svg, `p${i}`));

    for (let row = 0; row < 3; row++) {
      const rowBoxes = boxes.slice(row * 4, row * 4 + 4);
      expect(rowBoxes.map(({ x }) => x)).toEqual([74, 365.3333333333333, 656.6666666666667, 948]);
      expect(rowBoxes.every((box, index) => index === 0 || box.x - rowBoxes[index - 1].x >= 178)).toBe(true);
    }
    expect(result.unsupported_item_ids).toEqual([]);
  });

  it("keeps tightly spaced nodes at the same x in vertical order without overlap", async () => {
    const positions = [0.2, 0.201, 0.202, 0.203].map(y => ({ x: 0.5, y }));
    const result = await renderMemory(positionedMechanism(positions));
    const boxes = positions.map((_, i) => rectFor(result.svg, `p${i}`));

    expect(boxes.map(({ y }) => y)).toEqual([...boxes.map(({ y }) => y)].sort((a, b) => a - b));
    expect(boxes.every((box, index) => index === 0 || box.y - boxes[index - 1].y >= 74)).toBe(true);
    expect(result.unsupported_item_ids).toEqual([]);
  });

  it("marks long, overlapping relations when lines cross intervening nodes", async () => {
    const input = positionedMechanism([0.1, 0.35, 0.6, 0.85].map(x => ({ x, y: 0.5 })));
    input.graph.relations = [
      { id: "edge-forward", source_id: "p0", target_id: "p3", kind: "flows_to", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "forward" },
      { id: "edge-reverse", source_id: "p3", target_id: "p0", kind: "flows_to", direction: "directed", line_style: "dashed", evidence_status: "asserted", label: "reverse" },
    ];

    const result = await renderMemory(input);

    expect(result.rendered_item_ids).toEqual(expect.arrayContaining(["edge-forward", "edge-reverse"]));
    expect(result.unsupported_item_ids).toEqual(expect.arrayContaining(["edge-forward", "edge-reverse"]));
    expect(result.warnings.some(warning => warning.includes("edge-forward") && warning.includes("crosses non-endpoint node"))).toBe(true);
    expect(result.warnings.some(warning => warning.includes("edge-reverse") && warning.includes("crosses non-endpoint node"))).toBe(true);
    expect(result.warnings.some(warning => warning.includes("share this endpoint pair"))).toBe(true);
    expect(result.structural_audit).toBe("incomplete");
  });
});
