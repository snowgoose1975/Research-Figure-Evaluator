import { describe, expect, it } from "vitest";
import { EXAMPLES } from "../src/lib/examples";
import { judgeByRules } from "../src/lib/evaluation";
describe("audited engineering positive controls", () => {
  it("keeps every authored keypoint consistent with its own canonical gold fact", () => {
    for (const example of EXAMPLES) for (const point of example.keypoints) expect(judgeByRules(point, example.gold).status, `${example.id}/${point.id}`).toBe("retained");
  });
});
