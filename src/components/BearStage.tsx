"use client";

// The live particles, in React Three Fiber. Loaded with next/dynamic only once the visitor is about
// to open the gift, so three.js and fiber never weigh down the first paint.
//
// The Canvas owns the renderer, scene and camera; <BearParticles> owns the simulation
// (lib/bear-particles.ts) and advances it in useFrame. GiftReveal drives it through the handle it
// receives in onReady.

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { buildBearCloud, buildHeartCloud, pointBudget } from "@/lib/bear-points";
import { buildBouquetCloud } from "@/lib/bouquet-points";
import { createBearParticles, type BearParticles as Simulation } from "@/lib/bear-particles";
import { FOV, framing, pulseAt, type ScreenPoint } from "@/lib/bear-scene";

export interface BearStageHandle {
  /** Throws the particles and confetti up from `from` (stage pixels, inside the box); `still` shows the finished bear at once */
  start(options: { still: boolean; from: ScreenPoint }): void;
  /**
   * Where the scroll story is: the turn to the right and the vertical flip (radians), and the
   * changes from bear to heart and from heart to bouquet (0 → 1 each)
   */
  setStory(story: { turn: number; flip: number; morph: number; bloom: number }): void;
  /** The pointer or finger over the stage, in stage pixels, or null once it has left */
  point(x: number | null, y?: number): void;
  /** Held down (mouse button or finger): a wider, stronger stir */
  press(down: boolean): void;
  /** A tap or click: a ring pushed out from that spot */
  tap(x: number, y: number): void;
  /** Seconds since the confetti was thrown, or -1 before */
  elapsed(): number;
}

interface Props {
  className?: string;
  /** Called once: with the handle, or null if this GPU can't run the simulation */
  onReady: (handle: BearStageHandle | null) => void;
  onLost: () => void;
}

const ASSEMBLED = 3.6; // seconds after the throw: the bear has formed and its heart starts beating

export default function BearStage({ className, onReady, onLost }: Props) {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  return (
    <div className={className}>
      <Canvas
        flat
        dpr={[1, coarse ? 1.5 : 2]}
        frameloop="demand"
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: FOV, near: 0.1, far: 200, position: [0, 0, 10] }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onLost();
          });
        }}
      >
        <BearParticles onReady={onReady} />
      </Canvas>
    </div>
  );
}

