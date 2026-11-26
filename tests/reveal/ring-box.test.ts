import { expect, it } from "vitest";
import { RING_BOX_CENTER, RING_BOX_OPEN_ANGLE, RING_BOX_VIEW, RING_PART, buildRingBoxCloud, openLid } from "@/lib/ring-box-points";
import type { Vec3 } from "@/lib/bear-points";
import { RING_BOX_EXTENT } from "@/lib/bear-scene";

const view = ([x, y, z]: Vec3): Vec3 => {
  const [cp, sp] = [Math.cos(RING_BOX_VIEW.pitch), Math.sin(RING_BOX_VIEW.pitch)];
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  const [cy, sy] = [Math.cos(RING_BOX_VIEW.yaw), Math.sin(RING_BOX_VIEW.yaw)];
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  return [x + RING_BOX_CENTER[0], y + RING_BOX_CENTER[1], z + RING_BOX_CENTER[2]];
};

function bounds(points: Vec3[]) {
  const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (const p of points) for (const k of [0, 1]) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  return { min, max };
}

it("builds a box whose lid opens about its back edge and whose ring hides inside until then", () => {
  const cloud = buildRingBoxCloud({ count: 20000 });
  const at = (i: number, data: Float32Array): Vec3 => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const open: Vec3[] = [];
  const shut: Vec3[] = [];
  let ring = 0, lid = 0;
  for (let i = 0; i < 20000; i++) {
    const part = cloud.part[i];
    if (part === RING_PART.ring) ring++;
    if (part === RING_PART.lid) lid++;
    const rest = at(i, cloud.positions);
    open.push(view(part === RING_PART.lid ? openLid(rest, RING_BOX_OPEN_ANGLE) : rest));
    shut.push(view(at(i, cloud.closed)));
    if (part === RING_PART.ring) {
      // Hidden inside the base while closed
      const [x, y, z] = at(i, cloud.closed);
      expect(Math.abs(x)).toBeLessThan(1);
      expect(Math.abs(z)).toBeLessThan(0.92);
      expect(y).toBeLessThan(-0.1);
    }
  }
  expect(ring).toBeGreaterThan(1500);
  expect(lid).toBeGreaterThan(4000);
  const o = bounds(open);
  const c = bounds(shut);
  // Inside the extents the screen layout and the words are placed from
  for (const b of [o, c]) {
    expect(b.max[1]).toBeLessThan(RING_BOX_EXTENT.top);
    expect(-b.min[1]).toBeLessThan(RING_BOX_EXTENT.bottom);
    expect(Math.max(-b.min[0], b.max[0])).toBeLessThan(RING_BOX_EXTENT.half);
  }
  // Opening lifts the lid well above the closed box
  expect(o.max[1] - c.max[1]).toBeGreaterThan(1);
});
