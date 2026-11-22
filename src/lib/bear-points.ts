// The teddy bear and its heart as particles, sampled from real three.js meshes.
//
// Following Emotion Agency's particle letters (see the vault note "Particle-Shapes-Research"):
// 1. Build the shape as meshes: spheres stretched into ellipsoids, capsules for the arms, and an
//    extruded, bevelled heart.
// 2. Sample each mesh's surface by triangle area with MeshSurfaceSampler, so density is even.
// 3. Push a share of the samples inward along the surface normal, in layers, so the bear stays
//    like a solid instead of looking like a hollow shell.
// Any sample that falls inside another part is dropped, so only the outside of the combined
// shape remains and ears, muzzle and paws keep crisp silhouettes.
// Units: the bear is about 3.2 tall, standing on y ≈ -1.6, facing +z.

import {
  BufferGeometry,
  CapsuleGeometry,
  ExtrudeGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

export type Vec3 = [number, number, number];

type Part = "fur" | "pad" | "feature" | "heart";

type Solid =
  | { kind: "ellipsoid"; center: Vec3; radii: Vec3; part: Part }
  | { kind: "capsule"; from: Vec3; to: Vec3; radius: number; part: Part }
  | { kind: "heart"; center: Vec3; size: number; depth: number; tilt: number; part: Part };

export interface BearCloud {
  count: number;
  heartCount: number;
  /** Final positions, xyz per point */
  positions: Float32Array;
  /** Linear rgb per point, 0–1 */
  colors: Float32Array;
  /** Relative dot size per point */
  sizes: Float32Array;
  /** 1 for heart points, 0 for the bear */
  heart: Float32Array;
  /** The heart's center, so it can pulse in place */
  heartCenter: Vec3;
}

export const HEART_CENTER: Vec3 = [0, -0.42, 0.84];

const mirror = (sign: number, [x, y, z]: Vec3): Vec3 => [sign * x, y, z];

function bearSolids(): Solid[] {
  const solids: Solid[] = [
    { kind: "ellipsoid", center: [0, -0.55, 0], radii: [0.78, 0.86, 0.62], part: "fur" }, // body
    { kind: "ellipsoid", center: [0, -0.62, 0.4], radii: [0.5, 0.58, 0.24], part: "pad" }, // belly
    { kind: "ellipsoid", center: [0, 0.74, 0.04], radii: [0.74, 0.66, 0.62], part: "fur" }, // head
    { kind: "ellipsoid", center: [0, 0.5, 0.56], radii: [0.34, 0.25, 0.23], part: "pad" }, // muzzle
    { kind: "ellipsoid", center: [0, 0.62, 0.78], radii: [0.12, 0.08, 0.07], part: "feature" }, // nose
    { kind: "heart", center: HEART_CENTER, size: 0.44, depth: 0.5, tilt: -0.1, part: "heart" },
  ];
  for (const side of [-1, 1]) {
    solids.push(
      { kind: "ellipsoid", center: mirror(side, [0.56, 1.28, -0.02]), radii: [0.28, 0.28, 0.17], part: "fur" }, // ear
      { kind: "ellipsoid", center: mirror(side, [0.56, 1.29, 0.1]), radii: [0.16, 0.16, 0.09], part: "pad" }, // inner ear
      { kind: "ellipsoid", center: mirror(side, [0.27, 0.88, 0.56]), radii: [0.07, 0.08, 0.06], part: "feature" }, // eye
      // Arms reach forward from the shoulders and meet around the heart
      { kind: "capsule", from: mirror(side, [0.7, -0.04, 0.08]), to: mirror(side, [0.5, -0.46, 0.74]), radius: 0.19, part: "fur" },
      { kind: "ellipsoid", center: mirror(side, [0.44, -0.5, 0.9]), radii: [0.16, 0.18, 0.13], part: "pad" }, // paw, over the heart's edge
      { kind: "ellipsoid", center: mirror(side, [0.46, -1.32, 0.22]), radii: [0.33, 0.3, 0.4], part: "fur" }, // leg
      { kind: "ellipsoid", center: mirror(side, [0.48, -1.34, 0.6]), radii: [0.2, 0.19, 0.08], part: "pad" }, // foot pad
    );
  }
  return solids;
}

// ── The heart's outline ─────────────────────────────────────
// The classic parametric heart, x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t,
// scaled so it is about 2 wide and centered on its widest point. Emotion's worker uses the same curve.
const HEART_OUTLINE: Vector2[] = Array.from({ length: 96 }, (_, i) => {
  const t = (i / 96) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new Vector2(x / 16, (y + 2) / 16);
});
const HEART_BEVEL = 0.32; // in outline units: how far the puffy edge rounds over

function insideOutline(x: number, y: number) {
  let hit = false;
  for (let i = 0, j = HEART_OUTLINE.length - 1; i < HEART_OUTLINE.length; j = i++) {
    const a = HEART_OUTLINE[i];
    const b = HEART_OUTLINE[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// Into the heart's own frame: untilted, in outline units, z measured from its middle
function toHeartSpace(solid: Extract<Solid, { kind: "heart" }>, [x, y, z]: Vec3): Vec3 {
  const dx = x - solid.center[0];
  const dy = y - solid.center[1];
  const cos = Math.cos(-solid.tilt);
  const sin = Math.sin(-solid.tilt);
  return [(dx * cos - dy * sin) / solid.size, (dx * sin + dy * cos) / solid.size, (z - solid.center[2]) / solid.size];
}

function inside(solid: Solid, point: Vec3): boolean {
  const [x, y, z] = point;
  if (solid.kind === "ellipsoid") {
    const [cx, cy, cz] = solid.center;
    const [rx, ry, rz] = solid.radii;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 < 1;
  }
  if (solid.kind === "capsule") {
    return distanceToSegment(point, solid.from, solid.to) < solid.radius;
  }
  const [hx, hy, hz] = toHeartSpace(solid, point);
  return Math.abs(hz) < solid.depth / 2 + HEART_BEVEL * 0.5 && insideOutline(hx, hy);
}

function distanceToSegment(p: Vec3, a: Vec3, b: Vec3) {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const lengthSq = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / lengthSq));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

// ── Meshes ──────────────────────────────────────────────────

// Each solid as a three.js geometry, already moved into place (applyMatrix4 also turns the normals)
function solidGeometry(solid: Solid): BufferGeometry {
  if (solid.kind === "ellipsoid") {
    const geometry = new SphereGeometry(1, 48, 32);
    geometry.applyMatrix4(new Matrix4().makeScale(...solid.radii));
    geometry.translate(...solid.center);
    return geometry;
  }
  if (solid.kind === "capsule") {
    const from = new Vector3(...solid.from);
    const to = new Vector3(...solid.to);
    const axis = to.clone().sub(from);
    const geometry = new CapsuleGeometry(solid.radius, axis.length(), 12, 24);
    // CapsuleGeometry runs along +y around the origin: turn it onto the arm and center it there
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.clone().normalize()));
    geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
    return geometry;
  }
  const geometry = new ExtrudeGeometry(new Shape(HEART_OUTLINE), {
    depth: solid.depth,
    bevelEnabled: true,
    bevelThickness: HEART_BEVEL * 0.75,
    bevelSize: HEART_BEVEL * 0.55,
    bevelSegments: 8,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -solid.depth / 2); // centered front to back
  geometry.applyMatrix4(new Matrix4().makeRotationZ(solid.tilt).premultiply(new Matrix4().makeScale(solid.size, solid.size, solid.size)));
  geometry.translate(...solid.center);
  return geometry;
}

function surfaceArea(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let total = 0;
  for (let i = 0; i < count; i += 3) {
    const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return total;
}

// How deep a part is, so inner layers never poke out the far side
function thickness(solid: Solid) {
  if (solid.kind === "ellipsoid") return Math.min(...solid.radii);
  if (solid.kind === "capsule") return solid.radius;
  return solid.size * (solid.depth / 2 + HEART_BEVEL);
}

// Small, seeded random generator, so the bear is the same on every visit and in tests
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color ───────────────────────────────────────────────────

// Matte blues, as they appear on screen. The fur mixes several mid blues and a few pale flecks;
// the muzzle, belly and paws are paler; the eyes and nose are dark navy so the face reads at a
// glance; the heart is the most saturated blue, so it stands apart from the fur.
const PALETTE: Record<Part, { shades: Vec3[]; fleck: number; size: number }> = {
  fur: { shades: [[0.3, 0.46, 0.88], [0.4, 0.56, 0.95], [0.22, 0.36, 0.78], [0.52, 0.66, 0.98]], fleck: 0.06, size: 1 },
  pad: { shades: [[0.6, 0.72, 1], [0.68, 0.8, 1], [0.5, 0.64, 0.97]], fleck: 0.08, size: 0.95 },
  feature: { shades: [[0.05, 0.09, 0.26], [0.08, 0.13, 0.34]], fleck: 0, size: 1.1 },
  heart: { shades: [[0.08, 0.36, 1], [0.04, 0.26, 0.92], [0.14, 0.5, 1]], fleck: 0.04, size: 1 },
};
const FLECK: Vec3 = [0.8, 0.88, 1];

// Share of each part's points pushed inward along the normal, in layers, as Emotion fills its
// letter, so the shape stays solid when the pointer parts it.
const VOLUME: Record<Part, number> = { fur: 0.2, pad: 0.1, feature: 0, heart: 0.4 };
const LAYERS = 8;
const LAYER_DEPTH = 0.42; // the deepest layer reaches this share of the part's thickness

const mixColor = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── The cloud ───────────────────────────────────────────────

export function buildBearCloud({ count, seed = 1704 }: { count: number; seed?: number }): BearCloud {
  const random = seededRandom(seed);
  const solids = bearSolids();
  const geometries = solids.map(solidGeometry);
  const areas = geometries.map(surfaceArea);
  // Features are tiny; give them extra density so eyes and nose stay legible at low counts
  const weight = (solid: Solid) => (solid.part === "feature" ? 3 : solid.part === "heart" ? 1.6 : 1);
  const weighted = solids.map((solid, i) => areas[i] * weight(solid));
  const weightedTotal = weighted.reduce((sum, value) => sum + value, 0);

  const points: { p: Vec3; part: Part; depth: number }[] = [];
  const position = new Vector3();
  const normal = new Vector3();
  // Some raw samples end up hidden inside neighbors, so oversample and trim later
  const budget = Math.round(count * 1.7);
  solids.forEach((solid, i) => {
    const sampler = new MeshSurfaceSampler(new Mesh(geometries[i]));
    // Seeded, so every visit (and every test) gets the same bear. Not in @types/three yet.
    (sampler as MeshSurfaceSampler & { setRandomGenerator(next: () => number): MeshSurfaceSampler }).setRandomGenerator(random);
    sampler.build();
    const share = Math.max(12, Math.round((budget * weighted[i]) / weightedTotal));
    for (let n = 0; n < share; n++) {
      sampler.sample(position, normal);
      let depth = 0;
      if (random() < VOLUME[solid.part]) {
        const layer = 1 + Math.floor(random() * LAYERS);
        depth = (layer / LAYERS) * LAYER_DEPTH * (0.85 + random() * 0.3);
        position.addScaledVector(normal, -depth * thickness(solid));
      }
      const p = position.toArray() as Vec3;
      if (solids.some((other, j) => j !== i && inside(other, p))) continue;
      points.push({ p, part: solid.part, depth });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());

  // Trim evenly back to the requested count without shuffling away a whole part
  const keepEvery = points.length / count;
  const kept = points.length > count ? Array.from({ length: count }, (_, i) => points[Math.floor(i * keepEvery)]) : points;

  const total = kept.length;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const heart = new Float32Array(total);
  let heartCount = 0;

  kept.forEach(({ p, part, depth }, i) => {
    const style = PALETTE[part];
    // A little fuzz off the surface, like plush
    const fuzz = part === "fur" ? 0.022 : 0.01;
    positions[i * 3] = p[0] + (random() - 0.5) * fuzz;
    positions[i * 3 + 1] = p[1] + (random() - 0.5) * fuzz;
    positions[i * 3 + 2] = p[2] + (random() - 0.5) * fuzz;

    const fleck = random() < style.fleck;
    let color: Vec3;
    if (fleck) {
      color = mixColor(FLECK, style.shades[0], random() * 0.4);
    } else {
      // Slow bands across the cloud, so neighbors share a hue and the color drifts over the body
      const k = Math.floor(random() * style.shades.length);
      const band = 0.5 + 0.5 * Math.sin((i / total) * Math.PI * 6 + p[1] * 2.2);
      color = mixColor(style.shades[k], style.shades[(k + 1) % style.shades.length], band);
    }
    const shade = 0.88 + random() * 0.22 - depth * 0.3;
    colors[i * 3] = Math.min(1, color[0] * shade);
    colors[i * 3 + 1] = Math.min(1, color[1] * shade);
    colors[i * 3 + 2] = Math.min(1, color[2] * shade);
    sizes[i] = style.size * (0.6 + random() * 0.8) * (1 - depth * 0.3);
    if (part === "heart") {
      heart[i] = 1;
      heartCount++;
    }
  });

  return { count: total, heartCount, positions, colors, sizes, heart, heartCenter: HEART_CENTER };
}

export interface HeartCloud {
  /** Positions of a heart exactly 2 wide, centered on the origin and facing +z */
  positions: Float32Array;
  /** The heart's blues, per point, for the particles once they have become it */
  colors: Float32Array;
}

/** The final heart that every particle of the bear becomes: a dense, filled, bevelled heart */
export function buildHeartCloud({ count, seed = 2611 }: { count: number; seed?: number }): HeartCloud {
  const random = seededRandom(seed);
  const solid: Solid = { kind: "heart", center: [0, 0, 0], size: 1, depth: 0.55, tilt: 0, part: "heart" };
  const geometry = solidGeometry(solid);
  const sampler = new MeshSurfaceSampler(new Mesh(geometry));
  (sampler as MeshSurfaceSampler & { setRandomGenerator(next: () => number): MeshSurfaceSampler }).setRandomGenerator(random);
  sampler.build();
  const position = new Vector3();
  const normal = new Vector3();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const { shades } = PALETTE.heart;
  for (let i = 0; i < count; i++) {
    sampler.sample(position, normal);
    let depth = 0;
    if (random() < 0.5) {
      depth = ((1 + Math.floor(random() * LAYERS)) / LAYERS) * 0.55;
      position.addScaledVector(normal, -depth * thickness(solid));
    }
    positions.set([position.x, position.y, position.z], i * 3);
    const k = Math.floor(random() * shades.length);
    const color = random() < 0.07 ? mixColor(FLECK, shades[2], random() * 0.4) : mixColor(shades[k], shades[(k + 1) % shades.length], random());
    const shade = 0.88 + random() * 0.22 - depth * 0.3;
    colors.set([Math.min(1, color[0] * shade), Math.min(1, color[1] * shade), Math.min(1, color[2] * shade)], i * 3);
  }
  geometry.dispose();
  // The bevel makes it wider than its outline: scale it to exactly 2 wide, so the words beside it
  // can be placed from its size alone
  let half = 0;
  for (let i = 0; i < count; i++) half = Math.max(half, Math.abs(positions[i * 3]));
  for (let i = 0; i < positions.length; i++) positions[i] /= half;
  return { positions, colors };
}

// How many particles to simulate: fewer on small or touch screens, so phones stay smooth
export function pointBudget({ width, height, coarse }: { width: number; height: number; coarse: boolean }) {
  const small = Math.min(width, height) < 640 || coarse;
  return small ? 36000 : 80000;
}
