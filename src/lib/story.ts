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
export const TRACK_SCREENS = 1 + 6.4 * FLIP.to;

const heartWords = { enter: TURN.from + (TURN.to - TURN.from) * 0.5, exit: FLIP.from };

export const beats = {
  greeting: { enter: -Infinity, exit: TURN.from },
  i: heartWords,
  u: heartWords,
  forever: heartWords,
  // Arrives on the ending's clock as the ring box opens (see endingStory), and stays
  question: { enter: -Infinity, exit: Infinity },
  // Follows the film instead (see loveLine)
  love: { enter: -Infinity, exit: Infinity },
} satisfies Record<string, Beat>;

/** Share of the track a line spends rippling in, and again rippling out */
const RAMP = 0.065;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const span = (progress: number, { from, to }: { from: number; to: number }) => smooth(clamp01((progress - from) / (to - from)));

interface LineState {
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

/**
 * The ending, after the last photo. It plays on a clock rather than the scroll (one more flick
 * past the last photo starts it, a flick back reverses it), over ENDING_SECONDS:
 * the film rises away, the bear walks back to the middle and becomes a closed ring box, the box
 * holds still for a breath, then the lid lifts, the ring rises, and the question arrives as it does.
 */
export const ENDING_SECONDS = 8.5;
const FILM_LEAVES = { from: 0, to: 0.3 };
const BEAR_CENTERS = { from: 0.06, to: 0.4 };
const BECOMES_BOX = { from: 0.12, to: 0.5 };
const LID_OPENS = { from: 0.6, to: 0.9 };
/** The question starts to arrive a moment after the lid starts to lift, and takes about as long as the greeting */
const QUESTION = { from: 0.65, to: 0.81 };

export function endingStory(ending: number, reducedMotion: boolean) {
  if (reducedMotion) {
    const shown = ending > 0 ? 1 : 0;
    return { film: shown, center: shown, ring: shown, lid: shown, question: shown };
  }
  return {
    film: span(ending, FILM_LEAVES),
    center: span(ending, BEAR_CENTERS),
    ring: span(ending, BECOMES_BOX),
    lid: span(ending, LID_OPENS),
    question: clamp01((ending - QUESTION.from) / (QUESTION.to - QUESTION.from)),
  };
}

/** Moves the ending's clock `seconds` toward where it is headed: forward to 1, or back, twice as fast, to 0 */
export function advanceEnding(ending: number, headed: 0 | 1, seconds: number) {
  const step = (seconds / ENDING_SECONDS) * (headed ? 1 : 2);
  return headed ? Math.min(1, ending + step) : Math.max(0, ending - step);
}

/** Photos the film glides past while one "I love you" is shown, at the least */
export const PHOTOS_PER_LOVE = 4;

/**
 * Which "I love you" shows beside the film at film position `position` (in photos), and how far
 * it is through its arrival and departure, as the other lines do. With `photos` photos, the
 * languages are spread so each comes once along the film (going round again on a short film).
 */
export function loveLine(position: number, count: number, photos = 0) {
  const span = Math.max(0, position) / Math.max(PHOTOS_PER_LOVE, photos / count);
  const index = Math.floor(span) % count;
  return { index, ...lineState(span - Math.floor(span), { enter: 0, exit: 1 - RAMP }) };
}
