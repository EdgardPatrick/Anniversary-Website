import { describe, expect, it } from "vitest";
import { BLOOM, FLIP, MORPH, TURN, beats, bloomAt, flipAt, lineState, morphAt, particleStory, trackProgress, turnAt } from "@/lib/story";
import { buildBouquetCloud } from "@/lib/bouquet-points";
import { framing, pulseAt } from "@/lib/bear-scene";
import { buildHeartCloud } from "@/lib/bear-points";

describe("scroll story", () => {
  it("flips the bouquet into a heart, then turns the heart into a bear", () => {
    expect(particleStory(0, false)).toMatchObject({ bloom: 1, morph: 1 });
    const first = particleStory((TURN.from + TURN.to) / 2, false);
    expect(first.flip).toBeCloseTo(Math.PI);
    expect(first.bloom).toBeCloseTo(0.5);
    expect(particleStory(0.5, false)).toMatchObject({ bloom: 0, morph: 1 });
    const second = particleStory((FLIP.from + FLIP.to) / 2, false);
    expect(second.turn).toBeCloseTo(Math.PI);
    expect(second.morph).toBeCloseTo(0.5);
    expect(particleStory(1, false)).toMatchObject({ bloom: 0, morph: 0 });
  });

  it("shows the greeting as soon as it has arrived, before any scrolling, and nothing else", () => {
    expect(lineState(0, beats.greeting, 0).opacity).toBe(0);
    expect(lineState(0, beats.greeting, 1)).toEqual({ opacity: 1, distort: 0 });
    for (const beat of [beats.i, beats.u, beats.forever]) expect(lineState(0, beat).opacity).toBe(0);
    expect(morphAt(0)).toBe(0);
    expect(turnAt(0)).toBe(0);
  });

  it("changes the bear into the heart during its full turn to the right: halfway at 180°", () => {
    expect(turnAt(TURN.from)).toBe(0);
    expect(morphAt(TURN.from)).toBe(0);
    const half = (TURN.from + TURN.to) / 2;
    expect(turnAt(half)).toBeCloseTo(Math.PI);
    expect(morphAt(half)).toBeCloseTo(0.5);
    expect(turnAt(TURN.to)).toBeCloseTo(Math.PI * 2);
    expect(morphAt(TURN.to)).toBe(1);
    // Already changing early in the turn, not waiting for it
    expect(morphAt(TURN.from + (TURN.to - TURN.from) * 0.25)).toBeGreaterThan(0.1);
    // Positive turns move the bear's face toward screen right
    expect(turnAt(TURN.from + 0.02)).toBeGreaterThan(0);
  });

  it("shows I, U and Forever together, once the heart has formed", () => {
    expect(beats.i.enter).toBe(MORPH.to);
    expect(beats.u.enter).toBe(MORPH.to);
    expect(beats.forever.enter).toBe(MORPH.to);
    expect(lineState(MORPH.to - 0.001, beats.i).opacity).toBe(0);
    const all = (MORPH.to + FLIP.from) / 2;
    for (const beat of [beats.i, beats.u, beats.forever]) expect(lineState(all, beat)).toEqual({ opacity: 1, distort: 0 });
  });

  it("changes the heart into the bouquet during its full vertical flip: halfway when upside down", () => {
    const half = (FLIP.from + FLIP.to) / 2;
    expect(flipAt(FLIP.from)).toBe(0);
    expect(bloomAt(FLIP.from)).toBe(0);
    expect(flipAt(half)).toBeCloseTo(Math.PI);
    expect(bloomAt(half)).toBeCloseTo(0.5);
    expect(flipAt(FLIP.to)).toBeCloseTo(Math.PI * 2);
    expect(bloomAt(BLOOM.to)).toBe(1);
    for (const [start, beat, blend] of [
      [TURN.from, beats.greeting, morphAt],
      [FLIP.from, beats.forever, bloomAt],
    ] as const) {
      expect(lineState(start, beat).opacity).toBe(1);
      const during = start + 0.025;
      expect(lineState(during, beat).opacity).toBeCloseTo(0.5);
      expect(blend(during)).toBeGreaterThan(0);
    }
  });

  it("is a pure function of scroll position, so scrolling back shows the same thing", () => {
    for (const p of [0.05, 0.3, 0.5, 0.7, 0.9]) {
      expect(lineState(p, beats.u)).toEqual(lineState(p, beats.u));
      expect(bloomAt(p)).toBe(bloomAt(p));
      expect(turnAt(p)).toBe(turnAt(p));
    }
  });

  it("maps the track's scroll position to 0 → 1", () => {
    expect(trackProgress(0, 7000, 1000)).toBe(0);
    expect(trackProgress(-3000, 7000, 1000)).toBe(0.5);
    expect(trackProgress(-9000, 7000, 1000)).toBe(1);
  });
});

