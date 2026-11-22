import { describe, expect, it } from "vitest";
import { fallKeyframes, hingeMatrix, insideKeyframes, springEasing, timeline, walls } from "@/lib/gift-box";

const apply = ({ a, b, c, d }: ReturnType<typeof hingeMatrix>, [x, y]: [number, number]) => [a * x + c * y, b * x + d * y];

describe("gift box walls", () => {
  for (const wall of walls) {
    const edge: [number, number] = [wall.hinge[1][0] - wall.hinge[0][0], wall.hinge[1][1] - wall.hinge[0][1]];

    it(`${wall.name} keeps its hinge in place while it falls`, () => {
      for (const angle of [0, 0.4, 1, Math.PI / 2]) {
        const [x, y] = apply(hingeMatrix(edge, wall.outward, angle), edge);
        expect(x).toBeCloseTo(edge[0]);
        expect(y).toBeCloseTo(edge[1]);
      }
    });

    it(`${wall.name} stands up at the start and lies flat, pointing outward, at the end`, () => {
      const [sx, sy] = apply(hingeMatrix(edge, wall.outward, 0), [0, -92]);
      expect([sx, sy].map((v) => Math.round(v))).toEqual([0, -92]);
      const [fx, fy] = apply(hingeMatrix(edge, wall.outward, Math.PI / 2), [0, -92]);
      expect(fx).toBeCloseTo(wall.outward[0]);
      expect(fy).toBeCloseTo(wall.outward[1]);
    });
  }
});

describe("falling walls", () => {
  it("shows a front wall's inner face once it tips past edge-on, and never a back wall's", () => {
    for (const wall of walls) {
      const shown = insideKeyframes(wall).map((frame) => frame.opacity);
      if (wall.name.startsWith("front")) {
        expect(shown[0]).toBe(0);
        expect(shown.at(-1)).toBe(1);
      } else {
        expect(shown.every((opacity) => opacity === 0)).toBe(true);
      }
    }
  });

  it("matches the fall's own timing", () => {
    for (const wall of walls) expect(insideKeyframes(wall).at(-1)?.offset).toBe(fallKeyframes(wall).at(-1)?.offset);
  });
});

describe("opening timeline", () => {
  it("lets the walls land and lie flat before the box fades", () => {
    expect(timeline.boxFade - (timeline.walls + 830)).toBeGreaterThanOrEqual(800);
  });

  it("unties the bow before the lid moves, and bursts after the lid starts", () => {
    expect(timeline.loosen).toBeLessThan(timeline.lid);
    expect(timeline.lid).toBeLessThan(timeline.burst);
    expect(timeline.burst).toBeLessThan(timeline.settled);
  });

  it("lets the finished bear breathe for a couple of seconds before inviting the visitor on", () => {
    expect(timeline.invite - timeline.settled).toBeGreaterThanOrEqual(2000);
  });

  it("builds a spring easing that overshoots and ends at rest", () => {
    const values = springEasing().slice(7, -1).split(", ").map(Number);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expect(Math.max(...values)).toBeGreaterThan(1);
  });
});
