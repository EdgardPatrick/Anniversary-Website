// The bear as real particles: every point has a position and a velocity that live on the GPU
// (GPUComputationRenderer) and are advanced every frame by the physics below.
//
// One continuous life for each particle:
// 1. The throw. It waits inside the box until its own moment, then is thrown straight up, fast
//    enough to peak near the top of the screen. Around the top of its arc it spreads outward; as it
//    falls, the pull toward its place on the bear grows and gravity fades, so it curves inward and
//    lands. Paper confetti is thrown in the same burst; it flutters and falls away.
// 2. The bear. A spring holds each particle home with a little jelly overshoot, but never still: it
//    circles its home on a small loop, a few drift off the surface and back, and the heart's
//    particles swirl around its edge and swell on every heartbeat.
// 3. The heart. As the visitor scrolls, each particle's home slides from the bear to the big heart,
//    at its own moment, with a swirl along the way.
// 4. The bouquet. Scrolling on, each home slides again, to its place in the bouquet, and the
//    particle takes on that place's color.
// The pointer pushes, drags and lights up nearby particles at every stage; a tap sends out a ring.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  Group,
  HalfFloatType,
  Points,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
  type WebGLRenderer,
} from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { seededRandom, type BearCloud, type HeartCloud } from "@/lib/bear-points";
import type { BouquetCloud } from "@/lib/bouquet-points";

const GRAVITY = 9;

// ── Shared by both simulation shaders: where a particle belongs right now ──
const homeChunk = /* glsl */ `
  uniform sampler2D tBear;   // xyz: place on the bear, w: how near the bear's outline it sits (0 → 1)
  uniform sampler2D tHeart;  // xyz: place on the final heart (2 wide, centered), w: nearness to its outline
  uniform sampler2D tInfo;   // x: launch time, y: seed, z: 1 for the bear's heart, w: apex share
  uniform sampler2D tLaunch; // xz: sideways throw, y: 1 for paper confetti, w: when it starts each change
  uniform sampler2D tBouquet; // xyz: place in the bouquet (about 2 across, centered), w: nearness to its outline
  uniform vec3 uHeartCenter; // the bear's heart, which beats
  uniform float uMorph;      // bear → heart
  uniform float uBloom;      // heart → bouquet
  uniform float uHeartScale;
  uniform float uBouquetScale;
  uniform vec3 uBouquetOffset;
  uniform float uBeat;

  float stagger(vec2 uv, float amount) {
    float start = texture2D(tLaunch, uv).w;
    return smoothstep(start, start + 0.5, amount);
  }
  float morphOf(vec2 uv) { return stagger(uv, uMorph); }
  float bloomOf(vec2 uv) { return stagger(uv, uBloom); }

  vec3 homeOf(vec2 uv, vec4 info, float m, float b) {
    vec3 bear = texture2D(tBear, uv).xyz;
    bear = mix(bear, uHeartCenter + (bear - uHeartCenter) * (1.0 + 0.1 * uBeat), info.z);
    vec3 heart = texture2D(tHeart, uv).xyz * uHeartScale * (1.0 + 0.08 * uBeat * (1.0 - b));
    vec3 bouquet = uBouquetOffset + texture2D(tBouquet, uv).xyz * uBouquetScale;
    return mix(mix(bear, heart, m), bouquet, b);
  }
`;

// Each component ignores its own axis, so the field has zero divergence: particles swirl without
// bunching up or thinning out, the property that makes curl noise look like flow.
const flowChunk = /* glsl */ `
  vec3 flow(vec3 p, float t) {
    return vec3(
      sin(p.y * 2.1 + t) + cos(p.z * 1.7 - t * 0.8),
      sin(p.z * 1.9 + t * 1.1) + cos(p.x * 2.3 + t * 0.6),
      sin(p.x * 1.6 - t * 0.9) + cos(p.y * 2.2 + t * 0.7)
    );
  }
`;

