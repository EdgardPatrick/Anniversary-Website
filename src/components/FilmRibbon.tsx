"use client";

// The photo film as a real 3D ribbon, in React Three Fiber. Loaded with next/dynamic once the
// photos are about to appear, so three.js never weighs down the first paint.
//
// Each photo is its own strip of quads with its own texture, laid along the path from
// lib/film-path.ts. Sliding the film along that path gives the entrance (the film comes forward
// up from below the screen), the scroll from photo to photo (the one in focus is flat and
// facing you) and the exit (off the top, or off the left on a phone). Film further back is out
// of focus, picture and outline alike, and dimmer; film coming forward sharpens.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  SRGBColorSpace,
  ShaderMaterial,
} from "three";
import type { MemoryPhoto } from "@/data/memory-photos";
import { RAIL, buildFilmPath, depthLook, entryOffset, filmLayout, samplePath, type FilmLayout, type FilmPath, type Vec3 } from "@/lib/film-path";

export interface FilmState {
  position: number;
  entrance: number;
  reduced: boolean;
}

interface Props {
  photos: MemoryPhoto[];
  state: FilmState;
  onLost?: () => void;
}

const FOV = 35;
/** Quads along each frame: enough that the bends read as smooth curves */
const SEGMENTS = 20;

export default function FilmRibbon({ photos, state, onLost }: Props) {
  // A context lost while unmounting is the canvas being thrown away on purpose, not a failing GPU
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  return (
    <Canvas
      flat
      dpr={[1, coarse ? 1.5 : 2]}
      frameloop="demand"
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, near: 1, far: 40000, position: [0, 0, 1000] }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          if (mounted.current) onLost?.();
        });
      }}
    >
      <Film photos={photos} state={state} />
    </Canvas>
  );
}

function Film({ photos, state }: Pick<Props, "photos" | "state">) {
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);
  const group = useRef<Group>(null);
  const live = useRef(state);
  const { position, entrance, reduced } = state;
  // Every prop change is a new frame to draw
  useEffect(() => {
    live.current = { position, entrance, reduced };
    invalidate();
  }, [position, entrance, reduced, invalidate]);

  const layout = useMemo(() => filmLayout(size.width, size.height), [size.width, size.height]);
  const path = useMemo(
    () => buildFilmPath(layout, [layout.focus.x - size.width / 2, size.height / 2 - layout.focus.y, 0], cameraDistance(size.height)),
    [layout, size.width, size.height],
  );

  const placed = useRef<Piece[]>([]);
  useEffect(() => {
    const root = group.current;
    if (!root) return;
    const pieces = buildPieces(photos, layout, Math.min(dpr, 2), invalidate);
    const meshes = pieces.map(piece => piece.mesh);
    root.add(...meshes);
    placed.current = pieces;
    invalidate();
    return () => {
      placed.current = [];
      root.remove(...meshes);
      pieces.forEach(piece => piece.dispose());
    };
  }, [photos, layout, dpr, invalidate]);

  useFrame((frame) => {
    const { width, height } = frame.size;
    const camera = frame.camera as PerspectiveCamera;
    camera.fov = FOV;
    camera.aspect = width / height;
    // One world unit is one CSS pixel on the z = 0 plane
    camera.position.set(0, 0, cameraDistance(height));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    layPieces(placed.current, path, layout, live.current);
  });

  return <group ref={group} />;
}

/** How far the camera sits so one world unit is one CSS pixel on the z = 0 plane */
const cameraDistance = (height: number) => height / (2 * Math.tan((FOV * Math.PI) / 360));

const scratch = { p: [0, 0, 0] as Vec3, t: [0, 0, 0] as Vec3, c: [0, 0, 0] as Vec3 };

