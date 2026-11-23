export interface Beat {
  /** -Infinity: already there when the scroll starts (it arrived during the opening) */
  enter: number;
  /** Infinity: stays once it has arrived */
  /** Scroll position where the exit animation starts */
  exit: number;
}

/** One full turn to the right */
export const TURN = { from: 0.09, to: 0.43 };
/** The change runs through the whole turn: halfway done with its back to us, finished facing front */
export const MORPH = TURN;
/** One full vertical flip of the heart */
export const FLIP = { from: 0.48, to: 0.79 };
/** The change runs through the whole flip: halfway done upside down, finished upright */
export const BLOOM = FLIP;

// The first photo is centered at the end of the final transformation.
export const TRACK_SCREENS = 1 + 4.6 * FLIP.to;

const heartWords = { enter: TURN.from + (TURN.to - TURN.from) * 0.5, exit: FLIP.from };

export const beats = {
  greeting: { enter: -Infinity, exit: TURN.from },
  i: heartWords,
  u: heartWords,
  forever: heartWords,
} satisfies Record<string, Beat>;

/** Share of the track a line spends rippling in, and again rippling out */
const RAMP = 0.065;

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
  const leaving = Number.isFinite(exit) ? clamp01((progress - exit) / RAMP) : 0;
  const shown = arrived * (1 - leaving);
  // The line is legible only toward the end of its ramp: it reads as stretched light, then settles
  return { opacity: smooth(clamp01(arrived / 0.55)) * (1 - smooth(leaving)), distort: 1 - smooth(shown) };
}

/** The bear's turn to the right, in radians: one full circle */
export const turnAt = (progress: number) => Math.PI * 2 * span(progress, TURN);
/** The heart's vertical flip, in radians: one full circle */
export const flipAt = (progress: number) => Math.PI * 2 * span(progress, FLIP);
export const morphAt = (progress: number) => span(progress, MORPH);
export const bloomAt = (progress: number) => span(progress, BLOOM);

export function particleStory(progress: number, reducedMotion: boolean) {
  return {
    flip: reducedMotion ? 0 : turnAt(progress),
    turn: reducedMotion ? 0 : flipAt(progress),
    bloom: 1 - morphAt(progress),
    morph: 1 - bloomAt(progress),
  };
}

/** Scroll position → progress along the track */
export function trackProgress(top: number, height: number, viewport: number) {
  const length = height - viewport;
  return length > 0 ? clamp01(-top / length) : 0;
}