const velocityShader = /* glsl */ `
  uniform float uTime;
  uniform float uDelta;
  uniform vec3 uOrigin;
  uniform float uApexY;
  uniform vec3 uRayOrigin;
  uniform vec3 uRayDir;
  uniform vec3 uPointerVelocity;
  uniform float uPointerStrength;
  uniform float uPress;
  uniform vec3 uTapOrigin;
  uniform vec3 uTapDir;
  uniform float uTap;
  ${homeChunk}
  ${flowChunk}

  vec3 offRay(vec3 p, vec3 origin, vec3 dir) {
    vec3 w = p - origin;
    return w - dir * dot(w, dir);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 info = texture2D(tInfo, uv);
    vec4 v = texture2D(textureVelocity, uv);
    vec4 launch = texture2D(tLaunch, uv);
    float age = uTime - info.x;
    float rise = max(0.3, uApexY * info.w - uOrigin.y);
    if (age < 0.0) { gl_FragColor = vec4(0.0); return; }
    if (v.w < 0.5) {
      gl_FragColor = vec4(launch.x, sqrt(2.0 * ${GRAVITY.toFixed(1)} * rise), launch.z, 1.0);
      return;
    }

    vec3 pos = texture2D(texturePosition, uv).xyz;
    float apexTime = sqrt(2.0 * rise / ${GRAVITY.toFixed(1)});
    if (launch.y > 0.5) {
      // Confetti: spreads at the top of its arc, then falls slowly and sways, like paper
      vec3 fall = vec3(0.0, -${GRAVITY.toFixed(1)}, 0.0);
      fall.xz += normalize(launch.xz + 0.0001) * 9.0 * exp(-pow((age - apexTime) / 0.3, 2.0));
      fall.x += sin(uTime * 5.0 + info.y * 40.0) * 5.0 * step(apexTime, age);
      vec3 drift = v.xyz + fall * uDelta;
      if (age > apexTime) drift *= exp(-2.2 * uDelta);
      gl_FragColor = vec4(drift, 1.0);
      return;
    }
    float m = morphOf(uv);
    float b = bloomOf(uv);
    vec3 home = homeOf(uv, info, m, b);

    float caught = smoothstep(apexTime * 0.8, apexTime + 1.5, age);
    float seed = info.y;
    // Particles along the outline move the most, so the silhouette shimmers and frays like Emotion's letter
    // ...scaled to the heart's size once it is the heart, so a small (phone) heart keeps its shape
    float edge = mix(texture2D(tBear, uv).w, texture2D(tHeart, uv).w * 0.6 * min(1.0, uHeartScale / 1.25), m);
    edge = mix(edge, texture2D(tBouquet, uv).w * 0.4, b);
    home += vec3(
      sin(uTime * (1.1 + seed) + seed * 31.0),
      cos(uTime * (0.9 + seed * 0.7) + seed * 17.0),
      sin(uTime * (1.3 - seed * 0.5) + seed * 23.0)
    ) * (0.012 + 0.02 * fract(seed * 7.1) + 0.07 * edge) * caught;
    if (fract(seed * 91.7) < 0.05 + 0.3 * edge) {
      vec3 outward = normalize(vec3(home.xy, 0.3 * home.z) + 0.0001);
      float reachOut = mix(0.45, 0.22 * min(1.0, uHeartScale / 1.25), m) * (0.4 + 0.6 * fract(seed * 13.3));
      home += outward * reachOut * pow(0.5 + 0.5 * sin(uTime * (0.45 + 0.4 * fract(seed * 5.7)) + seed * 60.0), 3.0) * caught;
    }
    vec3 acc = vec3(0.0, -${GRAVITY.toFixed(1)} * (1.0 - caught), 0.0);
    // Spread out around the top of the arc
    float apex = exp(-pow((age - apexTime) / 0.28, 2.0));
    acc.xz += normalize(launch.xz + 0.0001) * 7.0 * apex;

    // The heart's rim (the bear's heart, then the final one) keeps drifting and swirling
    vec3 bearHome = texture2D(tBear, uv).xyz;
    vec3 heartHome = texture2D(tHeart, uv).xyz;
    float rim = mix(length((bearHome - uHeartCenter).xy) / 0.45, length(heartHome.xy), m);
    float heartness = max(info.z, m) * (1.0 - b);
    float drift = caught * (0.12 + heartness * smoothstep(0.55, 1.0, rim) * mix(1.1, 0.5, m) + edge * 1.2);
    vec3 r = pos - mix(uHeartCenter, vec3(0.0), m);
    vec3 around = normalize(vec3(-r.y, r.x, 0.0) + 0.0001);
    acc += (flow(pos * 2.2, uTime * 0.7) * 0.7 + around * 0.6) * drift;
    // Swirl in transit between bear and heart
    acc += (flow(pos * 1.4, uTime * 1.3) * 2.2 + around * 1.6) * (sin(3.14159 * m) + sin(3.14159 * b));

    float stiffness = mix(0.0, 44.0, caught * caught) * (1.0 - 0.5 * heartness * smoothstep(0.6, 1.0, rim)) * (1.0 - 0.55 * edge);
    acc += (home - pos) * stiffness;

    // Pointer: push away from the ray under it and drag along with its motion
    vec3 off = offRay(pos, uRayOrigin, uRayDir);
    float d = length(off);
    float radius = 0.5 * (1.0 + 0.5 * uPress);
    // Only particles that have landed answer the pointer; the rising stream flies straight
    float reach = uPointerStrength * caught * pow(max(0.0, 1.0 - d / radius), 2.0);
    if (reach > 0.0) {
      float hold = 0.35 + 1.3 * fract(info.y * 7.31);
      // Hovering lights particles up and stirs them gently; holding the button or a finger down pushes hard
      acc += (off / max(d, 0.0001) * mix(7.0, 56.0, uPress) + uPointerVelocity * mix(18.0, 40.0, uPress) + flow(pos * 5.0, uTime * 4.0) * 6.0) * reach * hold;
    }
    // Tap: a ring pushed outward from where the finger or click landed
    vec3 tapOff = offRay(pos, uTapOrigin, uTapDir);
    float tapD = length(tapOff);
    acc += tapOff / max(tapD, 0.0001) * 150.0 * uTap * caught * pow(max(0.0, 1.0 - tapD / 0.9), 2.0);

    vec3 vel = (v.xyz + acc * uDelta) * exp(-mix(0.12, 7.5, caught) * uDelta);
    gl_FragColor = vec4(vel, 1.0);
  }
`;

