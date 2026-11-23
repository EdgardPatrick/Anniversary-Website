/** Count only recent movement so a long, slow gesture never adds up to a flick. */
export function photoFlick() {
  let samples: { delta: number; time: number }[] = [];
  let lastTime = 0;
  let spent = false;
  return {
    reset(time: number, consumed = false) {
      samples = [];
      lastTime = time;
      spent = consumed;
    },
    move(delta: number, time: number) {
      const elapsed = Math.max(1, time - lastTime);
      lastTime = time;
      if (spent || !delta) return 0;
      if (samples.length && Math.sign(delta) !== Math.sign(samples[0].delta)) samples = [];
      samples = samples.filter(sample => time - sample.time < 85);
      samples.push({ delta: delta * Math.min(1, 85 / elapsed), time });
      if (Math.abs(samples.reduce((sum, sample) => sum + sample.delta, 0)) < 46) return 0;
      spent = true;
      return Math.sign(delta);
    },
    get consumed() { return spent; },
  };
}

export function listenForPhotoGestures(atStrip: () => boolean, index: { current: number }, count: number) {
  const wheel = photoFlick();
  const touch = photoFlick();
  let lastWheel = -Infinity;
  let previousTouch: Touch | undefined;
  const step = (direction: number) => {
    index.current = Math.max(0, Math.min(count - 1, index.current + direction));
  };
  const captures = (delta: number, consumed: boolean) =>
    atStrip() && (delta > 0 || index.current > 0 || consumed);

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const now = event.timeStamp;
    if (now - lastWheel > 180) wheel.reset(now - 16);
    lastWheel = now;
    if (!captures(event.deltaY, wheel.consumed)) {
      // Momentum from the story can bring the first photo into view.
      if (!atStrip()) wheel.reset(now, true);
      return;
    }
    if (event.cancelable) event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    step(wheel.move(event.deltaY * unit, now));
  }

  function onTouchStart(event: TouchEvent) {
    previousTouch = event.touches.length === 1 && atStrip() ? event.touches[0] : undefined;
    touch.reset(event.timeStamp);
  }
  function onTouchMove(event: TouchEvent) {
    const previous = previousTouch;
    previousTouch = event.touches.length === 1 && previous ? event.touches[0] : undefined;
    if (!previous || !previousTouch) return;
    const dy = previous.clientY - previousTouch.clientY;
    if (Math.abs(dy) < Math.abs(previous.clientX - previousTouch.clientX) || !captures(dy, touch.consumed)) return;
    if (event.cancelable) event.preventDefault();
    step(touch.move(dy, event.timeStamp));
  }
  function onKey(event: KeyboardEvent) {
    if (!atStrip() || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    const direction = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, " ": event.shiftKey ? -1 : 1 }[event.key];
    if (!direction || !captures(direction, false)) return;
    event.preventDefault();
    step(direction);
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("keydown", onKey);
  };
}
