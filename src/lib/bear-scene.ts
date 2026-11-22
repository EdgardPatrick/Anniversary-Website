// Where the bear and the final heart sit on screen, and how they sway and beat. Shared by the live
// particles (components/BearStage.tsx), the text overlay (components/GiftReveal.tsx) and the still
// fallback (lib/bear-still.ts). No three.js here, so the overlay and the still never load it.

export type ScreenPoint = { x: number; y: number };

export const BEAR_HEIGHT = 3.25; // world units, feet to ear tips
export const BEAR_WIDTH = 1.9;
export const FOV = 32;

export interface Framing {
  /** Pixels per world unit at the bear's depth */
  unit: number;
  /** Camera distance, in world units */
  distance: number;
  /** Center of the bear, and later of the heart, in pixels from the top-left of the stage */
  center: ScreenPoint;
  /** Half the final heart's width, in pixels */
  heartHalf: number;
}

/** The bear centered a little above the middle, leaving the lower band of the screen for words */
export function framing(width: number, height: number): Framing {
  const unit = Math.max(30, Math.min((height * 0.52) / BEAR_HEIGHT, (width * 0.8) / BEAR_WIDTH));
  return {
    unit,
    distance: height / (2 * unit * Math.tan((FOV * Math.PI) / 360)),
    center: { x: width / 2, y: height * 0.42 },
    heartHalf: Math.min(width * 0.24, height * 0.2),
  };
}

/** A slow idle sway, so the bear and the heart are never quite still */
export function swayAt(seconds: number) {
  return { y: 0.14 * Math.sin(seconds * 0.45), x: 0.05 * Math.sin(seconds * 0.37 + 1) };
}

/** A heartbeat every few seconds: a quick swell, then a slower settle. 0 at rest, 1 at the peak. */
export function pulseAt(seconds: number, period = 4.2) {
  if (seconds < 0) return 0;
  const t = (seconds % period) / 0.2;
  return t * Math.exp(1 - t);
}
