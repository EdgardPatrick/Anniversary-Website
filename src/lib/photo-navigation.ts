// Scrolling through the photos by hand. The film follows the wheel, trackpad or finger
// continuously; once the scrolling stops, it settles on whichever photo is nearest the center.
// `index.current` is the film's position in photos (fractional while scrolling, whole once
// settled); one step past the last photo is the ring box.

/** Quiet time after the last wheel event before the film settles on the nearest photo, in ms */
export const SNAP_DELAY = 140;
/** Wheel events further apart than this start a new gesture, in ms */
const GESTURE_GAP = 180;
/** How far a flicked finger carries the film on after letting go, in seconds of its speed */
const FLING = 0.12;

/** Pixels of scrolling that move the film one photo */
const pixelsPerPhoto = () => Math.max(160, Math.min(320, (window.innerHeight || 700) * 0.32));

/** `onInput` is called whenever the visitor moves the film themselves */
export function listenForPhotoGestures(atStrip: () => boolean, index: { current: number }, count: number, onInput?: () => void) {
  const last = count - 1;
  const clamp = (value: number) => Math.max(0, Math.min(last, value));
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  const settle = (carry = 0) => {
    clearTimeout(snapTimer);
    index.current = clamp(Math.round(index.current + Math.max(-4, Math.min(4, carry))));
  };
  // While scrolling, the film stops just short of the last step, so the ring box only comes once
  // it has settled there
  const move = (pixels: number) => {
    index.current = Math.min(last - 0.001, clamp(index.current + pixels / pixelsPerPhoto()));
  };
  // Scrolling up from the first photo leaves the strip for the story, unless this gesture was
  // already moving the film (then it just comes to rest on the first photo)
  const captures = (delta: number, holding: boolean) => atStrip() && (delta > 0 || index.current > 0.001 || holding);

  let lastWheel = -Infinity;
  let wheelHolding = false;
  let wheelIgnored = false;
  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const now = event.timeStamp;
    if (now - lastWheel > GESTURE_GAP) {
      wheelHolding = false;
      // Momentum from scrolling the story can carry into the strip: let it die out instead of moving the film
      wheelIgnored = !atStrip();
    }
    lastWheel = now;
    if (wheelIgnored || !captures(event.deltaY, wheelHolding)) return;
    wheelHolding = true;
    onInput?.();
    if (event.cancelable) event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    move(event.deltaY * unit);
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => settle(), SNAP_DELAY);
  }

  let previousTouch: Touch | undefined;
  let previousTime = 0;
  let touchHolding = false;
  let velocity = 0; // photos per second
  function onTouchStart(event: TouchEvent) {
    previousTouch = event.touches.length === 1 && atStrip() ? event.touches[0] : undefined;
    previousTime = event.timeStamp;
    touchHolding = false;
    velocity = 0;
    if (previousTouch) clearTimeout(snapTimer);
  }
  function onTouchMove(event: TouchEvent) {
    const previous = previousTouch;
    previousTouch = event.touches.length === 1 && previous ? event.touches[0] : undefined;
    if (!previous || !previousTouch) return;
    const dy = previous.clientY - previousTouch.clientY;
    if (Math.abs(dy) < Math.abs(previous.clientX - previousTouch.clientX) || !captures(dy, touchHolding)) return;
    touchHolding = true;
    onInput?.();
    if (event.cancelable) event.preventDefault();
    move(dy);
    const elapsed = Math.max(1, event.timeStamp - previousTime) / 1000;
    previousTime = event.timeStamp;
    velocity += (dy / pixelsPerPhoto() / elapsed - velocity) * 0.5;
  }
  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length || !touchHolding) return;
    touchHolding = false;
    previousTouch = undefined;
    // A finger that stopped before lifting carries nothing on
    const carry = event.timeStamp - previousTime > 100 ? 0 : velocity * FLING;
    settle(carry);
  }

  function onPointerDown(event: PointerEvent) {
    if (!atStrip() || index.current >= last || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    onInput?.();
  }

  function onKey(event: KeyboardEvent) {
    if (!atStrip() || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, [contenteditable=true]")) return;
    const direction = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, " ": event.shiftKey ? -1 : 1 }[event.key];
    if (!direction || !captures(direction, false)) return;
    event.preventDefault();
    onInput?.();
    clearTimeout(snapTimer);
    index.current = clamp(Math.round(index.current) + direction);
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKey);
  return () => {
    clearTimeout(snapTimer);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    window.removeEventListener("keydown", onKey);
  };
}
