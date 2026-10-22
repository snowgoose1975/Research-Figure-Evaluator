import { describe, expect, it } from "vitest";
import { projectForRender, renderMemory } from "../src/lib/reconstruction";
import type { MemoryRecord, RenderInput } from "../src/lib/schemas";

const memory: MemoryRecord = {
  schema_version: "0.2.0", title: "A < B & C", domain: "physics", figure_type: "mechanism", summary: "A controlled mechanism.",
  graph: {
    nodes: [
      { id: "node-a", label: "Reactant <A>", aliases: ["A"], group_id: null, semantic_position: null },
      { id: "node-b", label: "Product B", aliases: [], group_id: null, semantic_position: null },
    ],
    relations: [
      { id: "promote", source_id: "node-a", target_id: "node-b", kind: "promotes", direction: "directed", line_style: "solid", evidence_status: "asserted", label: "promotes" },
      { id: "inhibit", source_id: "node-b", target_id: "node-a", kind: "inhibits", direction: "directed", line_style: "dashed", evidence_status: "hypothesized", label: "inhibits" },
    ], groups: [],
    conditions: [{ id: "condition-1", text: "under low temperature", scope: "relation", target_ids: ["promote"] }],
  },
  plots: [{
    id: "plot-1", title: "Response across decades",
    x_axis: { label: "Frequency", unit: "Hz", scale: "log", min: 1, max: 1000 },
    y_axis: { label: "Response", unit: "a.u.", scale: "linear", min: 0, max: 10 },
    series: [{ id: "series-1", label: "Approximate response", points: [{ x: 1, y: 2 }, { x: 10, y: 5 }, { x: 100, y: 8 }], style: "line", approximate: true }], notes: [],
  }],
  facts: [{ id: "fact-1", subject: "System", predicate: "obeys", object: "x < y", qualifiers: ["near equilibrium"], certainty: "hypothesized", source_ids: ["promote"] }],
  uncertainties: [{ id: "uncertainty-1", item_ids: ["fact-1"], note: "The effect size is uncertain." }],
  evidence: [{ item_id: "node-a", image_bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, visible_text: "private note", note: "do not project" }],
  completeness: "complete",
};