function BearParticles({ onReady }: Pick<Props, "onReady">) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const scene = useThree((state) => state.scene);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const invalidate = useThree((state) => state.invalidate);
  const group = useRef<Group>(null);

  // Everything the frame loop reads, kept out of React state so nothing re-renders per frame
  const live = useRef({
    sim: null as Simulation | null,
    startTime: -1,
    still: false,
    opening: { x: 0, y: 0 } as ScreenPoint,
    morph: 1,
    bloom: 1,
    turn: 0,
    flip: 0,
    pointer: { active: false, ndc: new Vector2(9, 9), fresh: true, velocity: new Vector3(), previous: new Vector3(), strength: 0, press: 0, down: false },
    tap: { ndc: new Vector2(9, 9), strength: 0 },
  });

  useEffect(() => {
    const state = live.current;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const count = pointBudget({ width: window.innerWidth, height: window.innerHeight, coarse });
    const sim = createBearParticles(gl, buildBearCloud({ count }), buildHeartCloud({ count }), buildBouquetCloud({ count }), coarse ? 450 : 900);
    const holder = group.current;
    if (!sim || !holder) {
      onReady(null);
      return;
    }
    state.sim = sim;
    holder.add(sim.object);
    gl.compile(scene, camera); // compile now, so the first tap doesn't stall on it
    invalidate();

    // Stop simulating while the stage is off screen or the tab is hidden
    let visible = true;
    const resume = () => {
      if (state.startTime >= 0 && !state.still) setFrameloop(visible && !document.hidden ? "always" : "never");
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    observer.observe(gl.domElement);
    document.addEventListener("visibilitychange", resume);

    const toNdc = (x: number, y: number, target: Vector2) => {
      const { width, height } = gl.domElement.getBoundingClientRect();
      return target.set((x / (width || 1)) * 2 - 1, 1 - (y / (height || 1)) * 2);
    };

    onReady({
      start({ still, from }) {
        if (state.startTime >= 0) return;
        state.still = still;
        state.opening = from;
        state.startTime = performance.now();
        state.tap.strength = 0; // the click that opened the gift is not a tap on the particles
        if (still) invalidate();
        else resume();
      },
      setStory({ turn, flip, morph, bloom }) {
        state.turn = turn;
        state.flip = flip;
        state.morph = morph;
        state.bloom = bloom;
        if (state.still) invalidate();
      },
      point(x, y = 0) {
        if (x === null) {
          state.pointer.active = false;
          return;
        }
        toNdc(x, y, state.pointer.ndc);
        if (!state.pointer.active) state.pointer.fresh = true;
        state.pointer.active = true;
      },
      press(down) {
        state.pointer.down = down;
      },
      tap(x, y) {
        toNdc(x, y, state.tap.ndc);
        state.tap.strength = 1;
      },
      elapsed: () => (state.startTime < 0 ? -1 : (performance.now() - state.startTime) / 1000),
    });

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      holder.remove(sim.object);
      sim.dispose();
      state.sim = null;
    };
    // Built once per renderer; onReady is a stable callback from GiftReveal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  const raycaster = useRef(new Raycaster());
  const scratch = useRef({ hit: new Vector3(), origin: new Vector3(), tapOrigin: new Vector3(), tapDir: new Vector3(), rayOrigin: new Vector3(), rayDir: new Vector3(), moved: new Vector3(), bouquet: new Vector3() });

  useFrame((state, frameDelta) => {
    const s = live.current;
    const sim = s.sim;
    const bear = group.current;
    if (!sim || !bear) return;
    const v = scratch.current;

    const { width, height } = state.size;
    const frame = framing(width, height);
    camera.position.set(0, 0, frame.distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const toWorld = ({ x, y }: ScreenPoint, target: Vector3) => target.set((x - width / 2) / frame.unit, (height / 2 - y) / frame.unit, 0);
    toWorld(frame.center, bear.position);
    // Pixels across the drawing buffer per world unit at distance 1: point sizes are in world units
    sim.material.uniforms.uPointScale.value = (height * state.gl.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));

    const seconds = s.startTime < 0 ? -1 : (performance.now() - s.startTime) / 1000;
    // The shape itself only moves with the scroll; its particles never stop
    bear.rotation.set(s.flip, s.turn, 0);
    bear.updateMatrixWorld();
    if (seconds < 0) return;

    const delta = Math.min(frameDelta, 1 / 30); // a dropped frame never flings particles away
    const toLocal = (ndc: Vector2, origin: Vector3, dir: Vector3) => {
      raycaster.current.setFromCamera(ndc, camera);
      const ray = raycaster.current.ray;
      bear.worldToLocal(origin.copy(ray.origin));
      dir.copy(ray.direction).transformDirection(bear.matrixWorld.clone().invert());
      return ray;
    };

    // The pointer as a ray in the bear's space, and how fast it moves across the bear's plane
    const p = s.pointer;
    const ray = toLocal(p.ndc, v.rayOrigin, v.rayDir);
    const hit = bear.worldToLocal(ray.at(camera.position.z, v.hit));
    if (p.fresh) p.previous.copy(hit);
    p.fresh = false;
    v.moved.copy(hit).sub(p.previous).divideScalar(Math.max(delta, 1 / 120)).clampLength(0, 8);
    p.velocity.lerp(v.moved, 0.4);
    p.previous.copy(hit);
    p.strength += ((p.active ? 1 : 0) - p.strength) * 0.15;
    p.press += ((p.down ? 1 : 0) - p.press) * 0.2;
    toLocal(s.tap.ndc, v.tapOrigin, v.tapDir);
    const tap = s.tap.strength;
    s.tap.strength = Math.max(0, s.tap.strength - delta / 0.3);

    const topOfScreen = height / 2 / frame.unit - bear.position.y;
    sim.step({
      time: s.still ? -1 : seconds,
      delta: s.still ? 0 : delta,
      origin: bear.worldToLocal(toWorld(s.opening, v.origin)),
      apexY: topOfScreen - 0.15,
      floorY: -height / 2 / frame.unit - bear.position.y - 0.4,
      morph: s.morph,
      heartScale: frame.heartHalf / frame.unit,
      bloom: s.bloom,
      bouquetScale: frame.bouquetHalf / frame.unit,
      bouquetOffset: v.bouquet.set(0, (frame.center.y - frame.bouquetCenter.y) / frame.unit, 0),
      beat: s.still ? 0 : pulseAt(seconds - ASSEMBLED),
      rayOrigin: v.rayOrigin,
      rayDir: v.rayDir,
      pointerVelocity: p.velocity,
      pointerStrength: s.still ? 0 : p.strength,
      press: p.press,
      tapOrigin: v.tapOrigin,
      tapDir: v.tapDir,
      tap: s.still ? 0 : tap,
      snap: s.still,
    });
  });

  return <group ref={group} />;
}