// Lays every photo along the path, where the scroll has moved it to
function layPieces(pieces: Piece[], path: FilmPath, layout: FilmLayout, { position, entrance, reduced }: FilmState) {
  const L = layout.length;
  // Before it enters, the first photo waits at the far end of the path
  const shift = entryOffset(entrance, reduced, path.entry / L + 0.6);
  const opacity = reduced ? Math.min(1, Math.max(0, entrance)) : 1;
  const half = layout.across / 2;
  const { p, t, c } = scratch;

  for (const piece of pieces) {
    const center = (piece.index - position + shift) * L;
    // Gone past the exit, or still waiting beyond the entry: nothing to draw
    const visible = entrance > 0 && center > -path.exit - L && center < path.entry + L;
    piece.mesh.visible = visible;
    if (!visible) continue;
    piece.material.uniforms.opacity.value = opacity;
    // Draw the film at the back first, so the film in front blends over it
    piece.mesh.renderOrder = -Math.abs(center);

    const { positions, tint, blur, fade } = piece;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = center + (i / SEGMENTS - 0.5) * L;
      samplePath(path, s, p, t, c);
      const look = depthLook(s, p[2], path, L);
      // Lit by how squarely it faces the viewer, and dimmer the further back it is
      const face = Math.abs(t[0] * c[1] - t[1] * c[0]);
      const shade = (0.45 + 0.55 * face) * look.light;
      for (let j = 0; j < 2; j++) {
        const v = i * 2 + j;
        // Out of focus, the film's edge spreads a little and goes soft (the shader feathers it)
        const side = (j === 0 ? -half : half) * (1 + 0.12 * look.blur);
        positions[v * 3] = p[0] + c[0] * side;
        positions[v * 3 + 1] = p[1] + c[1] * side;
        positions[v * 3 + 2] = p[2] + c[2] * side;
        tint[v * 3] = tint[v * 3 + 1] = tint[v * 3 + 2] = shade;
        blur[v] = look.blur;
        fade[v] = look.fade;
      }
    }
    const geometry = piece.mesh.geometry;
    for (const name of ["position", "tint", "blur", "fade"]) geometry.attributes[name].needsUpdate = true;
  }
}

interface Piece {
  /** Photo number along the film, from 0 */
  index: number;
  mesh: Mesh;
  material: ShaderMaterial;
  positions: Float32Array;
  tint: Float32Array;
  blur: Float32Array;
  fade: Float32Array;
  dispose: () => void;
}