describe("controlled memory renderer", () => {
  it("projects only the allowlisted memory fields", () => {
    const projected = projectForRender(memory);
    expect(projected).not.toHaveProperty("evidence");
    expect(JSON.stringify(projected)).not.toContain("private note");
    expect(JSON.stringify(projected)).not.toContain("image_bbox");
  });

  it("renders promotion arrows and inhibition T bars with escaped XML text", async () => {
    const result = await renderMemory(projectForRender(memory));
    expect(result.svg).toContain("&lt;A&gt;");
    expect(result.svg).toContain("A &lt; B &amp; C");
    expect(result.svg).not.toContain("<A>");
    expect(result.svg).toMatch(/<polygon points=/); // directed promotion arrowhead
    expect(result.svg).toMatch(/stroke-width="4"/); // blunt inhibition bar
    expect(result.svg).toContain("hypothesized");
    expect(result.svg).toContain("Qualifiers: near equilibrium");
    expect(result.svg).toContain("under low temperature");
  });

  it("maps logarithmic decades evenly and audits every semantic item", async () => {
    const result = await renderMemory(projectForRender(memory));
    const circles = [...result.svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => Number(m[1]));
    expect(circles).toHaveLength(3);
    expect(Math.abs((circles[1] - circles[0]) - (circles[2] - circles[1]))).toBeLessThan(0.01);
    expect(result.rendered_item_ids).toEqual(expect.arrayContaining([
      "node-a", "node-b", "promote", "inhibit", "condition-1", "plot-1", "series-1", "fact-1", "uncertainty-1",
    ]));
    expect(result.unsupported_item_ids).toEqual([]);
    expect(result.structural_audit).toBe("complete");
    expect(result.visual_review).toBe("not_reviewed");
  });

  it("does not print an axis unit twice when the reader already included it in the label", async () => {
    const duplicateUnit: RenderInput = {
      ...projectForRender(memory),
      plots: [{
        ...projectForRender(memory).plots[0],
        x_axis: { label: "Relative displacement x (m)", unit: "m", scale: "linear", min: -0.1, max: 0.1 },
      }],
    };
    const result = await renderMemory(duplicateUnit);
    expect(result.svg).toContain("Relative displacement x (m) · linear");
    expect(result.svg).not.toContain("Relative displacement x (m) (m)");
  });

  it("treats placeholder units as no unit", async () => {
    const placeholder: RenderInput = {
      ...projectForRender(memory),
      plots: [{
        ...projectForRender(memory).plots[0],
        x_axis: { label: "Number of rewirings", unit: "none", scale: "linear", min: 0, max: 3 },
      }],
    };
    const result = await renderMemory(placeholder);
    expect(result.svg).toContain("Number of rewirings · linear");
    expect(result.svg).not.toContain("(none)");
  });

  it("reports unknown axis scales as unsupported instead of inventing a data mapping", async () => {
    const input: RenderInput = {
      ...projectForRender(memory),
      plots: [{ ...projectForRender(memory).plots[0], x_axis: { ...projectForRender(memory).plots[0].x_axis, scale: "unknown" } }],
    };
    const result = await renderMemory(input);
    expect(result.unsupported_item_ids).toContain("plot-1");
    expect(result.unsupported_item_ids).toContain("series-1");
    expect(result.svg).toContain("axis scale is unknown");
    expect(result.structural_audit).toBe("incomplete");
  });

  it("produces a PNG signature", async () => {
    const result = await renderMemory(projectForRender(memory));
    expect(result.png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(result.width).toBe(1200);
    expect(result.height).toBeGreaterThan(240);
    expect(result.renderer_version).toBe("0.2.1");
    expect(result.svg).toContain('font-size="27px"');
    expect(result.svg).toContain('font-family="Arial, Segoe UI, sans-serif"');
    expect(result.svg).toContain('width="1084" height="540"');
  });

  it("keeps three vertically positioned structure nodes separated on a tall semantic canvas", async () => {
    const vertical: MemoryRecord = {
      ...memory, figure_type: "structure", plots: [], facts: [], uncertainties: [],
      graph: {
        nodes: [0, 0.5, 1].map((y, i) => ({
          id: `layer-${i}`, label: `Layer ${i} with a descriptive label that continues all the way to its final word TAIL${i}`,
          aliases: [`Long alias for layer ${i} that must remain visible ALIASTAIL${i}`], group_id: null,
          semantic_position: { x: 0.5, y },
        })),
        relations: [], groups: [], conditions: [],
      },
    };
    const result = await renderMemory(projectForRender(vertical));
    const boxes = [...result.svg.matchAll(/data-item-id="layer-\d"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(match => ({
      x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]),
    }));
    expect(boxes).toHaveLength(3);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h);
    expect(result.height).toBeGreaterThanOrEqual(600);
    expect(result.svg).toContain("TAIL0");
    expect(result.svg).toContain("TAIL1");
    expect(result.svg).toContain("TAIL2");
    expect(result.svg).toContain("ALIASTAIL0");
    expect(result.svg).toContain("ALIASTAIL1");
    expect(result.svg).toContain("ALIASTAIL2");
    expect(result.unsupported_item_ids).toEqual([]);
  });

  it("sizes wrapped group, condition, title, and relation cards to show their full text", async () => {
    const longMemory: MemoryRecord = {
      ...memory,
      title: "A very long scientific figure title that should wrap onto several lines without being cut off at the edge of the page TITLETAIL",
      graph: {
        ...memory.graph,
        groups: [{ id: "group-long", label: "A long group label that must wrap across its container and remain legible GROUPTAIL" }],
        nodes: memory.graph.nodes.map(node => ({ ...node, group_id: "group-long" })),
        conditions: [{ id: "condition-long", text: "A long scoped condition with enough words to require multiple lines while retaining its full qualifier CONDITIONTAIL", scope: "relation", target_ids: ["promote"] }],
        relations: memory.graph.relations.map(relation => ({ ...relation, line_style: relation.id === "inhibit" ? "unknown" as const : relation.line_style })),
      },
    };
    const result = await renderMemory(projectForRender(longMemory));
    expect(result.svg).toContain("TITLETAIL");
    expect(result.svg).toContain("GROUPTAIL");
    expect(result.svg).toContain("CONDITIONTAIL");
    expect(result.svg).toContain("style: unknown");
    expect(result.svg).toContain("kind: inhibits");
    expect(result.unsupported_item_ids).toEqual([]);
  });

  it("fails structural audit when the memory contains no semantic items", async () => {
    const empty: RenderInput = {
      title: "Empty", domain: "other", figure_type: "mixed", summary: "",
      graph: { nodes: [], relations: [], groups: [], conditions: [] }, plots: [], facts: [], uncertainties: [],
    };
    const result = await renderMemory(empty);
    expect(result.structural_audit).toBe("failed");
  });
});
