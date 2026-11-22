// The bear (or the heart, or the bouquet) without WebGL: the same points, projected once onto a 2D canvas
// as matte flecks. Used when WebGL is unavailable or its context is lost.

import { buildBearCloud, buildHeartCloud } from "@/lib/bear-points";
import { buildBouquetCloud } from "@/lib/bouquet-points";
import { framing } from "@/lib/bear-scene";

const COUNT = 9000;
export type StillShape = "bear" | "heart" | "bouquet";

let clouds: {
  bear: ReturnType<typeof buildBearCloud>;
  heart: ReturnType<typeof buildHeartCloud>;
  bouquet: ReturnType<typeof buildBouquetCloud>;
} | null = null;

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

  clouds ??= { bear: buildBearCloud({ count: COUNT }), heart: buildHeartCloud({ count: COUNT }), bouquet: buildBouquetCloud({ count: COUNT }) };
  const frame = framing(width, height);
  const { positions, colors } = clouds[shape];
  const scale = shape === "heart" ? frame.heartHalf / frame.unit : shape === "bouquet" ? frame.bouquetHalf / frame.unit : 1;
  const center = shape === "bouquet" ? frame.bouquetCenter : frame.center;
  const camera = frame.distance;

  const projected = Array.from({ length: COUNT }, (_, i) => {
    const x = positions[i * 3] * scale;
    const y = positions[i * 3 + 1] * scale;
    const z = positions[i * 3 + 2] * scale;
    const perspective = camera / (camera - z);
    return { x: center.x + x * frame.unit * perspective, y: center.y - y * frame.unit * perspective, z, i };
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