const positionShader = /* glsl */ `
  uniform float uTime;
  uniform float uDelta;
  uniform vec3 uOrigin;
  uniform float uSnap; // reduced motion: every particle sits at home
  uniform float uFloorY; // a little below the bottom of the screen, in the bear's own space
  uniform vec3 uRayOrigin;
  uniform vec3 uRayDir;
  uniform float uPointerStrength;
  uniform float uPress;
  ${homeChunk}

  // How brightly the pointer lights this particle: near the ray under it, a little wider while pressed
  float lit(vec3 p) {
    vec3 w = p - uRayOrigin;
    float d = length(w - uRayDir * dot(w, uRayDir));
    return uPointerStrength * pow(max(0.0, 1.0 - d / (0.42 * (1.0 + 0.4 * uPress))), 1.5);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 v = texture2D(textureVelocity, uv);
    if (uSnap > 0.5) {
      vec4 info = texture2D(tInfo, uv);
      bool shown = info.x < 1e5 && texture2D(tLaunch, uv).y < 0.5; // no confetti without motion
      gl_FragColor = vec4(homeOf(uv, info, morphOf(uv), bloomOf(uv)), shown ? 1.0 : 0.0);
      return;
    }
    if (v.w < 0.5) { gl_FragColor = vec4(uOrigin, 0.0); return; } // w = 0: not thrown yet
    vec4 previous = texture2D(texturePosition, uv);
    if (previous.w < -0.5) { gl_FragColor = previous; return; } // confetti that has fallen off screen: gone
    if (texture2D(tLaunch, uv).y > 0.5 && previous.w > 0.5 && previous.y < uFloorY) {
      gl_FragColor = vec4(previous.xyz, -1.0);
      return;
    }
    if (previous.w < 0.5) {
      // Just thrown: start from a spot across the box's mouth, already as far along as its own
      // launch time says, so particles thrown within one frame don't move in lockstep rings
      vec4 info = texture2D(tInfo, uv);
      float age = max(0.0, uTime - info.x);
      float angle = info.y * 43.98;
      vec3 mouth = vec3(cos(angle), 0.0, sin(angle)) * 0.22 * sqrt(fract(info.y * 13.7));
      vec3 thrown = v.xyz * age - vec3(0.0, 0.5 * ${GRAVITY.toFixed(1)} * age * age, 0.0);
      gl_FragColor = vec4(uOrigin + mouth + thrown, 1.0);
      return;
    }
    // w = 1 + glow: lights up under the pointer, fades over about half a second after it leaves
    vec3 next = previous.xyz + v.xyz * uDelta;
    float glow = max(lit(next), (previous.w - 1.0) * exp(-2.4 * uDelta));
    gl_FragColor = vec4(next, 1.0 + min(glow, 1.0));
  }
`;

