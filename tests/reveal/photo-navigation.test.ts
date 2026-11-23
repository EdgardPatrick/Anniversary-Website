import { afterEach, expect, it, vi } from "vitest";
import { listenForPhotoGestures } from "@/lib/photo-navigation";

function setup() {
  const surface = new EventTarget();
  vi.stubGlobal("window", surface);
  const index = { current: 0 };
  let atStrip = true;
  listenForPhotoGestures(() => atStrip, index, 3);
  const send = (type: string, timeStamp: number, data: object) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
    surface.dispatchEvent(Object.assign(event, data));
    return event.defaultPrevented;
  };
  return {
    index, setAtStrip(value: boolean) { atStrip = value; },
    wheel: (time: number, deltaY: number) => send("wheel", time, { deltaX: 0, deltaY, deltaMode: 0 }),
    touch: (type: string, time: number, y: number) => send(type, time, { touches: [{ clientX: 0, clientY: y }] }),
  };
}

afterEach(() => vi.unstubAllGlobals());

it("holds slow wheel movement and advances one photo per fast wheel gesture", () => {
  const { index, wheel } = setup();
  for (let t = 0; t < 1000; t += 16) wheel(t, 3);
  expect(index.current).toBe(0);
  for (let t = 1200; t < 1650; t += 16) wheel(t, 22);
  expect(index.current).toBe(1);
  wheel(1900, 120);
  expect(index.current).toBe(2);
  wheel(2200, 120);
  expect(index.current).toBe(2);
});

it("absorbs incoming momentum, steps back once, and lets a fresh upward gesture leave the strip", () => {
  const { index, wheel, setAtStrip } = setup();
  setAtStrip(false);
  expect(wheel(0, 100)).toBe(false);
  setAtStrip(true);
  wheel(16, 100);
  expect(index.current).toBe(0);
  wheel(300, 100);
  expect(index.current).toBe(1);
  wheel(600, -100);
  expect(index.current).toBe(0);
  expect(wheel(616, -80)).toBe(true);
  expect(wheel(900, -100)).toBe(false);
});

it("holds a slow finger drag and advances once per quick swipe", () => {
  const { index, touch } = setup();
  touch("touchstart", 0, 600);
  for (let i = 1; i <= 50; i++) touch("touchmove", i * 20, 600 - i * 4);
  expect(index.current).toBe(0);
  touch("touchstart", 1200, 600);
  touch("touchmove", 1216, 575);
  touch("touchmove", 1232, 550);
  touch("touchmove", 1300, 400);
  expect(index.current).toBe(1);
});
