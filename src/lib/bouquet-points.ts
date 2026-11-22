// The bouquet the heart becomes at the end: a sunflower in the middle, cobalt tulips around it,
// teal greenery between them, all wrapped in light-blue paper (a folded fan behind, a crossed wrap in
// front, a pleated neck) and tied with gold twine. Each part is sampled straight from simple
// formulas, as a cloud of points with its own colors.
// Units: about 2 across in its largest dimension, centered on the origin and facing +z.

import { seededRandom, type Vec3 } from "@/lib/bear-points";

export interface BouquetCloud {
  positions: Float32Array;
  /** Colors as they appear on screen, per point */
  colors: Float32Array;
}

type Random = () => number;
type Sample = { p: Vec3; c: Vec3 };

const NECK_Y = -1.05;

const WRAPPER: Vec3[] = [
  [0.62, 0.78, 0.93],
  [0.7, 0.84, 0.96],
  [0.55, 0.72, 0.9],
];
const PETAL: Vec3[] = [
  [1, 0.78, 0.12],
  [0.98, 0.66, 0.05],
  [1, 0.86, 0.32],
];
const DISC: Vec3[] = [
  [0.3, 0.16, 0.05],
  [0.42, 0.24, 0.08],
  [0.22, 0.11, 0.04],
];
const TULIP: Vec3[] = [
  [0.1, 0.2, 0.82],
  [0.16, 0.32, 0.95],
  [0.08, 0.1, 0.58],
  [0.25, 0.42, 1],
];
const GREEN: Vec3[] = [
  [0.05, 0.42, 0.4],
  [0.08, 0.55, 0.48],
  [0.04, 0.3, 0.32],
];
const TWINE: Vec3[] = [
  [0.85, 0.6, 0.2],
  [0.95, 0.72, 0.3],
  [0.68, 0.44, 0.12],
];

const pick = (random: Random, palette: Vec3[]) => palette[Math.floor(random() * palette.length)];
const shade = ([r, g, b]: Vec3, k: number): Vec3 => [Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k)];

// ── Wrapper ─────────────────────────────────────────────────

const FAN_SPREAD = 1.0; // radians either side of straight up
const FAN_PANELS = 7;

/** The folded sheets behind the flowers: pointed panels fanning out from the neck */
function backFan(random: Random): Sample {
  const angle = (random() * 2 - 1) * FAN_SPREAD;
  const across = (angle / FAN_SPREAD + 1) / 2;
  const panel = across * FAN_PANELS;
  const u = panel - Math.floor(panel); // 0 → 1 across one panel
  const peak = 1 - Math.abs(2 * u - 1); // 1 at the panel's point
  const reach = (2.22 - 0.62 * Math.abs(angle / FAN_SPREAD)) * (0.86 + 0.14 * peak);
  const inner = 0.75;
  const r = Math.sqrt(random() * (reach * reach - inner * inner) + inner * inner);
  const side = (Math.abs(angle) / FAN_SPREAD) ** 2;
  const z = -0.32 + 0.3 * side * (r / reach) + 0.05 * (1 - peak) * (Math.floor(panel) % 2 ? 1 : -1);
  // Folds: lighter along each panel's middle, darker at its creases, brightest at the rim
  const rim = r > reach - 0.05 ? 1.12 : 1;
  return { p: [Math.sin(angle) * r, NECK_Y + Math.cos(angle) * r, z], c: shade(pick(random, WRAPPER), (0.84 + 0.16 * peak) * rim) };
}

/** The front wrap: two flaps crossing in a V below the flowers */
function frontWrap(random: Random): Sample {
  const x = (random() * 2 - 1) * 1.0;
  const ax = Math.abs(x);
  const bottom = NECK_Y + 1.0 * ax;
  const top = -0.6 + 0.52 * ax ** 0.9;
  const y = bottom + random() * Math.max(0, top - bottom);
  const lip = top - y < 0.045;
  const fold = Math.abs(x) < 0.05 ? 0.86 : 1;
  const z = 0.4 - 0.28 * x * x + (lip ? 0.03 : 0);
  return { p: [x, y, z], c: shade(pick(random, WRAPPER), (lip ? 1.12 : 0.92 + 0.1 * random()) * fold) };
}

