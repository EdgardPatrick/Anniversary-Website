// Where the photo film sits on screen. No three.js here, so the page's text layout can use it
// without loading three (lib/film-path.ts builds the 3D path from it).

export interface FilmLayout {
  /** Desktop: the film rises up the left side. Mobile: it runs across the top. */
  vertical: boolean;
  /** The film's width, across its length, in pixels */
  across: number;
  /** One frame's length along the film, in pixels */
  length: number;
  /** Center of the photo in focus, in pixels from the top-left of the stage */
  focus: { x: number; y: number };
}

const MOBILE_BREAKPOINT = 768;

/** Share of the film's width taken by each sprocket rail */
export const RAIL = 0.055;

export function filmLayout(width: number, height: number): FilmLayout {
  if (width < MOBILE_BREAKPOINT) {
    const across = Math.min(height * 0.2, width * 0.42);
    return { vertical: false, across, length: across * 1.5, focus: { x: width / 2, y: height * 0.27 } };
  }
  // Wider than tall: the photos are landscape, about 3:2 inside the rails
  const across = Math.min(width * 0.34, height * 0.58);
  return { vertical: true, across, length: across * 0.64, focus: { x: width * 0.25, y: height / 2 } };
}
