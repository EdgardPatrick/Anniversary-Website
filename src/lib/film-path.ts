// Where the photo film sits on screen, and the 3D path it travels along.
//
// The film is a ribbon laid along a spline in screen pixels (one world unit = one CSS pixel on
// the z = 0 plane, y up, z toward the viewer). On a wide screen the path starts far back at the
// bottom of the screen, comes forward in a wave (up, down, up again) into the photo in focus,
// which lies flat and faces you, then rises off the top of the screen. On a phone it comes in
// from the back beyond the right edge, through the focus in the top band, and out past you on the left.
// Moving the film along the path is all the entrance, the photo-to-photo scroll and the exit need.

import { CatmullRomCurve3, Vector3 } from "three";

export type Vec3 = [number, number, number];

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

// The path's control points, ordered from where the film leaves to where it comes in. x and y are
// where the point appears on screen, in frame lengths from the focus (y up); z is its depth, in
// frame lengths toward the viewer. Three points sit in a line through the focus, so the photo in
// focus lies flat.
// The film is wider than a frame is long, so its bends stay long and gentle: a tight bend
// sideways would fold its inner edge over itself.
// Keep the turns inside the visible band between the focused frame and the viewport edge.
function filmControls(layout: FilmLayout): Vec3[] {
  const edge = (layout.vertical ? layout.focus.y : layout.focus.x) / layout.length;
  const band = edge - 0.5;
  const lower: Vec3[] = [
    [0, -0.28, -0.009],
    [-0.005, -0.56, -0.045],
    [-0.02, -(0.5 + band * 0.36), -0.14],
    [-0.055, -(0.5 + band * 0.65), -0.38],
    [-0.13, -(0.5 + band * 0.86), -0.88],
    [-0.36, -(0.5 + band * 0.37), -2.35],
    [-0.58, -(edge + 0.65), -3.9],
  ];
  const upper: Vec3[] = lower.map(([x, y, z]) => [-x, -y, z]);
  const controls: Vec3[] = [...upper.reverse(), [0, 0, 0], ...lower];
  return layout.vertical ? controls : controls.map(([x, y, z]) => [-y, x, z]);
}

export interface FilmPath {
  /** Sample spacing, in pixels */
  step: number;
  /** Index of the sample at the focus */
  zero: number;
  count: number;
  /** How far the path runs from the focus back to where the film comes in, in pixels */
  entry: number;
  /** How far it runs from the focus out to where the film leaves, in pixels */
  exit: number;
  /** Per sample: position, unit tangent (pointing toward the entry), unit "across" vector */
  position: Float32Array;
  tangent: Float32Array;
  across: Vec3;
}

const STEPS_PER_FRAME = 24;

/**
 * Samples the path at even spacing, `s` pixels from the focus (positive toward the entry), and
 * carries the film's "across" direction along it so the ribbon never flips. `origin` is the focus
 * in world units.
 */
export function buildFilmPath(layout: FilmLayout, origin: Vec3, cameraDistance: number): FilmPath {
  const L = layout.length;
  // From where each point shows on screen and how deep it is, to where it sits in the world
  const controls = filmControls(layout);
  const points = controls.map(([x, y, z]) => {
    const depth = (cameraDistance - z * L) / cameraDistance;
    return new Vector3((origin[0] + x * L) * depth, (origin[1] + y * L) * depth, origin[2] + z * L);
  });
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  curve.arcLengthDivisions = 4000;
  const lengths = curve.getLengths();
  const total = lengths[lengths.length - 1];

  // Both halves have the same number of controls, so t = 0.5 is the focus.
  const focusArc = lengths[curve.arcLengthDivisions / 2];
  const step = L / STEPS_PER_FRAME;
  const zero = Math.floor(focusArc / step);
  const count = zero + Math.floor((total - focusArc) / step) + 1;
  const position = new Float32Array(count * 3);
  const tangent = new Float32Array(count * 3);
  const across: Vec3 = layout.vertical ? [1, 0, 0] : [0, 1, 0];
  const p = new Vector3();
  const t = new Vector3();
  for (let i = 0; i < count; i++) {
    const u = Math.min(1, Math.max(0, (focusArc + (i - zero) * step) / total));
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    position.set([p.x, p.y, p.z], i * 3);
    tangent.set([t.x, t.y, t.z], i * 3);
  }

  return { step, zero, count, entry: (count - 1 - zero) * step, exit: zero * step, position, tangent, across };
}

function normalize(v: Vec3) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= l;
  v[1] /= l;
  v[2] /= l;
}

/**
 * The film's position, tangent and across vector at `s` pixels along the path from the focus,
 * written into the three outputs. Between samples it interpolates; past either end it runs on
 * straight.
 */
export function samplePath(path: FilmPath, s: number, position: Vec3, tangent: Vec3, across: Vec3) {
  [across[0], across[1], across[2]] = path.across;
  const f = s / path.step + path.zero;
  const last = path.count - 1;
  if (f < 0 || f > last) {
    const k = f < 0 ? 0 : last * 3;
    const over = (f < 0 ? f : f - last) * path.step;
    for (let n = 0; n < 3; n++) {
      tangent[n] = path.tangent[k + n];
      position[n] = path.position[k + n] + tangent[n] * over;
    }
    return;
  }
  const i = Math.min(last - 1, Math.floor(f));
  const blend = f - i;
  const a = i * 3;
  const b = a + 3;
  for (let n = 0; n < 3; n++) {
    position[n] = path.position[a + n] + (path.position[b + n] - path.position[a + n]) * blend;
    tangent[n] = path.tangent[a + n] + (path.tangent[b + n] - path.tangent[a + n]) * blend;
  }
  normalize(tangent);
}

/**
 * How far back along the path (in frame lengths) the first photo still is: at the very start of
 * the path before the film enters, 0 once it has. It glides in fast and settles slowly.
 */
export function entryOffset(entrance: number, reduced: boolean, run: number) {
  if (reduced) return 0;
  const t = Math.min(1, Math.max(0, entrance));
  return run * (1 - t) ** 2 * (1 + 2 * t);
}

/**
 * How a point on the film looks at depth `z` (pixels toward the viewer) and `s` pixels along the
 * path: soft and dim the further back it is, like a camera focused on the photo in front
 * (`blur`, `light`), and gone past the far end of the path (`fade`).
 */
export function depthLook(s: number, z: number, path: FilmPath, length: number) {
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return {
    fade: 1 - smooth(path.entry, path.entry + length, s),
    blur: smooth(length * 0.15, length * 2.2, -z),
    light: 1 - 0.45 * smooth(length * 0.15, length * 3, -z),
  };
}
