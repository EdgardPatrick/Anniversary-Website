// The scroll story after the bear has formed. Progress runs 0 → 1 across the hero's scroll track,
// and everything on screen is a pure function of it, so scrolling back replays each beat in reverse.
//
// 0 ── greeting leaves ── the bear turns right, becoming the heart as it turns ── I ♥ U · Forever ──
//   the heart flips over, becoming the bouquet as it flips ──── 1

/** Height of the hero's scroll track, in screen heights */
export const TRACK_SCREENS = 7;

export interface Beat {
  /** -Infinity: already there when the scroll starts (it arrived during the opening) */
  enter: number;
  /** Infinity: stays once it has arrived */
  exit: number;
}

/** One full turn to the right */
export const TURN = { from: 0.07, to: 0.38 };
/** The change runs through the whole turn: halfway done with its back to us, finished facing front */
export const MORPH = TURN;
/** One full vertical flip of the heart */
export const FLIP = { from: 0.6, to: 0.88 };
/** The change runs through the whole flip: halfway done upside down, finished upright */
export const BLOOM = FLIP;

export const beats = {
  greeting: { enter: -Infinity, exit: 0.07 },
  // "I ♥ U · Forever" appears all at once, as soon as the heart has formed
  i: { enter: TURN.to, exit: FLIP.from },
  u: { enter: TURN.to, exit: FLIP.from },
  forever: { enter: TURN.to, exit: FLIP.from },
} satisfies Record<string, Beat>;

/** Share of the track a line spends rippling in, and again rippling out */
const RAMP = 0.05;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const span = (progress: number, { from, to }: { from: number; to: number }) => smooth(clamp01((progress - from) / (to - from)));

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

/** The bear's turn to the right, in radians: one full circle */
export const turnAt = (progress: number) => Math.PI * 2 * span(progress, TURN);
/** The heart's vertical flip, in radians: one full circle */
export const flipAt = (progress: number) => Math.PI * 2 * span(progress, FLIP);
export const morphAt = (progress: number) => span(progress, MORPH);
export const bloomAt = (progress: number) => span(progress, BLOOM);

/** Scroll position → progress along the track */
export function trackProgress(top: number, height: number, viewport: number) {
  const length = height - viewport;
  return length > 0 ? clamp01(-top / length) : 0;
}
