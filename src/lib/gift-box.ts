// Geometry and choreography for the gift box (components/GiftBox.tsx draws it).
//
// The box is seen from above one corner, so two walls face the visitor and the lid is a diamond.
// Every wall is hinged along its bottom edge. Falling outward, a wall turns from standing up
// (its height runs straight up the screen) to lying on the floor (its height runs along the floor,
// away from the box). Both directions are drawn in the same projection, so each animation frame
// is just a 2D matrix that keeps the bottom edge fixed and swings the wall's height between them.

export type Point = [number, number];

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const mid = (a: Point, b: Point): Point => scale(add(a, b), 0.5);

export const polygon = (...points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

export const VIEWBOX = { width: 320, height: 340 };

// Floor corners: left, front, right, back. One step along a floor edge is ±80 across and ±30 down.
const HEIGHT: Point = [0, -92];
const floor = { left: [80, 270], front: [160, 300], right: [240, 270], back: [160, 240] } satisfies Record<string, Point>;
const top = {
  left: add(floor.left, HEIGHT),
  front: add(floor.front, HEIGHT),
  right: add(floor.right, HEIGHT),
  back: add(floor.back, HEIGHT),
};

// The lid overhangs the walls a little and sits low enough for its skirt to hide their top edges
const LID_SKIRT: Point = [0, 26];
const lidTop = { left: [70, 156], front: [160, 190], right: [250, 156], back: [160, 122] } satisfies Record<string, Point>;
const lidCenter: Point = mid(lidTop.left, lidTop.right);

interface Wall {
  name: "front-left" | "front-right" | "back-left" | "back-right";
  points: Point[];
  /** Bottom edge, from → to: the hinge */
  hinge: [Point, Point];
  /** Where the wall's height points once it lies flat */
  outward: Point;
  /** Center line of the ribbon running up the wall, bottom → top */
  ribbon?: [Point, Point];
}

export const walls: Wall[] = [
  {
    name: "back-left",
    points: [floor.left, floor.back, top.back, top.left],
    hinge: [floor.left, floor.back],
    outward: sub(floor.left, floor.front), // away from the visitor, up and left
  },
  {
    name: "back-right",
    points: [floor.back, floor.right, top.right, top.back],
    hinge: [floor.back, floor.right],
    outward: sub(floor.right, floor.front),
  },
  {
    name: "front-left",
    points: [floor.left, floor.front, top.front, top.left],
    hinge: [floor.left, floor.front],
    outward: sub(floor.left, floor.back), // toward the visitor, down and left
    ribbon: [mid(floor.left, floor.front), mid(top.left, top.front)],
  },
  {
    name: "front-right",
    points: [floor.front, floor.right, top.right, top.front],
    hinge: [floor.front, floor.right],
    outward: sub(floor.right, floor.back),
    ribbon: [mid(floor.front, floor.right), mid(top.front, top.right)],
  },
];

export const floorPoints = [floor.left, floor.front, floor.right, floor.back];
export const floorCenter: Point = mid(floor.left, floor.right);
/** Middle of the box's open top: where the burst comes from */
export const opening: Point = mid(top.left, top.right);

// A band of ribbon: a strip centered on a line, as wide as `width` along `across`
export function band([from, to]: [Point, Point], across: Point, width: number) {
  const length = Math.hypot(across[0], across[1]);
  const half = scale(across, width / 2 / length);
  return polygon(add(from, half), add(to, half), sub(to, half), sub(from, half));
}

const edge = (a: Point, b: Point): Point => sub(b, a);

export const lid = {
  top: polygon(lidTop.left, lidTop.front, lidTop.right, lidTop.back),
  leftSkirt: polygon(lidTop.left, lidTop.front, add(lidTop.front, LID_SKIRT), add(lidTop.left, LID_SKIRT)),
  rightSkirt: polygon(lidTop.front, lidTop.right, add(lidTop.right, LID_SKIRT), add(lidTop.front, LID_SKIRT)),
  // Two bands cross on the lid and run down the middle of each skirt
  ribbons: [
    band([mid(lidTop.left, lidTop.back), mid(lidTop.front, lidTop.right)], edge(lidTop.front, lidTop.right), 16),
    band([mid(lidTop.back, lidTop.right), mid(lidTop.left, lidTop.front)], edge(lidTop.left, lidTop.front), 16),
    band([mid(lidTop.left, lidTop.front), add(mid(lidTop.left, lidTop.front), LID_SKIRT)], edge(lidTop.left, lidTop.front), 16),
    band([mid(lidTop.front, lidTop.right), add(mid(lidTop.front, lidTop.right), LID_SKIRT)], edge(lidTop.front, lidTop.right), 16),
  ],
  center: lidCenter,
};

export const wallRibbon = (wall: Wall) => (wall.ribbon ? band(wall.ribbon, edge(wall.hinge[0], wall.hinge[1]), 15) : null);

// ── Hinge math ──────────────────────────────────────────────

/**
 * The 2D matrix that keeps `edgeVector` where it is and swings the wall's height
 * (HEIGHT, straight up the screen) toward `outward` by `angle` radians.
 * Apply it with the transform origin on the hinge.
 */
export function hingeMatrix(edgeVector: Point, outward: Point, angle: number) {
  const [ex, ey] = edgeVector;
  const [vx, vy] = HEIGHT;
  // Where the height ends up: part still standing, part lying along the floor
  const tx = Math.cos(angle) * vx + Math.sin(angle) * outward[0];
  const ty = Math.cos(angle) * vy + Math.sin(angle) * outward[1];
  // M · [edge height] = [edge target], so M = [edge target] · [edge height]⁻¹
  const det = ex * vy - vx * ey;
  const a = (ex * vy - tx * ey) / det;
  const b = (ey * vy - ey * ty) / det;
  const c = (tx * ex - ex * vx) / det;
  const d = (ty * ex - ey * vx) / det;
  return { a, b, c, d };
}

const css = ({ a, b, c, d }: { a: number; b: number; c: number; d: number }) =>
  `matrix(${a.toFixed(4)}, ${b.toFixed(4)}, ${c.toFixed(4)}, ${d.toFixed(4)}, 0, 0)`;

// A wall tipping over: it speeds up as it falls, lands flat, bounces once and settles
const fallAngle = (t: number) => (t < 0.78 ? (Math.PI / 2) * (t / 0.78) ** 2 : Math.PI / 2 - 0.16 * Math.sin((Math.PI * (t - 0.78)) / 0.22));

export function fallKeyframes(wall: Wall, steps = 16): Keyframe[] {
  const edgeVector = edge(wall.hinge[0], wall.hinge[1]);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { offset: t, transform: css(hingeMatrix(edgeVector, wall.outward, fallAngle(t))) };
  });
}

