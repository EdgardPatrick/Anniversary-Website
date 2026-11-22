import type { CSSProperties } from "react";
import Image from "next/image";
import { memoryPhotos } from "@/data/memory-photos";

export function Filmstrip({ position, entrance, reduced }: { position: number; entrance: number; reduced: boolean }) {
  if (!memoryPhotos.length || entrance <= 0) return null;
  const index = Math.round(position);
  const photo = memoryPhotos[index];
  const captionOpacity = Math.max(0, (entrance - 0.8) / 0.2) * (1 - Math.min(1, Math.abs(position - index) * 2));
  return (
    <section className="memory-scene" aria-label="Photo memories" style={{ opacity: entrance }}>
      <div className="film-window" style={{
        transform: `translate(-50%, ${reduced ? 0 : 100 * (1 - entrance)}%)`,
        clipPath: `inset(max(0%, calc(50% - var(--frame-height) * ${position + 0.5})) 0 0)`,
      }}>
        {memoryPhotos.slice(Math.max(0, index - 2), index + 3).map((frame, i) => {
          const number = Math.max(0, index - 2) + i;
          const offset = number - position;
          const distance = Math.abs(offset) + (reduced ? 0 : 2.4 * (1 - entrance));
          const edge = Math.min(1, Math.max(0, (distance - 0.35) / 1.28));
          return (
            <div className="film-frame" key={number} aria-hidden={number !== index}
              style={{
                transform: `translate(-50%, ${-50 + offset * 100}%)`,
                "--rail-filter": !reduced && edge > 0 ? `url(#film-ripple-${number})` : "none",
              } as CSSProperties}>
              <div className="film-exposure" style={{ opacity: 1 - edge }}>
              {frame.src ? <Image src={frame.src} alt={frame.alt} fill sizes="35vw" unoptimized /> :
                <span className="film-placeholder" aria-label={`Empty photo frame ${number + 1}`}>{String(number + 1).padStart(2, "0")}</span>}
              </div>
              {!reduced && edge > 0 && <svg width="0" height="0" aria-hidden="true">
                <filter id={`film-ripple-${number}`} x="-30%" y="-60%" width="160%" height="220%">
                  <feTurbulence type="fractalNoise" baseFrequency=".012 .06" numOctaves="2"/>
                  <feDisplacementMap in="SourceGraphic" scale={12 * edge} xChannelSelector="R" yChannelSelector="G"/>
                </filter>
              </svg>}
            </div>
          );
        })}
      </div>
      <div className="memory-caption" style={{ opacity: captionOpacity }}>
        <p>{photo.date}</p><p>{photo.description}</p>
      </div>
    </section>
  );
}
