// Where the bear, the heart and the bouquet sit on screen, and how the heart beats. Shared by the live
// particles (components/BearStage.tsx), the text overlay (components/GiftReveal.tsx) and the still
// fallback (lib/bear-still.ts). No three.js here, so the overlay and the still never load it.

export type ScreenPoint = { x: number; y: number };

const BEAR_HEIGHT = 3.25; // world units, feet to ear tips
const BEAR_WIDTH = 1.9;
export const FOV = 32;

interface Framing {
  /** Pixels per world unit at the bear's depth */
  unit: number;
  /** Camera distance, in world units */
  distance: number;
  /** Center of the bear, and later of the heart, in pixels from the top-left of the stage */
  center: ScreenPoint;
  /** Half the final heart's width, in pixels */
  heartHalf: number;
  /** Center of the bouquet, and half its largest dimension, in pixels */
  bouquetCenter: ScreenPoint;
  bouquetHalf: number;
}

/** The bear centered a little above the middle, leaving the lower band of the screen for words */
export function framing(width: number, height: number): Framing {
  const unit = Math.max(30, Math.min((height * 0.52) / BEAR_HEIGHT, (width * 0.8) / BEAR_WIDTH));
  return {
    unit,
    distance: height / (2 * unit * Math.tan((FOV * Math.PI) / 360)),
    center: { x: width / 2, y: height * 0.42 },
    heartHalf: Math.min(width * 0.24, height * 0.2),
    bouquetCenter: { x: width / 2, y: height * 0.42 },
    bouquetHalf: Math.min(width * 0.44, height * 0.26),
  };
}

/** A heartbeat every few seconds: a quick swell, then a slower settle. 0 at rest, 1 at the peak. */
export function pulseAt(seconds: number, period = 3) {
  if (seconds < 0) return 0;
  const t = (seconds % period) / 0.2;
  const swell = t * Math.exp(1 - t);
  return swell * swell;
}

/**
 * Where the bear stands beside the photos, in stage pixels. Desktop: to the right of the film,
 * turned toward it. Phones: at the bottom under the film and its words, head tipped back to look
 * up at the photos.
 */
export function finalePose(width: number, height: number, unit: number) {
  if (width < 768) {
    const scale = Math.min(width * 0.44, height * 0.22) / unit;
    return { x: width / 2, y: height + 0.44 * unit * scale, scale, yaw: -0.12, pitch: -0.2 };
  }
  const scale = 1.24;
  const projectedWidth = BEAR_WIDTH * unit * scale;
  return { x: width - projectedWidth * 0.3, y: height * 0.42, scale, yaw: -Math.PI / 4, pitch: 0 };
}