/** The gathered, pleated paper below the tie */
function neck(random: Random): Sample {
  const t = random();
  const y = NECK_Y + 0.02 - t * 0.56;
  const half = 0.17 + 0.04 * t;
  const u = random() * 2 - 1;
  const x = u * half;
  const z = Math.sqrt(Math.max(0, 1 - u * u)) * half * (random() < 0.8 ? 0.9 : -0.9);
  const pleat = 0.8 + 0.2 * Math.cos(u * Math.PI * 5) ** 2;
  return { p: [x, y, z + 0.18], c: shade(pick(random, WRAPPER), pleat) };
}

// ── Twine ───────────────────────────────────────────────────

function rope(random: Random, center: Vec3): Vec3 {
  const radius = 0.018 * Math.sqrt(random());
  const a = random() * Math.PI * 2;
  return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2] + Math.sin(a * 1.7) * radius];
}

function twine(random: Random): Sample {
  const t = random();
  const which = random();
  let center: Vec3;
  if (which < 0.25) {
    // The band around the neck, front half
    const a = Math.PI * (0.05 + 0.9 * t);
    center = [Math.cos(a) * 0.2, NECK_Y - 0.02, 0.18 + Math.sin(a) * 0.2];
  } else if (which < 0.7) {
    // Two loops of the bow
    const side = which < 0.475 ? -1 : 1;
    const a = t * Math.PI * 2;
    center = [side * (0.19 + 0.17 * Math.cos(a)), NECK_Y + 0.05 + 0.07 * Math.sin(a) + side * 0.02 * Math.cos(a), 0.42];
  } else if (which < 0.93) {
    // Two tails, hanging with a little wave
    const side = which < 0.815 ? -1 : 1;
    center = [side * (0.03 + 0.2 * t), NECK_Y - 0.02 - 0.3 * t, 0.42 + 0.02 * Math.sin(t * 9)];
  } else {
    center = [0, NECK_Y + 0.02, 0.44]; // the knot
    return { p: rope(random, [center[0] + (random() - 0.5) * 0.05, center[1] + (random() - 0.5) * 0.05, center[2]]), c: pick(random, TWINE) };
  }
  return { p: rope(random, center), c: shade(pick(random, TWINE), 0.85 + 0.3 * random()) };
}

// ── Sunflower ───────────────────────────────────────────────

const SUN: Vec3 = [0, 0.12, 0.44];
const DISC_RADIUS = 0.18;

function sunflowerDisc(random: Random): Sample {
  const r = DISC_RADIUS * Math.sqrt(random());
  const a = random() * Math.PI * 2;
  const z = SUN[2] + 0.06 * (1 - (r / DISC_RADIUS) ** 2);
  // Seeds spiral; the rim of the disc is lighter
  const seeds = 0.82 + 0.18 * Math.sin(a * 21 + r * 80);
  const base = r > DISC_RADIUS * 0.85 ? ([0.55, 0.35, 0.1] as Vec3) : pick(random, DISC);
  return { p: [SUN[0] + Math.cos(a) * r, SUN[1] + Math.sin(a) * r, z], c: shade(base, seeds) };
}

function sunflowerPetal(random: Random): Sample {
  const layer = random() < 0.5 ? 0 : 1;
  const count = 24;
  const k = Math.floor(random() * count);
  const angle = ((k + layer * 0.5) / count) * Math.PI * 2 + (random() - 0.5) * 0.03;
  const t = random() ** 0.85;
  const length = layer ? 0.23 : 0.27;
  const width = 0.06 * Math.sin(Math.PI * t ** 0.75);
  const s = random() * 2 - 1;
  const dir: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
  const along = DISC_RADIUS * 0.9 + t * length;
  const x = SUN[0] + dir[0] * along - dir[1] * s * width;
  const y = SUN[1] + dir[1] * along + dir[0] * s * width;
  const z = SUN[2] - 0.02 - 0.06 * t - layer * 0.03 + 0.012 * (1 - Math.abs(s));
  const tip = t > 0.8 ? PETAL[2] : pick(random, PETAL.slice(0, 2));
  return { p: [x, y, z], c: shade(tip, (layer ? 0.88 : 1) * (0.9 + 0.12 * (1 - Math.abs(s)))) };
}

// ── Tulips ──────────────────────────────────────────────────

