// Blue confetti thrown up out of the box, then pulled down by gravity.
// Plain DOM pieces animated with the Web Animations API; each removes itself when it lands.

import { seededRandom } from "@/lib/bear-points";

const COLORS = ["#cfe0ff", "#9cc1ff", "#6c9cff", "#3f78ff", "#2557e0", "#86b6ff"];
const SHAPES = ["strip", "square", "dot"] as const;

export function throwConfetti(layer: HTMLElement, origin: { x: number; y: number }, count: number) {
  const random = seededRandom(Math.floor(performance.now()));
  const scale = Math.min(1.4, Math.max(0.7, layer.clientWidth / 900));
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("i");
    const shape = SHAPES[i % SHAPES.length];
    piece.className = `confetti confetti-${shape}`;
    piece.style.left = `${origin.x}px`;
    piece.style.top = `${origin.y}px`;
    piece.style.background = COLORS[Math.floor(random() * COLORS.length)];
    piece.style.scale = String(scale * (0.9 + random() * 0.6));
    layer.append(piece);

    // Thrown up and outward, wider than tall, then falling past the start
    const angle = -Math.PI / 2 + (random() - 0.5) * 2.3;
    const speed = (260 + random() * 260) * scale;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const gravity = 620 * scale;
    const spin = (random() - 0.5) * 900;
    const duration = 1500 + random() * 700;
    const seconds = duration / 1000;
    const frames: Keyframe[] = Array.from({ length: 9 }, (_, step) => {
      const t = (step / 8) * seconds;
      const flutter = Math.sin(t * 9 + i) * 10 * (step / 8);
      return {
        transform: `translate(${(vx * t + flutter).toFixed(1)}px, ${(vy * t + 0.5 * gravity * t * t).toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg) rotateY(${(t * 720).toFixed(0)}deg)`,
        opacity: step === 0 ? 0 : step < 6 ? 1 : 1 - (step - 5) / 3,
      };
    });
    piece.animate(frames, { duration, easing: "linear", delay: random() * 90, fill: "both" }).finished.then(
      () => piece.remove(),
      () => piece.remove(),
    );
  }
}
