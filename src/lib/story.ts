// The scroll story after the bear has formed. Progress runs 0 → 1 across the hero's scroll track,
// and everything on screen is a pure function of it, so scrolling back replays each beat in reverse.
//
// 0 ── the greeting leaves ── I ── the bear turns as it becomes the heart ── U ── Forever ──── 1

/** Height of the hero's scroll track, in screen heights */
export const TRACK_SCREENS = 4;

export interface Beat {
  /** -Infinity: already there when the scroll starts (it arrived during the opening) */
  enter: number;
  /** Infinity: stays once it has arrived */
  exit: number;
}

export const beats = {
  greeting: { enter: -Infinity, exit: 0.12 },
  i: { enter: 0.14, exit: Infinity },
  u: { enter: 0.48, exit: Infinity },
  forever: { enter: 0.58, exit: Infinity },
} satisfies Record<string, Beat>;

/** The bear's particles become the heart across this span */
export const MORPH = { from: 0.16, to: 0.46 };
/** How far the bear turns away as the scroll starts, in radians; it is face-on again as the heart */
const TURN_ANGLE = 0.7;

/** Share of the track a line spends rippling in, and again rippling out */
const RAMP = 0.05;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);

export interface LineState {
  /** 0 hidden → 1 fully shown */
  opacity: number;
  /** 0 settled and readable → 1 fully stretched and rippled */
  distort: number;
}

/**
 * Where a line is in its beat. `arrival` (0 → 1) lets a line arrive on a clock instead of the
 * scroll, as the greeting does while the confetti falls.
 */
export function lineState(progress: number, { enter, exit }: Beat, arrival = 1): LineState {
  const entered = Number.isFinite(enter) ? clamp01((progress - enter) / RAMP) : 1;
  const arrived = Math.min(entered, clamp01(arrival));
  const leaving = Number.isFinite(exit) ? clamp01((progress - (exit - RAMP)) / RAMP) : 0;
  const shown = arrived * (1 - leaving);
  // The line is legible only toward the end of its ramp: it reads as stretched light, then settles
  return { opacity: smooth(clamp01(shown / 0.55)), distort: 1 - smooth(shown) };
}

/** The bear's turn, in radians: out to one side with the first scroll, back to face-on as the heart forms */
export function turnAt(progress: number) {
  return TURN_ANGLE * Math.sin(Math.PI * clamp01(progress / MORPH.to));
}

export function morphAt(progress: number) {
  return smooth(clamp01((progress - MORPH.from) / (MORPH.to - MORPH.from)));
}

/** Scroll position → progress along the track */
export function trackProgress(top: number, height: number, viewport: number) {
  const span = height - viewport;
  return span > 0 ? clamp01(-top / span) : 0;
}