const facing = ({ a, b, c, d }: ReturnType<typeof hingeMatrix>) => Math.sign(a * d - b * c);

/**
 * The front walls fall toward the visitor, so partway down each is seen edge-on and then from its
 * inner side, as a real wall would be. This fades in the inner face for that part of the fall.
 */
export function insideKeyframes(wall: Wall, steps = 32): Keyframe[] {
  const edgeVector = edge(wall.hinge[0], wall.hinge[1]);
  const outside = facing(hingeMatrix(edgeVector, wall.outward, 0));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { offset: t, opacity: facing(hingeMatrix(edgeVector, wall.outward, fallAngle(t))) === outside ? 0 : 1 };
  });
}

export const hingeOrigin = (wall: Wall) => `${wall.hinge[0][0]}px ${wall.hinge[0][1]}px`;

// ── Timing ──────────────────────────────────────────────────

// Milliseconds after the first activation
export const timeline = {
  loosen: 0, // both ribbon ends are pulled: the tails lengthen, the loops draw in, the knot comes undone
  lid: 1150, // the bow is gone and the loose ribbon has fallen away: the lid lifts
  burst: 1390, // the lid has cleared the box: the confetti goes up
  walls: 1900, // the glitter is up out of the box: the walls fall open (landing about 0.8 s later)
  boxFade: 3700, // the opened box has lain flat for about a second: it fades away under the bear
  greeting: 3500, // the falling confetti passes the greeting's place: it appears under the bear
  settled: 4900, // the glitter has fallen into the bear
  invite: 6900, // after a moment alone with the bear, the page can scroll into the story
} as const;

// A spring, sampled into a CSS linear() easing, for the immediate "give" of the bow and the box,
// in the spirit of the portfolio lamp's physics. Falls back to an overshooting cubic-bezier.
export function springEasing({ stiffness = 210, damping = 15, samples = 40 } = {}) {
  const values: string[] = [];
  let position = 0;
  let velocity = 0;
  const duration = 1; // seconds of simulated motion mapped onto the animation
  const dt = duration / samples / 8;
  for (let i = 0; i <= samples; i++) {
    values.push(position.toFixed(3));
    for (let k = 0; k < 8; k++) {
      const force = stiffness * (1 - position) - damping * velocity;
      velocity += force * dt;
      position += velocity * dt;
    }
  }
  values[values.length - 1] = "1";
  return `linear(${values.join(", ")})`;
}

export function supportsLinearEasing() {
  return typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)");
}
