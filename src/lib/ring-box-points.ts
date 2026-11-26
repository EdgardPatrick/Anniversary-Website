// The ring box the bear becomes after the photos: a pillowy cube covered in blue beads, a line of
// pale pearls along the seam between lid and base, a velvet cushion inside, and a silver ring with
// a big diamond standing in the cushion's slit. Sampled straight from simple formulas, like the
// bouquet.
//
// Every point carries its part, because the lid opens on the GPU: lid points turn about the hinge
// along the back edge (see RING_BOX_HINGE), and ring points wait hidden inside the closed box until
// the lid lifts, then rise into the ring.
// Units: about 2 wide. The box is drawn upright, facing +z; the turn that shows it from above and a
// little to the side, as in a product shot, is applied in the shader after the lid has turned.

import { seededRandom, type Vec3 } from "@/lib/bear-points";

/** Which part a point belongs to: the base, cushion and seam stay put; the lid turns; the ring rises */
export const RING_PART = { base: 0, lid: 1, ring: 2 } as const;

export interface RingBoxCloud {
  /** Where each point rests, before the viewing turn: lid points as on the closed box (the shader
   *  turns them open), ring points in the ring */
  positions: Float32Array;
  /** Where each point sits while the box is closed (only ring points differ: hidden inside the base) */
  closed: Float32Array;
  /** RING_PART per point */
  part: Float32Array;
  /** Colors as they appear on screen, per point */
  colors: Float32Array;
  /** Relative dot size per point: the seam's pearls are a little larger */
  sizes: Float32Array;
}

type Random = () => number;

// Half extents of the box, and how round its edges are
const HX = 1;
const HZ = 0.92;
const BASE_Y = [-0.9, 0] as const; // bottom and top (the seam) of the base
const LID_H = 0.5;
const ROUND = 0.26;
/** The lid turns about the line z = -HZ, y = 0: the back edge of the seam */
export const RING_BOX_HINGE = { y: 0, z: -HZ };
/** How far the lid opens, in radians */
export const RING_BOX_OPEN_ANGLE = 1.9;
/** The viewing turn: tipped toward you to show the top, then turned a little to the side */
export const RING_BOX_VIEW = { pitch: 0.36, yaw: -0.42 };
/** Offset applied after the viewing turn, so the box sits centered on the bear's place (RING_BOX_EXTENT in lib/bear-scene.ts) */
export const RING_BOX_CENTER: Vec3 = [-0.07, -0.45, 0];

const BEAD: Vec3[] = [
  [0.07, 0.17, 0.74],
  [0.1, 0.24, 0.86],
  [0.05, 0.12, 0.6],
  [0.16, 0.34, 0.95],
  [0.04, 0.09, 0.48],
];
const BEAD_SHINE: Vec3 = [0.5, 0.7, 1];
const VELVET: Vec3[] = [
  [0.04, 0.09, 0.45],
  [0.06, 0.13, 0.55],
  [0.03, 0.07, 0.36],
];
const PEARL: Vec3[] = [
  [0.78, 0.88, 1],
  [0.66, 0.8, 0.98],
  [0.9, 0.95, 1],
];
const SILVER: Vec3[] = [
  [0.82, 0.85, 0.92],
  [0.7, 0.74, 0.84],
  [0.94, 0.95, 0.98],
];
const DIAMOND: Vec3[] = [
  [0.86, 0.93, 1],
  [0.62, 0.78, 1],
  [1, 1, 1],
  [0.45, 0.62, 0.98],
];

const pick = (random: Random, palette: Vec3[]) => palette[Math.floor(random() * palette.length)];
const shade = ([r, g, b]: Vec3, k: number): Vec3 => [Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k)];

/**
 * A point on the surface of a rounded box (half extents `h`, edge radius `r`, centered at `c`),
 * pushed `inset` inward along the surface. `face` picks which faces may be used.
 */
function roundedBoxPoint(random: Random, c: Vec3, h: Vec3, r: number, inset: number, faces: (axis: number, sign: number) => boolean): Vec3 {
  const areas = [h[1] * h[2], h[0] * h[2], h[0] * h[1]];
  for (;;) {
    const pickArea = random() * (areas[0] + areas[1] + areas[2]);
    const axis = pickArea < areas[0] ? 0 : pickArea < areas[0] + areas[1] ? 1 : 2;
    const sign = random() < 0.5 ? -1 : 1;
    if (!faces(axis, sign)) continue;
    const p: Vec3 = [(random() * 2 - 1) * h[0], (random() * 2 - 1) * h[1], (random() * 2 - 1) * h[2]];
    p[axis] = sign * h[axis];
    // Round it: the nearest point of the inner box, then out by the radius
    const q = p.map((v, k) => Math.max(-(h[k] - r), Math.min(h[k] - r, v))) as Vec3;
    const d: Vec3 = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const l = Math.hypot(...d) || 1;
    const out = r - inset;
    return [c[0] + q[0] + (d[0] / l) * out, c[1] + q[1] + (d[1] / l) * out, c[2] + q[2] + (d[2] / l) * out];
  }
}

