import { describe, expect, it } from "vitest";
import { buildFilmPath, depthLook, entryOffset, filmLayout, samplePath, type Vec3 } from "@/lib/film-path";

const DISTANCE = 1400;
const pathFor = (layout: ReturnType<typeof filmLayout>) => buildFilmPath(layout, [0, 0, 0], DISTANCE);
const at = (layout: ReturnType<typeof filmLayout>, frames: number) => {
  const p: Vec3 = [0, 0, 0], t: Vec3 = [0, 0, 0], c: Vec3 = [0, 0, 0];
  samplePath(pathFor(layout), frames * layout.length, p, t, c);
  return { p, t, c };
};
// Where a world point shows on screen, relative to the focus
const onScreen = ([x, y, z]: Vec3) => [(x * DISTANCE) / (DISTANCE - z), (y * DISTANCE) / (DISTANCE - z)];

const desktop = filmLayout(1440, 900);
const phone = filmLayout(390, 844);

describe("film path", () => {
  it("runs up the left on wide screens and across the top on phones, with wide photos", () => {
    expect(desktop.vertical).toBe(true);
    expect(desktop.focus.x).toBeLessThan(1440 / 2);
    expect(desktop.across).toBeGreaterThan(desktop.length);
    expect(phone.vertical).toBe(false);
    expect(phone.focus.y).toBeLessThan(844 / 2);
    expect(phone.length).toBeGreaterThan(phone.across);
  });

  it("holds the photo in focus flat and facing the viewer", () => {
    for (const layout of [desktop, phone]) {
      const { p, t, c } = at(layout, 0.3);
      expect(Math.abs(p[2])).toBeLessThan(layout.length * 0.05);
      expect(Math.abs(t[0] * c[1] - t[1] * c[0])).toBeGreaterThan(0.98);
    }
  });

  it("brings the mobile ribbon forward from the right and sends it back out on the left", () => {
    const path = pathFor(phone);
    for (const side of [-1, 1]) {
      const distance = side > 0 ? path.entry : -path.exit;
      const { p, c } = at(phone, distance / phone.length);
      expect(side * onScreen(p)[0]).toBeGreaterThan(phone.focus.x);
      expect(p[2]).toBeLessThan(-3 * phone.length);
      expect(c).toEqual([0, 1, 0]);
    }
  });

  it("comes in from back below the bottom edge of a wide screen and leaves off the top", () => {
    const path = pathFor(desktop);
    const back = at(desktop, path.entry / desktop.length).p;
    expect(back[2]).toBeLessThan(-desktop.length * 3);
    expect(onScreen(back)[1]).toBeLessThan(-900 / 2);
    const gone = at(desktop, -path.exit / desktop.length).p;
    expect(onScreen(gone)[1]).toBeGreaterThan(900 / 2);
  });

  it("bends gradually through both joins of the focused desktop frame", () => {
    const path = buildFilmPath(desktop, [-360, 0, 0], DISTANCE);
    for (const join of [-0.5, 0.5]) {
      const before: Vec3 = [0, 0, 0], after: Vec3 = [0, 0, 0];
      samplePath(path, (join - 0.08) * desktop.length, [0, 0, 0], before, [0, 0, 0]);
      samplePath(path, (join + 0.08) * desktop.length, [0, 0, 0], after, [0, 0, 0]);
      const dot = before.reduce((sum, value, i) => sum + value * after[i], 0);
      expect(dot).toBeGreaterThan(Math.cos(8 * Math.PI / 180));
    }
  });

  it("softens and fades the film the further back it is", () => {
    const path = pathFor(desktop);
    const near = depthLook(0, 0, path, desktop.length);
    const far = depthLook(path.entry, -desktop.length * 4, path, desktop.length);
    expect(near).toEqual({ fade: 1, blur: 0, light: 1 });
    expect(far.blur).toBe(1);
    expect(depthLook(path.entry + desktop.length * 2, 0, path, desktop.length).fade).toBe(0);
  });

  it("turns back visibly in depth on both sides of the focused desktop photo", () => {
    for (const [width, height] of [[1440, 900], [1920, 800], [800, 1024]]) {
      const layout = filmLayout(width, height);
      const distance = height / (2 * Math.tan(17.5 * Math.PI / 180));
      const path = buildFilmPath(layout, [-width / 4, 0, 0], distance);
      for (const side of [-1, 1]) {
        let furthest = 0;
        let reversal = 0;
        for (let i = path.zero; i >= 0 && i < path.count; i += side) {
          const y = -side * path.position[3 * i + 1] * distance / (distance - path.position[3 * i + 2]);
          if (y > height / 2) break;
          furthest = Math.max(furthest, y);
          reversal = Math.max(reversal, furthest - y);
        }
        expect(reversal).toBeGreaterThan(height * 0.06);
      }
    }
  });

  it("brings the film in from the far end and settles on the first photo", () => {
    expect(entryOffset(0, false, 12)).toBe(12);
    expect(entryOffset(1, false, 12)).toBe(0);
    expect(entryOffset(0, true, 12)).toBe(0);
  });
});