describe("bouquet cloud", () => {
  const n = 20000;
  const bouquet = buildBouquetCloud({ count: n });
  const at = (i: number) => ({
    x: bouquet.positions[i * 3],
    y: bouquet.positions[i * 3 + 1],
    r: bouquet.colors[i * 3],
    g: bouquet.colors[i * 3 + 1],
    b: bouquet.colors[i * 3 + 2],
  });
  const points = Array.from({ length: n }, (_, i) => at(i));

  it("fits in a 2-wide box, the same on every visit", () => {
    for (const { x, y } of points) {
      expect(Math.abs(x)).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(y)).toBeLessThanOrEqual(1.0001);
    }
    expect(buildBouquetCloud({ count: n }).positions).toEqual(bouquet.positions);
  });

  it("has a sunflower in the middle: warm yellow and brown, not blue", () => {
    const middle = points.filter(({ x, y }) => Math.hypot(x, y - 0.3) < 0.25);
    const warm = middle.filter(({ r, b }) => r > b);
    expect(warm.length / middle.length).toBeGreaterThan(0.7);
  });

  it("has many deep blue tulips and a light blue wrapper at the bottom", () => {
    const cobalt = points.filter(({ r, g, b }) => b > 0.5 && r < 0.3 && g < 0.45);
    expect(cobalt.length / n).toBeGreaterThan(0.12);
    const bottom = points.filter(({ y }) => y < -0.75);
    // Pale blue: blue leads, with plenty of red and green mixed in (the gold twine is the rest)
    const paper = bottom.filter(({ r, g, b }) => b >= g && g >= r && b > 0.6 && r > 0.35);
    expect(paper.length / bottom.length).toBeGreaterThan(0.7);
  });
});

describe("framing", () => {
  it("keeps the bear and the heart, with room for I and U, on a phone", () => {
    const frame = framing(390, 844);
    expect(frame.unit * 1.9).toBeLessThan(390);
    expect(frame.center.x - frame.heartHalf).toBeGreaterThan(390 * 0.25);
  });

  it("beats briefly, then rests", () => {
    expect(pulseAt(0.2)).toBeCloseTo(1);
    expect(pulseAt(2.5)).toBeLessThan(0.01);
  });
});

describe("final heart cloud", () => {
  const heart = buildHeartCloud({ count: 4000 });

  it("is a heart exactly two wide, so the words beside it fit, and the same on every visit", () => {
    const xs = Array.from({ length: 4000 }, (_, i) => heart.positions[i * 3]);
    expect(Math.max(...xs.map(Math.abs))).toBeCloseTo(1, 5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.9);
    expect(buildHeartCloud({ count: 4000 }).positions).toEqual(heart.positions);
  });

  it("is blue throughout", () => {
    for (let i = 0; i < 4000; i++) {
      expect(heart.colors[i * 3 + 2]).toBeGreaterThanOrEqual(heart.colors[i * 3 + 1]);
      expect(heart.colors[i * 3 + 2]).toBeGreaterThanOrEqual(heart.colors[i * 3]);
    }
  });
});
