import { describe, expect, it } from "vitest";
import { HEART_CENTER, buildBearCloud, pointBudget } from "@/lib/bear-points";

const cloud = buildBearCloud({ count: 6000 });
const point = (i: number) => [cloud.positions[i * 3], cloud.positions[i * 3 + 1], cloud.positions[i * 3 + 2]] as const;
const count = (test: (x: number, y: number, z: number, heart: boolean) => boolean) => {
  let n = 0;
  for (let i = 0; i < cloud.count; i++) if (test(...point(i), cloud.heart[i] === 1)) n++;
  return n;
};

describe("bear point cloud", () => {
  it("returns the requested number of points, the same way every time", () => {
    expect(cloud.count).toBe(6000);
    expect(buildBearCloud({ count: 6000 }).positions).toEqual(cloud.positions);
  });

  it("gives the heart its own share of points", () => {
    expect(cloud.heartCount).toBeGreaterThan(cloud.count * 0.08);
    expect(cloud.heartCount).toBeLessThan(cloud.count * 0.25);
  });

  it("has both ears above the head", () => {
    for (const side of [-1, 1]) {
      expect(count((x, y) => y > 1.2 && Math.abs(x - side * 0.56) < 0.25)).toBeGreaterThan(80);
    }
  });

  it("puts the heart in front of the chest, between the paws", () => {
    for (let i = 0; i < cloud.count; i++) {
      if (!cloud.heart[i]) continue;
      const [x, y, z] = point(i);
      expect(Math.abs(x - HEART_CENTER[0])).toBeLessThan(0.6);
      expect(Math.abs(y - HEART_CENTER[1])).toBeLessThan(0.6);
      expect(z).toBeGreaterThan(0.55);
    }
    // Paw pads just outside the heart on both sides
    for (const side of [-1, 1]) {
      expect(count((x, y, z, heart) => !heart && Math.abs(x - side * 0.44) < 0.14 && Math.abs(y + 0.5) < 0.16 && z > 0.85)).toBeGreaterThan(10);
    }
  });

  it("keeps every color blue: the blue channel always leads", () => {
    for (let i = 0; i < cloud.count; i++) {
      const [r, g, b] = [cloud.colors[i * 3], cloud.colors[i * 3 + 1], cloud.colors[i * 3 + 2]];
      expect(b).toBeGreaterThanOrEqual(g);
      expect(b).toBeGreaterThanOrEqual(r);
    }
  });

  it("makes the heart stand out: more saturated than the bear", () => {
    const saturation = (heart: boolean) => {
      let total = 0;
      let n = 0;
      for (let i = 0; i < cloud.count; i++) {
        if (Boolean(cloud.heart[i]) !== heart) continue;
        const r = cloud.colors[i * 3];
        const b = cloud.colors[i * 3 + 2];
        total += (b - r) / b;
        n++;
      }
      return total / n;
    };
    expect(saturation(true)).toBeGreaterThan(saturation(false) + 0.25);
  });

  it("uses fewer points on phones", () => {
    expect(pointBudget({ width: 390, height: 844, coarse: true })).toBeLessThan(pointBudget({ width: 1440, height: 900, coarse: false }));
  });
});