// x, y, z, size, lean
const TULIPS: [number, number, number, number, number][] = [
  [0, 0.8, 0, 1, 0],
  [-0.45, 0.67, 0.05, 0.95, 0.25],
  [0.45, 0.66, 0.05, 0.95, -0.25],
  [-0.82, 0.42, 0.1, 0.8, 0.5],
  [0.82, 0.4, 0.1, 0.85, -0.5],
  [-0.6, 0.3, 0.25, 1.15, 0.35],
  [0.62, 0.28, 0.22, 1.05, -0.35],
  [-0.95, 0.08, 0.12, 0.7, 0.7],
  [0.95, 0.05, 0.12, 0.75, -0.7],
  [-0.63, -0.12, 0.3, 1, 0.5],
  [0.65, -0.15, 0.3, 1, -0.45],
  [-0.33, -0.33, 0.38, 0.95, 0.2],
  [0.35, -0.31, 0.38, 0.9, -0.2],
  [0.27, 0.56, 0.18, 0.6, -0.1],
  [0, -0.47, 0.36, 0.95, 0.05],
];

function tulip(random: Random): Sample {
  const [cx, cy, cz, size, lean] = TULIPS[Math.floor(random() * TULIPS.length)];
  // A cup: an egg with three pointed petal tips cut into its top
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (let tries = 0; tries < 8; tries++) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    dx = r * Math.cos(a);
    dy = z;
    dz = r * Math.sin(a);
    const around = Math.atan2(dz, dx);
    if (dy < 0.62 - 0.3 * Math.abs(Math.cos(1.5 * around))) break;
  }
  const squash = dy < 0 ? 0.85 : 1;
  const lx = dx * 0.14 * size;
  const ly = dy * 0.17 * size * squash;
  const lz = dz * 0.12 * size;
  const cos = Math.cos(lean);
  const sin = Math.sin(lean);
  // Darker seams between the petals, a few pale specks where the light catches
  const seam = Math.abs(Math.cos(1.5 * Math.atan2(dz, dx))) > 0.93 ? 0.72 : 1;
  const color = random() < 0.06 ? ([0.7, 0.8, 1] as Vec3) : shade(pick(random, TULIP), seam * (0.85 + 0.25 * (dy + 1) / 2));
  return { p: [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos, cz + lz], c: color };
}

// ── Greenery ────────────────────────────────────────────────

/** Fern-like sprigs and stems in the gaps between flowers */
function greenery(random: Random): Sample {
  const sprig = Math.floor(random() * 18);
  const seeded = seededRandom(400 + sprig);
  const angle = (seeded() * 2 - 1) * 1.5 + Math.PI / 2;
  const reach = 0.5 + seeded() * 0.35;
  const base: Vec3 = [Math.cos(angle) * reach * 0.95, SUN[1] + Math.sin(angle) * reach * 0.85, 0.1 + seeded() * 0.15];
  const dir: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
  const t = random();
  const leaflet = random() < 0.75;
  const side = random() < 0.5 ? -1 : 1;
  const out = leaflet ? side * (1 - t) * 0.07 * random() : 0;
  const along = (t - 0.5) * 0.32;
  return {
    p: [base[0] + dir[0] * along - dir[1] * out, base[1] + dir[1] * along + dir[0] * out, base[2] + (random() - 0.5) * 0.02],
    c: shade(pick(random, GREEN), 0.85 + 0.3 * random()),
  };
}

/** A few loose blue specks floating among the flowers */
function speck(random: Random): Sample {
  const a = random() * Math.PI * 2;
  const r = 0.3 + random() * 0.8;
  return { p: [Math.cos(a) * r, SUN[1] + Math.sin(a) * r * 0.9, 0.1 + random() * 0.4], c: pick(random, TULIP) };
}

// ── The cloud ───────────────────────────────────────────────

const PARTS: [(random: Random) => Sample, number][] = [
  [backFan, 0.26],
  [frontWrap, 0.19],
  [neck, 0.08],
  [twine, 0.05],
  [sunflowerDisc, 0.05],
  [sunflowerPetal, 0.12],
  [tulip, 0.19],
  [greenery, 0.07],
  [speck, 0.015],
];

export function buildBouquetCloud({ count, seed = 3907 }: { count: number; seed?: number }): BouquetCloud {
  const random = seededRandom(seed);
  const total = PARTS.reduce((sum, [, share]) => sum + share, 0);
  const samples: Sample[] = [];
  for (const [part, share] of PARTS) {
    const n = Math.round((count * share) / total);
    for (let i = 0; i < n && samples.length < count; i++) samples.push(part(random));
  }
  while (samples.length < count) samples.push(tulip(random));

  // Center it and scale its largest half-extent to 1
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { p } of samples) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  samples.forEach(({ p, c }, i) => {
    positions.set([(p[0] - cx) / half, (p[1] - cy) / half, p[2] / half], i * 3);
    colors.set(c, i * 3);
  });
  return { positions, colors };
}