function beadColor(random: Random, depth: number): Vec3 {
  const color = random() < 0.1 ? BEAD_SHINE : pick(random, BEAD);
  return shade(color, 0.85 + random() * 0.3 - depth * 1.2);
}

/** The base: a rounded box open at the top, with a rim of beads around its mouth */
function base(random: Random): { p: Vec3; c: Vec3; s: number } {
  const h: Vec3 = [HX, (BASE_Y[1] - BASE_Y[0]) / 2, HZ];
  const c: Vec3 = [0, (BASE_Y[0] + BASE_Y[1]) / 2, 0];
  const inset = random() < 0.25 ? random() * 0.12 : 0;
  const p = roundedBoxPoint(random, c, h, ROUND, inset, (axis, sign) => !(axis === 1 && sign > 0));
  return { p, c: beadColor(random, inset), s: 1 };
}

/** The lid, closed: a rounded box with a softly domed top, open underneath, lined with velvet */
function lid(random: Random): { p: Vec3; c: Vec3; s: number } {
  if (random() < 0.34) {
    // The lining, seen once it opens
    const x = (random() * 2 - 1) * (HX - 0.1);
    const z = (random() * 2 - 1) * (HZ - 0.1);
    const dome = 0.06 * (1 - (x / HX) ** 2) * (1 - (z / HZ) ** 2);
    return { p: [x, LID_H - 0.08 + dome, z], c: shade(pick(random, VELVET), 0.7 + random() * 0.35), s: 1 };
  }
  const h: Vec3 = [HX, LID_H / 2, HZ];
  const inset = random() < 0.2 ? random() * 0.08 : 0;
  const p = roundedBoxPoint(random, [0, LID_H / 2, 0], h, Math.min(ROUND, LID_H / 2 - 0.01), inset, (axis, sign) => !(axis === 1 && sign < 0));
  // A pillowy top
  if (p[1] > LID_H * 0.6) p[1] += 0.16 * Math.max(0, 1 - (p[0] / HX) ** 2) * Math.max(0, 1 - (p[2] / HZ) ** 2);
  return { p, c: beadColor(random, inset), s: 1 };
}

/** The pearls along the seam: around the base's mouth and the lid's lower edge */
function seam(random: Random, onLid: boolean): { p: Vec3; c: Vec3; s: number } {
  // Around a rounded rectangle, just outside the walls
  const r = ROUND;
  const sx = HX - r;
  const sz = HZ - r;
  const straight = 4 * (sx + sz);
  const curve = 2 * Math.PI * r;
  let t = random() * (straight + curve);
  let x: number, z: number;
  if (t < straight) {
    const sides: [number, number, number, number, number][] = [
      // length, x0, z0, dx, dz
      [2 * sx, -sx, HZ, 1, 0],
      [2 * sz, HX, sz, 0, -1],
      [2 * sx, sx, -HZ, -1, 0],
      [2 * sz, -HX, -sz, 0, 1],
    ];
    let side = sides[0];
    for (const s of sides) {
      side = s;
      if (t < s[0]) break;
      t -= s[0];
    }
    x = side[1] + side[3] * t;
    z = side[2] + side[4] * t;
  } else {
    const a = ((t - straight) / curve) * Math.PI * 2;
    const corner = [Math.sign(Math.cos(a)) * sx, Math.sign(Math.sin(a)) * sz];
    x = corner[0] + Math.cos(a) * r;
    z = corner[1] + Math.sin(a) * r;
  }
  const out = 1.04 + random() * 0.02;
  const y = (onLid ? 0.035 : -0.035) + (random() - 0.5) * 0.035;
  return { p: [x * out, y, z * out], c: shade(pick(random, PEARL), 0.9 + random() * 0.15), s: 1.35 };
}

/** The velvet cushion filling the base, with a slit across the middle that holds the ring */
function cushion(random: Random): { p: Vec3; c: Vec3; s: number } {
  const x = (random() * 2 - 1) * (HX - 0.12);
  const z = (random() * 2 - 1) * (HZ - 0.12);
  // Two pillows either side of the slit at z = 0.05
  const across = Math.abs(z - 0.05);
  const pillow = Math.sqrt(Math.max(0, 1 - ((across - 0.45) / 0.45) ** 2));
  const y = -0.16 + 0.16 * pillow * Math.max(0, 1 - (x / HX) ** 6);
  return { p: [x, y, z], c: shade(pick(random, VELVET), 0.75 + random() * 0.35 + 0.2 * pillow), s: 0.95 };
}

