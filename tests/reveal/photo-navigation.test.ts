import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SNAP_DELAY, listenForPhotoGestures } from "@/lib/photo-navigation";

// 700 px tall: 224 px of scrolling moves the film one photo
const PHOTO = 224;

function setup(count = 6) {
  const surface = Object.assign(new EventTarget(), { innerHeight: 700 });
  vi.stubGlobal("window", surface);
  const index = { current: 0 };
  let atStrip = true;
  listenForPhotoGestures(() => atStrip, index, count);
  const send = (type: string, timeStamp: number, data: object) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
    surface.dispatchEvent(Object.assign(event, data));
    return event.defaultPrevented;
  };
  return {
    index,
    setAtStrip(value: boolean) { atStrip = value; },
    wheel: (time: number, deltaY: number) => send("wheel", time, { deltaX: 0, deltaY, deltaMode: 0 }),
    touch: (type: string, time: number, y?: number) => send(type, time, { touches: y === undefined ? [] : [{ clientX: 0, clientY: y }] }),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("follows the wheel continuously, then settles on the photo nearest the center once it stops", () => {
  const { index, wheel } = setup();
  for (let t = 0; t < 10; t++) wheel(t * 16, PHOTO * 0.1);
  expect(index.current).toBeCloseTo(1);
  wheel(170, PHOTO * 0.4);
  expect(index.current).toBeCloseTo(1.4);
  vi.advanceTimersByTime(SNAP_DELAY - 10);
  expect(index.current).toBeCloseTo(1.4); // still scrolling, as far as it knows
  vi.advanceTimersByTime(20);
  expect(index.current).toBe(1);
  // Past the middle of the next photo: that one is nearer
  wheel(600, PHOTO * 0.7);
  vi.advanceTimersByTime(SNAP_DELAY);
  expect(index.current).toBe(2);
  // A long scroll runs through several photos and stops at the end
  for (let t = 0; t < 40; t++) wheel(1000 + t * 16, PHOTO * 0.5);
  expect(index.current).toBeLessThan(5); // not the last step (the ring box) until it settles
  vi.advanceTimersByTime(SNAP_DELAY);
  expect(index.current).toBe(5);
});

it("lets momentum from the story die out, and lets a fresh upward scroll from the first photo leave the strip", () => {
  const { index, wheel, setAtStrip } = setup();
  setAtStrip(false);
  expect(wheel(0, 100)).toBe(false);
  setAtStrip(true);
  expect(wheel(16, 100)).toBe(false); // the same gesture, arriving at the strip
  expect(index.current).toBe(0);
  expect(wheel(400, PHOTO * 0.8)).toBe(true);
  vi.advanceTimersByTime(SNAP_DELAY);
  expect(index.current).toBe(1);
  // Back up to the first photo in one gesture: it stays on the strip until the gesture ends
  expect(wheel(800, -PHOTO)).toBe(true);
  expect(wheel(816, -100)).toBe(true);
  vi.advanceTimersByTime(SNAP_DELAY);
  expect(index.current).toBe(0);
  expect(wheel(1200, -100)).toBe(false);
});

it("follows a finger, settles on the nearest photo when it stops, and carries a flick on", () => {
  const { index, touch } = setup();
  touch("touchstart", 0, 600);
  for (let i = 1; i <= 10; i++) touch("touchmove", i * 30, 600 - i * PHOTO * 0.13);
  expect(index.current).toBeCloseTo(1.3);
  touch("touchend", 500);
  expect(index.current).toBe(1);
  // A quick flick goes a little further than the finger did
  touch("touchstart", 1000, 600);
  touch("touchmove", 1016, 600 - PHOTO * 0.2);
  touch("touchmove", 1032, 600 - PHOTO * 0.4);
  touch("touchend", 1040);
  expect(index.current).toBe(3);
});
