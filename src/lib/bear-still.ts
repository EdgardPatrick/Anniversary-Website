// The bear (or the heart, or the bouquet) without WebGL: the same points, projected once onto a 2D canvas
// as matte flecks. Used when WebGL is unavailable or its context is lost.

import { buildBearCloud, buildHeartCloud } from "@/lib/bear-points";
import { buildBouquetCloud } from "@/lib/bouquet-points";
import { RING_BOX_CENTER, RING_BOX_OPEN_ANGLE, RING_BOX_VIEW, RING_PART, buildRingBoxCloud, openLid } from "@/lib/ring-box-points";
import { finalePose, framing, ringBoxFrame } from "@/lib/bear-scene";

const COUNT = 9000;
export type StillShape = "bear" | "heart" | "bouquet" | "ringbox";

let clouds: {
  bear: ReturnType<typeof buildBearCloud>;
  heart: ReturnType<typeof buildHeartCloud>;
  bouquet: ReturnType<typeof buildBouquetCloud>;
  ringbox: { positions: Float32Array; colors: Float32Array };
} | null = null;

/** The ring box as it stands open, seen from a little above and to the side, as the live one ends */
function openRingBox() {
  const box = buildRingBoxCloud({ count: COUNT });
  const positions = new Float32Array(COUNT * 3);
  const [cp, sp] = [Math.cos(RING_BOX_VIEW.pitch), Math.sin(RING_BOX_VIEW.pitch)];
  const [cy, sy] = [Math.cos(RING_BOX_VIEW.yaw), Math.sin(RING_BOX_VIEW.yaw)];
  for (let i = 0; i < COUNT; i++) {
    const rest: [number, number, number] = [box.positions[i * 3], box.positions[i * 3 + 1], box.positions[i * 3 + 2]];
    let [x, y, z] = box.part[i] === RING_PART.lid ? openLid(rest, RING_BOX_OPEN_ANGLE) : rest;
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    positions.set([x + RING_BOX_CENTER[0], y + RING_BOX_CENTER[1], z + RING_BOX_CENTER[2]], i * 3);
  }
  return { positions, colors: box.colors };
}

export function prepareStillClouds() {
  clouds ??= {
    bear: buildBearCloud({ count: COUNT }),
    heart: buildHeartCloud({ count: COUNT }),
    bouquet: buildBouquetCloud({ count: COUNT }),
    ringbox: openRingBox(),
  };
  return clouds;
}

export function drawBearStill(canvas: HTMLCanvasElement, shape: StillShape) {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const clouds = prepareStillClouds();
  const frame = framing(width, height);
  const { positions, colors } = clouds[shape];
  const pose = finalePose(width, height, frame.unit);
  const yaw = shape === "bear" ? pose.yaw : 0;
  const pitch = shape === "bear" ? pose.pitch : 0;
  const scale =
    shape === "heart" ? frame.heartHalf / frame.unit : shape === "bouquet" ? frame.bouquetHalf / frame.unit : shape === "ringbox" ? ringBoxFrame(width, height).scale : pose.scale;
  const center = shape === "bouquet" ? frame.bouquetCenter : frame.center;
  const camera = frame.distance;

  const projected = Array.from({ length: COUNT }, (_, i) => {
    // Turned (yaw), then tipped back (pitch), as the live bear is
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const x = (px * Math.cos(yaw) + pz * Math.sin(yaw)) * scale;
    const yawZ = pz * Math.cos(yaw) - px * Math.sin(yaw);
    const y = (py * Math.cos(pitch) - yawZ * Math.sin(pitch)) * scale;
    const z = (py * Math.sin(pitch) + yawZ * Math.cos(pitch)) * scale;
    const perspective = camera / (camera - z);
    return { x: (shape === "bear" ? pose.x : center.x) + x * frame.unit * perspective, y: (shape === "bear" ? pose.y : center.y) - y * frame.unit * perspective, z, i };
  }).sort((a, b) => a.z - b.z);

  // Opaque, back to front, so nearer flecks cover farther ones as they do in 3D
  const radius = 0.017 * Math.sqrt(80000 / COUNT) * frame.unit * 0.5;
  for (const { x, y, i } of projected) {
    const [r, g, b] = [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
    const size = shape === "bear" ? clouds.bear.sizes[i] : 1;
    context.fillStyle = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
    context.beginPath();
    context.arc(x, y, Math.max(0.8, radius * size), 0, Math.PI * 2);
    context.fill();
  }
  return true;
}