const RING_CENTER: Vec3 = [0, 0.27, 0.05];
const BAND_RADIUS = 0.42;
const BAND_THICKNESS = 0.06;
const STONE_Y = RING_CENTER[1] + BAND_RADIUS + 0.22;
const STONE_RADIUS = 0.3;

/** The ring: a silver band standing upright in the slit, prongs, and a round brilliant on top */
function ring(random: Random): { p: Vec3; c: Vec3; s: number } {
  const which = random();
  if (which < 0.5) {
    // The band, a torus in the x-y plane, set with tiny stones along its top half
    const a = random() * Math.PI * 2;
    const b = random() * Math.PI * 2;
    const tube = BAND_THICKNESS * (0.6 + 0.4 * random());
    const radius = BAND_RADIUS + Math.cos(b) * tube;
    const p: Vec3 = [Math.cos(a) * radius, RING_CENTER[1] + Math.sin(a) * radius, RING_CENTER[2] + Math.sin(b) * tube * 1.4];
    const paved = Math.sin(a) > 0.2 && Math.cos(b) > 0.3 && random() < 0.5;
    return { p, c: shade(pick(random, paved ? DIAMOND : SILVER), 0.85 + random() * 0.25), s: 0.8 };
  }
  if (which < 0.58) {
    // Four prongs holding the stone
    const k = Math.floor(random() * 4);
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const t = random();
    const reach = STONE_RADIUS * (0.55 + 0.45 * t);
    return {
      p: [Math.cos(a) * reach + (random() - 0.5) * 0.02, STONE_Y - 0.14 + t * 0.2, RING_CENTER[2] + Math.sin(a) * reach],
      c: shade(pick(random, SILVER), 0.95 + random() * 0.1),
      s: 0.8,
    };
  }
  // The stone: a crown (flat table, sloping facets) over a deep pavilion, filled in layers
  const a = random() * Math.PI * 2;
  const facets = 8;
  const facet = Math.cos(Math.PI / facets) / Math.cos(((a % ((2 * Math.PI) / facets)) - Math.PI / facets));
  const fill = random() < 0.35 ? 0.4 + 0.6 * random() : 1;
  const t = random();
  let r: number, y: number;
  if (t < 0.45) {
    // Pavilion: from the girdle down to the point
    const u = t / 0.45;
    r = STONE_RADIUS * (1 - u);
    y = STONE_Y - u * STONE_RADIUS * 0.95;
  } else if (t < 0.85) {
    // Crown: from the girdle up to the table
    const u = (t - 0.45) / 0.4;
    r = STONE_RADIUS * (1 - 0.42 * u);
    y = STONE_Y + u * STONE_RADIUS * 0.42;
  } else {
    // The table
    r = STONE_RADIUS * 0.58 * Math.sqrt(random());
    y = STONE_Y + STONE_RADIUS * 0.42;
  }
  r *= facet * fill;
  return { p: [Math.cos(a) * r, y, RING_CENTER[2] + Math.sin(a) * r], c: shade(pick(random, DIAMOND), 0.9 + random() * 0.2), s: 0.85 };
}

/** Where a ring point waits while the box is closed: anywhere inside the base, under the cushion */
function hidden(random: Random): Vec3 {
  return [(random() * 2 - 1) * (HX - 0.3), BASE_Y[0] + 0.15 + random() * 0.45, (random() * 2 - 1) * (HZ - 0.3)];
}

/** Turns a point of the closed lid about the hinge by `angle` (radians, negative lifts the front) */
export function openLid([x, y, z]: Vec3, angle: number): Vec3 {
  const dy = y - RING_BOX_HINGE.y;
  const dz = z - RING_BOX_HINGE.z;
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return [x, RING_BOX_HINGE.y + dy * c - dz * s, RING_BOX_HINGE.z + dy * s + dz * c];
}

export function buildRingBoxCloud({ count, seed = 3407 }: { count: number; seed?: number }): RingBoxCloud {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const closed = new Float32Array(count * 3);
  const part = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const roll = random();
    let sample: { p: Vec3; c: Vec3; s: number };
    let kind: number = RING_PART.base;
    if (roll < 0.36) sample = base(random);
    else if (roll < 0.64) {
      sample = lid(random);
      kind = RING_PART.lid;
    } else if (roll < 0.68) sample = seam(random, false);
    else if (roll < 0.72) {
      sample = seam(random, true);
      kind = RING_PART.lid;
    } else if (roll < 0.82) sample = cushion(random);
    else {
      sample = ring(random);
      kind = RING_PART.ring;
    }
    positions.set(sample.p, i * 3);
    closed.set(kind === RING_PART.ring ? hidden(random) : sample.p, i * 3);
    part[i] = kind;
    colors.set(sample.c, i * 3);
    sizes[i] = sample.s;
  }
  return { positions, closed, part, colors, sizes };
}
