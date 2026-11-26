"use client";

import { useEffect, useState } from "react";
import { supportsWebGL } from "@/lib/webgl";
import dynamic from "next/dynamic";
import { memoryPhotos } from "@/data/memory-photos";

// The 3D film. Its code (and three.js) loads only once the photos are about to appear; if it can't
// load, or the browser has no WebGL, the photo in focus is shown flat instead.
const FilmRibbon = dynamic(() => import("@/components/FilmRibbon").catch(() => ({ default: Unavailable })), { ssr: false });

function Unavailable({ onLost }: { onLost?: () => void }) {
  useEffect(() => onLost?.(), [onLost]);
  return null;
}

/** `leave`: 0 → 1 as the film rises away after the last photo, for the ending */
export function Filmstrip({ position, entrance, leave = 0, reduced }: { position: number; entrance: number; leave?: number; reduced: boolean }) {
  const [flat, setFlat] = useState(() => !supportsWebGL());
  if (!memoryPhotos.length) return null;
  const hidden = entrance <= 0 || leave >= 1;
  const index = Math.round(position);
  const photo = memoryPhotos[index];
  const focusOpacity = 1 - Math.min(1, Math.abs(position - index) * 2);
  return (
    // The 3D film stays mounted while the photos are scrolled away and back: unmounting a canvas
    // throws its WebGL context away, and the film would have to be built again each time
    <section className="memory-scene" aria-label="Photo memories" aria-hidden={hidden || undefined}>
      {flat ? (
        hidden ? null : 
        <div className="film-flat" aria-hidden="true" style={{ opacity: entrance * focusOpacity * (1 - leave) }}>
          {photo.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt="" />
          ) : (
            <span className="film-placeholder">{String(index + 1).padStart(2, "0")}</span>
          )}
        </div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0" style={{ visibility: hidden ? "hidden" : undefined }}>
          <FilmRibbon photos={memoryPhotos} state={{ position, entrance, leave, reduced }} onLost={() => setFlat(true)} />
        </div>
      )}
      {photo.alt && <p className="sr-only">{photo.alt}</p>}
    </section>
  );
}
