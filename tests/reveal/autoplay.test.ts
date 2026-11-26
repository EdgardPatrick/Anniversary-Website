import { expect, it } from "vitest";
import { OPEN_AT, SCROLL_SECONDS, autoplayAt, autoplaySchedule, musicLevel, photoAfterHandBack } from "@/lib/autoplay";

const SONG = 579.92;

it("opens the gift early, scrolls the story, glides through the photos without stopping, and ends on the ring box", () => {
  expect(OPEN_AT).toBe(9);
  const invited = OPEN_AT + 6.9;
  const plan = autoplaySchedule(invited, 116, SONG);
  expect(plan.scrollTo - plan.scrollFrom).toBeCloseTo(SCROLL_SECONDS);
  // A little faster than filling the song exactly, so the ring box comes with plenty of song left
  expect(plan.ringAt).toBeLessThan(SONG - 60);
  expect(autoplayAt(invited - 1, plan, 116)).toEqual({ scroll: 0, photo: 0 });
  // The page arrives at the bottom still moving, not easing to a stop
  const near = autoplayAt(plan.scrollTo - 0.5, plan, 116).scroll;
  expect(1 - near).toBeGreaterThan(0.01);
  expect(autoplayAt(plan.scrollTo, plan, 116).scroll).toBe(1);
  // The film is already gliding when the scroll lands
  const at = (t: number) => autoplayAt(t, plan, 116).photo;
  expect(plan.photosFrom).toBeLessThan(plan.scrollTo);
  expect(at(plan.scrollTo)).toBeGreaterThan(0);
  expect(at(plan.scrollTo + 0.1)).toBeGreaterThan(at(plan.scrollTo));
  // Then never stops, at a steady pace, until the last photo
  const steady = plan.photosFrom + 3;
  for (let t = steady; t < plan.ringAt - 3; t += 0.7) expect(at(t + 0.1) - at(t)).toBeCloseTo(0.1 / plan.perPhoto, 5);
  expect(at(plan.ringAt - 0.01)).toBe(115);
  expect(at(plan.ringAt)).toBe(116);
});

it("paces the photos sensibly when the song's length is unknown or short", () => {
  expect(autoplaySchedule(10, 116, NaN).perPhoto).toBeCloseTo(3.2);
  expect(autoplaySchedule(10, 116, 60).perPhoto).toBe(1.4);
});

it("glides on from wherever the visitor left the film", () => {
  const plan = autoplaySchedule(11, 116, SONG);
  const from = { photo: 40, at: 100 };
  expect(photoAfterHandBack(100, plan, 116, from)).toBe(40);
  expect(photoAfterHandBack(130, plan, 116, from)).toBeGreaterThan(41);
  expect(photoAfterHandBack(100 + plan.perPhoto * 75 + 1 + 0.5, plan, 116, from)).toBe(115); // resting on the last photo
  expect(photoAfterHandBack(10_000, plan, 116, from)).toBe(116);
  expect(photoAfterHandBack(100, plan, 116, { photo: 116, at: 100 })).toBe(116);
});

it("fades the song in at its start and out before its end", () => {
  expect(musicLevel(0, SONG)).toBe(0);
  expect(musicLevel(1.5, SONG)).toBeCloseTo(0.5);
  expect(musicLevel(100, SONG)).toBe(1);
  expect(musicLevel(SONG - 2, SONG)).toBeCloseTo(0.5);
  expect(musicLevel(SONG, SONG)).toBe(0);
  expect(musicLevel(100, NaN)).toBe(1);
});
