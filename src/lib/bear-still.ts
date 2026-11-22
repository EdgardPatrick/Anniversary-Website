// The bear (or the final heart) without WebGL: the same points, projected once onto a 2D canvas
// as matte flecks. Used when WebGL is unavailable or its context is lost.

import { buildBearCloud, buildHeartCloud } from "@/lib/bear-points";
import { framing } from "@/lib/bear-scene";

const COUNT = 9000;
let clouds: { bear: ReturnType<typeof buildBearCloud>; heart: ReturnType<typeof buildHeartCloud> } | null = null;

export function drawBearStill(canvas: HTMLCanvasElement, shape: "bear" | "heart") {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  clouds ??= { bear: buildBearCloud({ count: COUNT }), heart: buildHeartCloud({ count: COUNT }) };
  const frame = framing(width, height);
  const isHeart = shape === "heart";
  const positions = isHeart ? clouds.heart.positions : clouds.bear.positions;
  const colors = isHeart ? clouds.heart.colors : clouds.bear.colors;
  const scale = isHeart ? frame.heartHalf / frame.unit : 1;
  const camera = frame.distance;

  const projected = Array.from({ length: COUNT }, (_, i) => {
    const x = positions[i * 3] * scale;
    const y = positions[i * 3 + 1] * scale;
    const z = positions[i * 3 + 2] * scale;
    const perspective = camera / (camera - z);
    return { x: frame.center.x + x * frame.unit * perspective, y: frame.center.y - y * frame.unit * perspective, z, i };
  }).sort((a, b) => a.z - b.z);

  // Opaque, back to front, so nearer flecks cover farther ones as they do in 3D
  const radius = 0.017 * Math.sqrt(80000 / COUNT) * frame.unit * 0.5;
  for (const { x, y, i } of projected) {
    const [r, g, b] = [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
    const size = isHeart ? 1 : clouds.bear.sizes[i];
    context.fillStyle = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
    context.beginPath();
    context.arc(x, y, Math.max(0.8, radius * size), 0, Math.PI * 2);
    context.fill();
  }
  return true;
}