// ── Drawing: matte, opaque flecks with hard edges, lit like tiny beads ──

const pointsVertex = /* glsl */ `
  uniform sampler2D uPositions;
  uniform sampler2D uVelocities;
  uniform sampler2D tLaunch;
  uniform float uTime;
  uniform float uPointScale;
  uniform float uSizeScale;
  uniform float uConfettiSize;
  uniform float uMorph;
  uniform float uBloom;
  uniform float uBouquetScale;
  uniform float uBeat;
  attribute vec2 aRef;
  attribute float aConfetti;
  attribute vec3 aColor;
  attribute vec3 aHeartColor;
  attribute vec3 aBouquetColor;
  attribute float aSize;
  attribute float aHeart;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vFlight;
  varying float vSpin;
  varying float vConfetti;
  varying float vGlow;

  void main() {
    vec4 sim = texture2D(uPositions, aRef);
    if (sim.w < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec4 mvPosition = modelViewMatrix * vec4(sim.xyz, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float glow = clamp(sim.w - 1.0, 0.0, 1.0) * (1.0 - aConfetti);
    vGlow = glow;
    float start = texture2D(tLaunch, aRef).w;
    float m = smoothstep(start, start + 0.5, uMorph);
    float b = smoothstep(start, start + 0.5, uBloom);
    // The beads scale with the bouquet's size against the bear's, so it stays as densely packed
    float bouquetGrowth = clamp(uBouquetScale * 2.0 / 3.25, 0.85, 1.6);
    gl_PointSize = (aConfetti > 0.5 ? uConfettiSize : aSize * uSizeScale * (1.0 + 0.7 * glow) * mix(1.0, bouquetGrowth, b)) * uPointScale / -mvPosition.z;
    vec3 color = mix(mix(aColor, aHeartColor, m), aBouquetColor, b);
    // Heartbeat: the heart's particles swell toward paler blues for a moment
    color = mix(color, vec3(0.62, 0.8, 1.0), max(aHeart, m) * (1.0 - b) * uBeat * 0.55);
    // Lit by the pointer: brighter and paler
    color = mix(color, vec3(0.8, 0.94, 1.0), glow * 0.75) * (1.0 + 0.9 * glow);
    // Glitter: now and then a fleck catches the light
    float glint = pow(max(0.0, sin(uTime * (1.2 + aSeed * 2.6) + aSeed * 97.0)), 60.0);
    vColor = mix(color, vec3(0.92, 0.96, 1.0), glint * (1.0 - aConfetti) * 0.9);

    // Fast flecks flatten into tumbling slivers; paper confetti always tumbles
    vFlight = aConfetti > 0.5 ? 1.0 : clamp((length(texture2D(uVelocities, aRef).xyz) - 1.5) / 4.0, 0.0, 1.0);
    vSpin = aSeed * 6.2832 + uTime * (3.0 + aSeed * 5.0) * vFlight;
    vConfetti = aConfetti;
  }
`;

const pointsFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vFlight;
  varying float vSpin;
  varying float vConfetti;

  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    c.y = -c.y;
    float s = sin(vSpin);
    float k = cos(vSpin);
    vec2 q = mat2(k, -s, s, k) * c;
    float tumble = 0.62 + 0.38 * abs(sin(vSpin * 1.3));
    if (vConfetti > 0.5) {
      // A paper strip, turning over as it falls
      if (abs(q.x) > 0.9 || abs(q.y) > 0.34 * (0.35 + 0.65 * abs(cos(vSpin * 0.7)))) discard;
      gl_FragColor = vec4(vColor * tumble, 1.0);
      return;
    }
    q.y /= mix(1.0, 0.4, vFlight);
    if (dot(q, q) > 1.0) discard;
    vec3 normal = vec3(c, sqrt(max(0.0, 1.0 - dot(c, c))));
    float bead = 0.5 + 0.62 * max(dot(normal, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
    gl_FragColor = vec4(vColor * mix(bead, tumble, vFlight), 1.0);
  }
`;

// A soft light around each particle the pointer has lit, drawn additively over the flecks
const haloVertex = /* glsl */ `
  uniform sampler2D uPositions;
  uniform float uPointScale;
  uniform float uSizeScale;
  attribute vec2 aRef;
  attribute float aConfetti;
  attribute float aSize;
  varying float vGlow;

  void main() {
    vec4 sim = texture2D(uPositions, aRef);
    float glow = sim.w < 0.5 ? 0.0 : clamp(sim.w - 1.0, 0.0, 1.0) * (1.0 - aConfetti);
    vGlow = glow;
    if (glow < 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec4 mvPosition = modelViewMatrix * vec4(sim.xyz, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uSizeScale * 7.0 * glow * uPointScale / -mvPosition.z;
  }
`;

const haloFragment = /* glsl */ `
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float light = (1.0 - d) * (1.0 - d) * vGlow * 0.6;
    gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * light, light);
  }
`;

// ── Setup ───────────────────────────────────────────────────

export interface StepInput {
  time: number;
  delta: number;
  /** Where the confetti leaves the box, in the bear's own space */
  origin: Vector3;
  /** Height of the top of the screen, in the bear's own space */
  apexY: number;
  /** A little below the bottom of the screen, in the bear's own space: confetti past it is removed */
  floorY: number;
  morph: number;
  heartScale: number;
  bloom: number;
  bouquetScale: number;
  /** Where the bouquet's center sits, in the bear's own space */
  bouquetOffset: Vector3;
  beat: number;
  rayOrigin: Vector3;
  rayDir: Vector3;
  pointerVelocity: Vector3;
  pointerStrength: number;
  press: number;
  tapOrigin: Vector3;
  tapDir: Vector3;
  tap: number;
  /** Reduced motion: no physics, every particle at home */
  snap: boolean;
}

export interface BearParticles {
  /** The flecks and their glow, to add to the scene */
  object: Group;
  material: ShaderMaterial;
  step(input: StepInput): void;
  dispose(): void;
}

/**
 * How near each point sits to the shape's outline as seen from the front, 0 inside → 1 on the edge.
 * Points are binned on a grid; a breadth-first search from the empty cells gives each filled cell
 * its distance to the outside.
 */
function outlineNearness(positions: Float32Array, count: number, cell: number, band = 4) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, positions[i * 3]);
    maxX = Math.max(maxX, positions[i * 3]);
    minY = Math.min(minY, positions[i * 3 + 1]);
    maxY = Math.max(maxY, positions[i * 3 + 1]);
  }
  const cols = Math.ceil((maxX - minX) / cell) + 3;
  const rows = Math.ceil((maxY - minY) / cell) + 3;
  const cellOf = (i: number) =>
    (Math.floor((positions[i * 3 + 1] - minY) / cell) + 1) * cols + Math.floor((positions[i * 3] - minX) / cell) + 1;
  const filled = new Uint8Array(cols * rows);
  for (let i = 0; i < count; i++) filled[cellOf(i)] = 1;
  const distance = new Int32Array(cols * rows).fill(-1);
  const queue: number[] = [];
  for (let c = 0; c < filled.length; c++) {
    if (filled[c]) continue;
    distance[c] = 0;
    queue.push(c);
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const x = c % cols;
    for (const n of [x > 0 ? c - 1 : -1, x < cols - 1 ? c + 1 : -1, c - cols, c + cols]) {
      if (n >= 0 && n < filled.length && distance[n] < 0) {
        distance[n] = distance[c] + 1;
        queue.push(n);
      }
    }
  }
  const nearness = new Float32Array(count);
  for (let i = 0; i < count; i++) nearness[i] = Math.max(0, 1 - (distance[cellOf(i)] - 1) / band);
  return nearness;
}

const CONFETTI_COLORS: [number, number, number][] = [
  [0.25, 0.45, 1],
  [0.5, 0.7, 1],
  [0.86, 0.92, 1],
  [0.1, 0.3, 0.9],
  [0.62, 0.78, 1],
];

export function createBearParticles(
  renderer: WebGLRenderer,
  bear: BearCloud,
  heart: HeartCloud,
  bouquet: BouquetCloud,
  confetti: number,
): BearParticles | null {
  const total = bear.count + confetti;
  const size = Math.ceil(Math.sqrt(total));
  const gpgpu = new GPUComputationRenderer(size, size, renderer);
  // Full float where the GPU can render to it, half float (most phones) otherwise
  if (!renderer.extensions.has("EXT_color_buffer_float")) gpgpu.setDataType(HalfFloatType);

  // Each bear particle becomes the heart point, and then the bouquet point, at the same rank by
  // height, so each change flows top to top and bottom to bottom instead of scrambling
  const byHeight = (positions: Float32Array) =>
    Array.from({ length: bear.count }, (_, i) => i).sort((a, b) => positions[a * 3 + 1] - positions[b * 3 + 1]);
  const bearOrder = byHeight(bear.positions);
  const heartOrder = byHeight(heart.positions);
  const heartIndex = new Uint32Array(bear.count);
  bearOrder.forEach((b, rank) => (heartIndex[b] = heartOrder[rank]));
  const bouquetOrder = byHeight(bouquet.positions);
  const bouquetIndex = new Uint32Array(bear.count);
  bearOrder.forEach((b, rank) => (bouquetIndex[b] = bouquetOrder[rank]));

  const bearEdge = outlineNearness(bear.positions, bear.count, 0.04);
  const heartEdge = outlineNearness(heart.positions, bear.count, 0.03);
  const bouquetEdge = outlineNearness(bouquet.positions, bear.count, 0.025, 3);
  const random = seededRandom(91);
  const texels = size * size;
  const bearHome = new Float32Array(texels * 4);
  const heartHome = new Float32Array(texels * 4);
  const bouquetHome = new Float32Array(texels * 4);
  const info = new Float32Array(texels * 4);
  const launch = new Float32Array(texels * 4);
  const refs = new Float32Array(total * 2);
  const seeds = new Float32Array(total);
  const colors = new Float32Array(total * 3);
  colors.set(bear.colors);
  const heartColors = new Float32Array(total * 3);
  const bouquetColors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  sizes.set(bear.sizes);
  const inHeartFlags = new Float32Array(total);
  inHeartFlags.set(bear.heart);
  const confettiFlags = new Float32Array(total);
  for (let i = 0; i < texels; i++) {
    const real = i < bear.count;
    const paper = !real && i < total;
    if (real) {
      const h = heartIndex[i];
      bearHome.set([bear.positions[i * 3], bear.positions[i * 3 + 1], bear.positions[i * 3 + 2], bearEdge[i]], i * 4);
      heartHome.set([heart.positions[h * 3], heart.positions[h * 3 + 1], heart.positions[h * 3 + 2], heartEdge[h]], i * 4);
      heartColors.set([heart.colors[h * 3], heart.colors[h * 3 + 1], heart.colors[h * 3 + 2]], i * 3);
      const q = bouquetIndex[i];
      bouquetHome.set([bouquet.positions[q * 3], bouquet.positions[q * 3 + 1], bouquet.positions[q * 3 + 2], bouquetEdge[q]], i * 4);
      bouquetColors.set([bouquet.colors[q * 3], bouquet.colors[q * 3 + 1], bouquet.colors[q * 3 + 2]], i * 3);
    }
    const inHeart = real ? bear.heart[i] : 0;
    // A stream over about half a second; the bear's heart goes up last. Spare texels never launch.
    const delay = real || paper ? random() * 0.55 + inHeart * 0.25 : 1e6;
    const seed = random();
    // Each aims for its own height near the top, so the top of the arc is a dome, not a flat band
    info.set([delay, seed, inHeart, paper ? 0.7 + random() * 0.38 : 0.6 + random() * 0.4], i * 4);
    const angle = random() * Math.PI * 2;
    const throwSpeed = paper ? 0.8 + random() * 1.6 : 0.3 + random() * 1.1;
    const yNorm = real ? (bear.positions[i * 3 + 1] + 1.62) / 3.25 : 0;
    launch.set([Math.cos(angle) * throwSpeed, paper ? 1 : 0, Math.sin(angle) * throwSpeed * 0.7, 0.32 * random() + 0.18 * (1 - yNorm)], i * 4);
    if (paper) {
      const color = CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)];
      colors.set(color, i * 3);
      heartColors.set(color, i * 3);
      bouquetColors.set(color, i * 3);
      confettiFlags[i] = 1;
    }
    if (real || paper) {
      refs[i * 2] = ((i % size) + 0.5) / size;
      refs[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
      seeds[i] = seed;
    }
  }
  const dataTexture = (data: Float32Array) => {
    const texture = new DataTexture(data, size, size, RGBAFormat, FloatType);
    texture.needsUpdate = true;
    return texture;
  };
  const textures = {
    tBear: dataTexture(bearHome),
    tHeart: dataTexture(heartHome),
    tBouquet: dataTexture(bouquetHome),
    tInfo: dataTexture(info),
    tLaunch: dataTexture(launch),
  };
  const homeUniforms = () => ({
    ...Object.fromEntries(Object.entries(textures).map(([name, texture]) => [name, { value: texture }])),
    uHeartCenter: { value: new Vector3(...bear.heartCenter) },
    uMorph: { value: 0 },
    uBloom: { value: 0 },
    uHeartScale: { value: 1 },
    uBouquetScale: { value: 1 },
    uBouquetOffset: { value: new Vector3() },
    uBeat: { value: 0 },
  });

  const positionVariable = gpgpu.addVariable("texturePosition", positionShader, gpgpu.createTexture());
  const velocityVariable = gpgpu.addVariable("textureVelocity", velocityShader, gpgpu.createTexture());
  gpgpu.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
  gpgpu.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
  const pu = positionVariable.material.uniforms;
  const vu = velocityVariable.material.uniforms;
  const pointerUniforms = () => ({
    uRayOrigin: { value: new Vector3(0, 0, 50) },
    uRayDir: { value: new Vector3(0, 0, -1) },
    uPointerStrength: { value: 0 },
    uPress: { value: 0 },
  });
  Object.assign(pu, homeUniforms(), pointerUniforms(), { uTime: { value: -1 }, uDelta: { value: 0 }, uOrigin: { value: new Vector3() }, uSnap: { value: 0 }, uFloorY: { value: -50 } });
  Object.assign(vu, homeUniforms(), pointerUniforms(), {
    uTime: { value: -1 },
    uDelta: { value: 0 },
    uOrigin: { value: new Vector3() },
    uApexY: { value: 2 },
    uPointerVelocity: { value: new Vector3() },
    uTapOrigin: { value: new Vector3(0, 0, 50) },
    uTapDir: { value: new Vector3(0, 0, -1) },
    uTap: { value: 0 },
  });
  const dispose = () => {
    gpgpu.dispose();
    Object.values(textures).forEach((texture) => texture.dispose());
  };
  if (gpgpu.init()) {
    dispose();
    return null;
  }

  const geometry = new BufferGeometry();
  const homes = new Float32Array(total * 3);
  homes.set(bear.positions);
  geometry.setAttribute("position", new BufferAttribute(homes, 3));
  geometry.setAttribute("aRef", new BufferAttribute(refs, 2));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aHeartColor", new BufferAttribute(heartColors, 3));
  geometry.setAttribute("aBouquetColor", new BufferAttribute(bouquetColors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aHeart", new BufferAttribute(inHeartFlags, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geometry.setAttribute("aConfetti", new BufferAttribute(confettiFlags, 1));
  const material = new ShaderMaterial({
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
    uniforms: {
      uPositions: { value: gpgpu.getCurrentRenderTarget(positionVariable).texture },
      uVelocities: { value: gpgpu.getCurrentRenderTarget(velocityVariable).texture },
      tLaunch: { value: textures.tLaunch },
      uTime: { value: 0 },
      uPointScale: { value: 1 },
      // Fine glitter; fewer particles (phones) get proportionally larger flecks
      uSizeScale: { value: 0.017 * Math.sqrt(80000 / bear.count) },
      uConfettiSize: { value: 0.12 },
      uMorph: { value: 0 },
      uBloom: { value: 0 },
      uBouquetScale: { value: 1 },
      uBeat: { value: 0 },
    },
  });
  const halo = new ShaderMaterial({
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uPositions: material.uniforms.uPositions,
      uPointScale: material.uniforms.uPointScale,
      uSizeScale: material.uniforms.uSizeScale,
    },
  });
  const object = new Group();
  const points = new Points(geometry, material);
  const glow = new Points(geometry, halo);
  glow.renderOrder = 1;
  for (const layer of [points, glow]) {
    layer.frustumCulled = false; // the real positions live on the GPU, not in the geometry
    object.add(layer);
  }

  return {
    object,
    material,
    step(input) {
      for (const uniforms of [pu, vu]) {
        uniforms.uDelta.value = input.delta;
        uniforms.uOrigin.value.copy(input.origin);
        uniforms.uMorph.value = input.morph;
        uniforms.uBloom.value = input.bloom;
        uniforms.uHeartScale.value = input.heartScale;
        uniforms.uBouquetScale.value = input.bouquetScale;
        uniforms.uBouquetOffset.value.copy(input.bouquetOffset);
        uniforms.uBeat.value = input.beat;
        uniforms.uRayOrigin.value.copy(input.rayOrigin);
        uniforms.uRayDir.value.copy(input.rayDir);
        uniforms.uPointerStrength.value = input.pointerStrength;
        uniforms.uPress.value = input.press;
      }
      pu.uSnap.value = input.snap ? 1 : 0;
      pu.uFloorY.value = input.floorY;
      pu.uTime.value = input.time;
      vu.uTime.value = input.time;
      vu.uApexY.value = input.apexY;
      vu.uPointerVelocity.value.copy(input.pointerVelocity);
      vu.uTapOrigin.value.copy(input.tapOrigin);
      vu.uTapDir.value.copy(input.tapDir);
      vu.uTap.value = input.tap;
      gpgpu.compute();
      material.uniforms.uPositions.value = gpgpu.getCurrentRenderTarget(positionVariable).texture;
      material.uniforms.uVelocities.value = gpgpu.getCurrentRenderTarget(velocityVariable).texture;
      material.uniforms.uTime.value = input.time;
      material.uniforms.uMorph.value = input.morph;
      material.uniforms.uBloom.value = input.bloom;
      material.uniforms.uBouquetScale.value = input.bouquetScale;
      material.uniforms.uBeat.value = input.beat;
    },
    dispose() {
      dispose();
      geometry.dispose();
      material.dispose();
      halo.dispose();
    },
  };
}