// Sharp and soft copies of the same frame, mixed by how far back the film is. The sharp copy is
// also read from smaller mipmaps as it softens, so the change is gradual.
const vertexShader = /* glsl */ `
  attribute vec3 tint;
  attribute float blur;
  attribute float fade;
  attribute float edge;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vBlur;
  varying float vFade;
  varying float vEdge;
  void main() {
    vUv = uv;
    vTint = tint;
    vBlur = blur;
    vFade = fade;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Out of focus, like a camera lens: the picture softens and so does the film's outline, which
// feathers out across its edges instead of staying a crisp line
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D softMap;
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vBlur;
  varying float vFade;
  varying float vEdge;
  void main() {
    vec4 sharp = texture2D(map, vUv, vBlur * 4.0);
    vec4 soft = texture2D(softMap, vUv);
    vec4 color = mix(sharp, soft, smoothstep(0.1, 0.9, vBlur));
    float rim = min(vEdge, 1.0 - vEdge);
    float outline = smoothstep(0.0, 0.004 + 0.16 * vBlur, rim);
    gl_FragColor = vec4(color.rgb * vTint, color.a * outline * vFade * opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildPieces(photos: MemoryPhoto[], layout: FilmLayout, dpr: number, invalidate: () => void): Piece[] {
  return photos.map((photo, index) => {
    const art = drawFrame(layout, dpr, photo, index, invalidate);
    const vertices = (SEGMENTS + 1) * 2;
    const positions = new Float32Array(vertices * 3);
    const tint = new Float32Array(vertices * 3);
    const blur = new Float32Array(vertices);
    const fade = new Float32Array(vertices);
    const uvs = new Float32Array(vertices * 2);
    const edge = new Float32Array(vertices);
    const indices: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      for (let j = 0; j < 2; j++) {
        const k = (i * 2 + j) * 2;
        const along = i / SEGMENTS;
        edge[i * 2 + j] = j;
        // The texture is drawn as the frame looks when it lies flat in focus
        if (layout.vertical) {
          uvs[k] = j;
          uvs[k + 1] = 1 - along;
        } else {
          uvs[k] = along;
          uvs[k + 1] = j;
        }
      }
      if (i < SEGMENTS) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("tint", new BufferAttribute(tint, 3));
    geometry.setAttribute("blur", new BufferAttribute(blur, 1));
    geometry.setAttribute("fade", new BufferAttribute(fade, 1));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("edge", new BufferAttribute(edge, 1));
    geometry.setIndex(indices);
    const material = new ShaderMaterial({
      uniforms: { map: { value: art.sharp }, softMap: { value: art.soft }, opacity: { value: 1 } },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      transparent: true,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return {
      index,
      mesh,
      material,
      positions,
      tint,
      blur,
      fade,
      dispose() {
        geometry.dispose();
        material.dispose();
        art.dispose();
      },
    };
  });
}

// One frame of film, drawn flat: thin black rails with sprocket holes down both edges, the photo
// between them, and a hairline of black where it meets the next frame
function drawFrame(layout: FilmLayout, dpr: number, photo: MemoryPhoto, index: number, onLoad: () => void) {
  const scale = Math.min(dpr, 1400 / Math.max(layout.across, layout.length));
  const along = Math.round(layout.length * scale);
  const across = Math.round(layout.across * scale);
  const canvas = document.createElement("canvas");
  canvas.width = layout.vertical ? across : along;
  canvas.height = layout.vertical ? along : across;
  const context = canvas.getContext("2d")!;
  const sharp = new CanvasTexture(canvas);
  sharp.colorSpace = SRGBColorSpace;
  sharp.anisotropy = 4;

  // The soft copy: the frame shrunk right down, then stretched back over the ribbon by the GPU
  const small = document.createElement("canvas");
  small.width = Math.max(8, Math.round(canvas.width / 22));
  small.height = Math.max(8, Math.round(canvas.height / 22));
  const middle = document.createElement("canvas");
  middle.width = Math.round(canvas.width / 4);
  middle.height = Math.round(canvas.height / 4);
  const soft = new CanvasTexture(small);
  soft.colorSpace = SRGBColorSpace;
  soft.generateMipmaps = false;
  soft.minFilter = LinearFilter;
  let cancelled = false;

  // Work in film coordinates: x along the film, y across it
  const paint = (image: HTMLImageElement | null) => {
    context.save();
    if (layout.vertical) {
      context.translate(across, 0);
      context.rotate(Math.PI / 2);
    }
    context.fillStyle = "#070707";
    context.fillRect(0, 0, along, across);

    const rail = across * RAIL;
    const pitch = rail * 1.7;
    const holes = Math.max(3, Math.round(along / pitch));
    const hole = { w: (along / holes) * 0.46, h: rail * 0.5 };
    context.fillStyle = "#c4c5c6";
    for (let n = 0; n < holes; n++) {
      const x = ((n + 0.5) / holes) * along - hole.w / 2;
      for (const y of [(rail - hole.h) / 2, across - rail + (rail - hole.h) / 2]) {
        context.beginPath();
        context.roundRect(x, y, hole.w, hole.h, hole.h * 0.25);
        context.fill();
      }
    }

    const gap = along * 0.028;
    const box = { x: gap, y: rail, w: along - gap * 2, h: across - rail * 2 };
    context.save();
    context.beginPath();
    context.rect(box.x, box.y, box.w, box.h);
    context.clip();
    if (layout.vertical) {
      // Upright on screen: the film runs down the page, so the picture is turned back a quarter
      context.translate(box.x + box.w / 2, box.y + box.h / 2);
      context.rotate(-Math.PI / 2);
      drawPhoto(context, image, index, { x: -box.h / 2, y: -box.w / 2, w: box.h, h: box.w });
    } else drawPhoto(context, image, index, box);
    context.restore();
    context.restore();

    middle.getContext("2d")!.drawImage(canvas, 0, 0, middle.width, middle.height);
    small.getContext("2d")!.drawImage(middle, 0, 0, small.width, small.height);
    sharp.needsUpdate = true;
    soft.needsUpdate = true;
  };

  paint(null);
  if (photo.src) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      paint(image);
      onLoad();
    };
    image.src = photo.src;
  }
  return {
    sharp,
    soft,
    dispose() {
      cancelled = true;
      sharp.dispose();
      soft.dispose();
    },
  };
}

function drawPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  index: number,
  box: { x: number; y: number; w: number; h: number },
) {
  if (image && image.naturalWidth) {
    // Cover the frame, cropping the overflow evenly
    const ratio = Math.max(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = image.naturalWidth * ratio;
    const h = image.naturalHeight * ratio;
    context.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    return;
  }
  const gradient = context.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  gradient.addColorStop(0, "#63768a");
  gradient.addColorStop(1, "#273241");
  context.fillStyle = gradient;
  context.fillRect(box.x, box.y, box.w, box.h);
  context.fillStyle = "#cfdae5";
  context.font = `italic ${Math.round(Math.min(box.w, box.h) * 0.32)}px Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1).padStart(2, "0"), box.x + box.w / 2, box.y + box.h / 2);
}
