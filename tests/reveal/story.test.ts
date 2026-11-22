import { describe, expect, it } from "vitest";
import { MORPH, beats, lineState, morphAt, trackProgress, turnAt } from "@/lib/story";
import { framing, pulseAt } from "@/lib/bear-scene";
import { buildHeartCloud } from "@/lib/bear-points";

describe("scroll story", () => {
  it("shows the greeting as soon as it has arrived, before any scrolling, and nothing else", () => {
    expect(lineState(0, beats.greeting, 0).opacity).toBe(0);
    expect(lineState(0, beats.greeting, 1)).toEqual({ opacity: 1, distort: 0 });
    for (const beat of [beats.i, beats.u, beats.forever]) expect(lineState(0, beat).opacity).toBe(0);
    expect(morphAt(0)).toBe(0);
  });

  it("ripples the greeting away early in the scroll, while the bear turns", () => {
    expect(lineState(beats.greeting.exit - 0.02, beats.greeting).distort).toBeGreaterThan(0.2);
    expect(lineState(beats.greeting.exit + 0.01, beats.greeting).opacity).toBe(0);
    expect(turnAt(beats.greeting.exit)).toBeGreaterThan(0);
  });

  it("turns the bear partway with the scroll, never a full circle, and face-on once it is the heart", () => {
    let widest = 0;
    for (let p = 0; p <= 1; p += 0.01) widest = Math.max(widest, Math.abs(turnAt(p)));
    expect(widest).toBeGreaterThan(0.3);
    expect(widest).toBeLessThan(Math.PI / 2);
    expect(turnAt(0)).toBe(0);
    expect(turnAt(MORPH.to)).toBeCloseTo(0);
  });

  it("starts becoming the heart soon after the greeting leaves", () => {
    expect(MORPH.from).toBeGreaterThanOrEqual(beats.greeting.exit);
    expect(MORPH.from).toBeLessThan(0.2);
  });

  it("goes I, then the heart, then U, then Forever beneath", () => {
    expect(beats.i.enter).toBeLessThan(MORPH.from + 0.01);
    expect(lineState(MORPH.from + 0.02, beats.i).opacity).toBeGreaterThan(0.5);
    expect(lineState(MORPH.from + 0.02, beats.u).opacity).toBe(0);
    expect(beats.u.enter).toBeGreaterThanOrEqual(MORPH.to);
    expect(beats.forever.enter).toBeGreaterThan(beats.u.enter);
    for (const beat of [beats.i, beats.u, beats.forever]) expect(lineState(1, beat)).toEqual({ opacity: 1, distort: 0 });
    expect(morphAt(1)).toBe(1);
  });

  it("is a pure function of scroll position, so scrolling back shows the same thing", () => {
    for (const p of [0.05, 0.3, 0.5, 0.65, 0.9]) {
      expect(lineState(p, beats.u)).toEqual(lineState(p, beats.u));
      expect(morphAt(p)).toBe(morphAt(p));
      expect(turnAt(p)).toBe(turnAt(p));
    }
  });

  it("maps the track's scroll position to 0 → 1", () => {
    expect(trackProgress(0, 7000, 1000)).toBe(0);
    expect(trackProgress(-3000, 7000, 1000)).toBe(0.5);
    expect(trackProgress(-9000, 7000, 1000)).toBe(1);
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
