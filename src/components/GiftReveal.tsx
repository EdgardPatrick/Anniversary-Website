"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Filmstrip } from "@/components/Filmstrip";
import { loadPhoto } from "@/lib/load-photo";
import { memoryPhotos } from "@/data/memory-photos";
import dynamic from "next/dynamic";
import { GiftBox } from "@/components/GiftBox";
import { anniversary } from "@/data/anniversary";
import {
  animateFrontWall,
  fallKeyframes,
  floorCenter,
  opening,
  timeline,
  walls,
  type Point,
} from "@/lib/gift-box";
import { framing, loveSpace, ringBoxFrame, type ScreenPoint } from "@/lib/bear-scene";
import type { BearStageHandle } from "@/components/BearStage";
import type { StillShape } from "@/lib/bear-still";
import { supportsWebGL } from "@/lib/webgl";
import { listenForPhotoGestures } from "@/lib/photo-navigation";
import { isReducedMotion } from "@/lib/motion";
import { reveal } from "@/lib/reveal";
import { FLIP, TRACK_SCREENS, advanceEnding, beats, bloomAt, endingStory, lineState, loveLine, particleStory, trackProgress, type Beat } from "@/lib/story";
import { useReducedMotion, useRevealStage } from "@/lib/use-preferences";
import { HAND_BACK_SECONDS, MUSIC_RATE, OPEN_AT, autoplayAt, autoplaySchedule, musicLevel, photoAfterHandBack } from "@/lib/autoplay";

const MUSIC = "/anniversary.m4a";

const { greeting, finale, question, loveYou } = anniversary;

// The live particles (React Three Fiber). Their code loads only when prepare() mounts them;
// if the chunk can't load, the stage reports "no WebGL" and the still bear is drawn instead.
const BearStage = dynamic(
  () =>
    import("@/components/BearStage").catch(() => ({
      default: function Unavailable({ onReady }: { onReady: (handle: null) => void }) {
        useEffect(() => onReady(null), [onReady]);
        return null;
      },
    })),
  { ssr: false },
);

type Renderer = "pending" | "webgl" | "still";
type LineKey = "greeting" | "i" | "u" | "forever" | "question" | "love";

const lineBeats: Record<LineKey, Beat> = beats;
const lineKeys = Object.keys(lineBeats) as LineKey[];

// The opening screen is the gift box alone. Opening it throws glitter and paper confetti up out of
// the box; the glitter falls into the bear and the greeting appears under it as the confetti passes.
// Scrolling flips the bouquet into the heart of "I ♥ U · Forever", then turns the heart
// into the bear holding a heart. After the last photo, one more flick sends the film away and the
// bear back to the middle, where it becomes a ring box that opens as the question appears.
// Every scroll beat follows the scroll position, both ways.
export function GiftReveal() {
  const stage = useRevealStage();
  const reduced = useReducedMotion();
  const [film, setFilm] = useState({ position: 0, entrance: 0, leave: 0, reduced: false });
  const photoIndex = useRef(0);
  const photoTouchedAt = useRef(-Infinity); // when the visitor last moved the photos themselves
  const heroRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const giftRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // the still fallback
  const layerRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLParagraphElement>(null);
  const sceneRef = useRef<BearStageHandle | null>(null);
  const preparing = useRef<Promise<BearStageHandle | null> | null>(null);
  const ready = useRef<(handle: BearStageHandle | null) => void>(() => { });
  const renderer = useRef<Renderer>("pending");
  const stillShape = useRef<StillShape | null>(null);
  const timers = useRef<number[]>([]);
  const greetingAt = useRef(-1); // when the greeting started to appear, on the performance clock
  // "Go back up" was pressed: the page is at the top, and the ring box is turning back into the bouquet
  const returning = useRef(false);
  const [stageMounted, setStageMounted] = useState(false);
  const [status, setStatus] = useState("");

  // Just above the box's floor, in stage pixels: the throw starts inside the box
  const stagePoint = useCallback(([x, y]: Point): ScreenPoint | null => {
    const svg = giftRef.current?.querySelector("svg");
    const matrix = svg?.getScreenCTM();
    const bounds = stickyRef.current?.getBoundingClientRect();
    if (!matrix || !bounds) return null;
    const p = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: p.x - bounds.left, y: p.y - bounds.top };
  }, []);

  const showStill = useCallback((shape: StillShape) => {
    const canvas = canvasRef.current;
    renderer.current = "still";
    if (!canvas || stillShape.current === shape) return;
    stillShape.current = shape;
    void import("@/lib/bear-still").then(({ drawBearStill }) => {
      if (canvas === canvasRef.current && shape === stillShape.current) drawBearStill(canvas, shape);
    });
  }, []);

  // Load the particles and start the simulation before anyone taps, so the throw starts on time
  const prepare = useCallback(() => {
    if (preparing.current) return preparing.current;
    if (!supportsWebGL()) {
      renderer.current = "still";
      preparing.current = Promise.resolve(null);
      return preparing.current;
    }
    preparing.current = new Promise<BearStageHandle | null>((resolve) => {
      ready.current = (handle) => {
        sceneRef.current = handle;
        renderer.current = handle ? "webgl" : "still";
        resolve(handle);
      };
    });
    setStageMounted(true);
    return preparing.current;
  }, []);

  // Stable callbacks for the stage, so it never rebuilds the simulation
  const onStageReady = useCallback((handle: BearStageHandle | null) => ready.current(handle), []);
  // If the GPU drops the context, the finished bear is still drawn, just without WebGL
  const onStageLost = useCallback(() => {
    ready.current(null);
    sceneRef.current = null;
    if (reveal.get() !== "closed") {
      showStill("bouquet");
      if (layerRef.current?.hasAttribute("data-live")) stickyRef.current?.setAttribute("data-confetti-out", "");
    }
  }, [showStill]);

  const startBear = useCallback(
    async (still: boolean) => {
      await prepare();
      const scene = sceneRef.current;
      const from = stagePoint([floorCenter[0], floorCenter[1] - 24]) ?? { x: 0, y: 0 };
      const onEmergence = () => {
        stickyRef.current?.setAttribute("data-confetti-out", "");
        if (!still) stickyRef.current?.querySelector('[data-part="glow"]')?.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 1100 },
        );
      };
      if (scene) scene.start({ still, from, rimY: stagePoint(opening)?.y ?? from.y, onEmergence });
      else {
        showStill("bouquet");
        onEmergence();
      }
      layerRef.current?.setAttribute("data-live", "true");
    },
    [prepare, stagePoint, showStill],
  );

  const [loaded, setLoaded] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const total = memoryPhotos.filter(photo => photo.src).length + 4;
  const loading = loaded < total;
  const [landed, setLanded] = useState(false);
  // Once everything has loaded, the loader waits on its Start button; the gift only falls in after it
  const [started, setStarted] = useState(false);
  // Start plays the whole show by itself; "Continue without auto scroll" leaves it to the visitor
  const [autoScroll, setAutoScroll] = useState(true);
  // The ring box has opened and the question has been asked: offer to start over
  const [finished, setFinished] = useState(false);
  const intro = loading ? "loading" : !started ? "start" : landed ? "ready" : "arriving";
  const music = useRef<HTMLAudioElement | null>(null);
  // The song's volume, through Web Audio where it can (phones ignore an audio element's volume)
  const fader = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const musicFailed = useRef(false);
  const startedAt = useRef(-1);
  const openGift = useRef<() => void>(() => { });
  const percent = Math.floor(100 * loaded / total);

  useEffect(() => {
    if (intro !== "arriving") return;
    let active = true;
    const arrival = giftRef.current?.getAnimations().find(
      animation => animation instanceof CSSAnimation && animation.animationName === "gift-arrival",
    );
    const finish = () => { if (active) setLanded(true); };
    void Promise.resolve(arrival?.finished).then(finish, finish);
    return () => { active = false; };
  }, [intro]);


  useEffect(() => {
    let active = true;
    let next = 0;
    let completed = 0;
    const progress = () => {
      if (active) setLoaded(++completed);
    };
    const images = memoryPhotos.filter(photo => photo.src);
    const worker = async () => {
      while (active && next < images.length) {
        await loadPhoto(images[next++].src);
        progress();
      }
    };
    const particles = async () => {
      if (!(await prepare())) {
        const { prepareStillClouds } = await import("@/lib/bear-still");
        prepareStillClouds();
      }
      progress();
    };
    const film = supportsWebGL() ? import("@/components/FilmRibbon") : Promise.resolve();
    // The music: ready once it can play through. Phones may not buffer until it plays, so it never
    // holds the loader for more than a few seconds; if it can't load, the show runs on its own clock.
    const song = new Promise<void>((resolve) => {
      const audio = (music.current ??= new Audio(MUSIC));
      audio.preload = "auto";
      if (audio.readyState >= 4) return resolve();
      const done = () => resolve();
      audio.addEventListener("canplaythrough", done, { once: true });
      audio.addEventListener("error", () => { musicFailed.current = true; resolve(); }, { once: true });
      window.setTimeout(done, 6000);
      audio.load();
    });
    void Promise.all([
      particles(), film.then(progress), document.fonts.ready.then(progress), song.then(progress),
      ...Array.from({ length: Math.min(4, images.length) }, worker),
    ]).catch(() => {
      if (active) setLoadFailed(true);
      active = false;
    });
    return () => { active = false; };
  }, [attempt, prepare]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(timer => window.clearTimeout(timer));
  }, []);

  // Place the words around the bear and the heart, at every size
  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;
    const place = () => {
      const width = sticky.clientWidth;
      const frame = framing(width, sticky.clientHeight);
      sticky.style.setProperty("--heart-half", `${frame.heartHalf}px`);
      sticky.style.setProperty("--heart-y", `${frame.center.y}px`);
      const slot = (name: string) => sticky.querySelector<HTMLElement>(`[data-slot="${name}"]`)?.style;
      const words = slot("words");
      if (words) words.top = `${frame.bouquetCenter.y + frame.bouquetHalf + 14}px`;
      const asked = slot("question");
      if (asked) asked.top = `${ringBoxFrame(width, sticky.clientHeight).wordsTop}px`;
      const love = slot("love");
      if (love) {
        const space = loveSpace(width, sticky.clientHeight);
        love.left = `${space.x}px`;
        love.top = `${space.y}px`;
        love.width = `${space.width}px`;
      }
      if (renderer.current === "still" && stillShape.current) {
        const shape = stillShape.current;
        stillShape.current = null;
        showStill(shape);
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(sticky);
    return () => observer.disconnect();
  }, [showStill]);

  // The scroll story: every frame, read where the track is and set each beat to match
  useEffect(() => {
    if (stage === "closed") return;
    const sticky = stickyRef.current;
    if (!sticky) return;
    const lines = Object.fromEntries(
      lineKeys.map((key) => [
        key,
        {
          element: sticky.querySelector<HTMLElement>(`[data-line="${key}"]`),
          noise: sticky.querySelector<SVGFETurbulenceElement>(`#ripple-${key} feTurbulence`),
          map: sticky.querySelector<SVGFEDisplacementMapElement>(`#ripple-${key} feDisplacementMap`),
        },
      ]),
    ) as Record<LineKey, { element: HTMLElement | null; noise: SVGFETurbulenceElement | null; map: SVGFEDisplacementMapElement | null }>;
    let frame = 0;
    let shown = -1;
    let photoPosition = photoIndex.current;
    let previousTime = 0;
    let lastFilmProgress = -1;
    let ending = 0; // the ending's clock, 0 → 1 (see endingStory)
    let lastLeave = -1;
    let asked = false;
    let shownLove = 0;
    const loveText = sticky.querySelector<HTMLElement>("[data-love-text]");
    const loveLanguage = sticky.querySelector<HTMLElement>("[data-love-language]");
    const tick = (now: number) => {
      const hero = heroRef.current;
      if (hero) {
        const rect = hero.getBoundingClientRect();
        const progress = trackProgress(rect.top, rect.height, window.innerHeight);
        const target = progress * FLIP.to;
        // A little smoothing so wheel steps glide; reduced motion follows the scroll exactly. Going
        // back up jumps straight to the bouquet, without running the story back through the bear.
        shown = shown < 0 || reduced || returning.current ? target : shown + (target - shown) * 0.18;
        if (Math.abs(target - shown) < 0.0005) shown = target;
        // The greeting arrives on the clock, as the confetti falls past it, then leaves on the scroll
        const arrival = greetingAt.current < 0 ? 0 : reduced ? 1 : (now - greetingAt.current) / 900;
        // One step past the last photo is the ending
        const photoCount = memoryPhotos.length;
        // Away from the strip, the film goes back to its first photo once it is out of sight (or at
        // once from the ring box). The show's film starts gliding while it is still arriving.
        if (progress < 0.999 && (photoIndex.current >= photoCount || bloomAt(shown) <= 0)) photoIndex.current = 0;
        const focused = Math.min(photoIndex.current, photoCount - 1);
        ending = advanceEnding(ending, photoIndex.current >= photoCount ? 1 : 0, previousTime ? Math.min(0.1, (now - previousTime) / 1000) : 0);
        const end = endingStory(ending, reduced);
        // Back at the bouquet: once the ring box has turned back into it, the greeting comes again
        if (returning.current && end.ring <= 0) {
          returning.current = false;
          greetingAt.current = now;
        }
        const arrivals: Partial<Record<LineKey, number>> = { greeting: arrival, question: end.question };
        for (const key of lineKeys) if (key !== "love") applyLine(key, lineState(shown, lineBeats[key], arrivals[key] ?? 1), now, reduced);
        if (end.question > 0 && !asked) setStatus(question.join(" "));
        setFinished(ending >= 1);
        asked = end.question > 0;
        const blend = reduced ? 1 : 1 - Math.exp(-(now - previousTime) / 105);
        const next = photoPosition + (focused - photoPosition) * blend;
        const position = Math.abs(next - focused) < 0.001 ? focused : next;
        previousTime = now;
        const story = particleStory(shown, reduced);
        // "I love you" in one language after another, between the bear and the film while it is in place
        const love = loveLine(position, loveYou.length, photoCount);
        if (love.index !== shownLove && loveText && loveLanguage) {
          shownLove = love.index;
          loveText.textContent = loveYou[love.index].text;
          loveLanguage.textContent = loveYou[love.index].language;
        }
        const filmIn = Math.min(1, Math.max(0, (1 - story.morph - 0.85) / 0.15)) * (1 - Math.min(1, end.film * 4));
        applyLine("love", { opacity: love.opacity * filmIn, distort: love.distort }, now, reduced);
        if (lastFilmProgress !== shown || position !== photoPosition || lastLeave !== end.film) {
          photoPosition = position;
          setFilm({ position, entrance: 1 - story.morph, leave: end.film, reduced });
          lastFilmProgress = shown;
          lastLeave = end.film;
        }
        sceneRef.current?.setStory(story);
        sceneRef.current?.setEnding(end);
        const { bloom, morph } = story;
        if (renderer.current === "still") showStill(end.ring > 0.5 ? "ringbox" : bloom > 0.5 ? "bouquet" : morph > 0.5 ? "heart" : "bear");
        if (cueRef.current) cueRef.current.style.opacity = String(Math.max(0, 1 - shown / 0.05));
      }
      frame = requestAnimationFrame(tick);
    };
    const applyLine = (key: LineKey, { opacity, distort }: { opacity: number; distort: number }, now: number, still: boolean) => {
      const { element, noise, map } = lines[key];
      if (!element) return;
      element.style.opacity = opacity.toFixed(3);
      element.style.visibility = opacity < 0.01 ? "hidden" : "visible";
      if (still || opacity < 0.01) {
        element.style.transform = "";
        element.style.filter = "";
        element.style.textShadow = "";
        return;
      }
      // Stretched wide and rippled while arriving or leaving, with a cyan and deep-blue fringe
      const d = distort;
      element.style.transform = `translateY(${(0.35 * d).toFixed(3)}em) scaleX(${(1 + 0.6 * d).toFixed(3)}) skewX(${(-14 * d).toFixed(2)}deg)`;
      element.style.filter = d > 0.01 ? `url(#ripple-${key}) blur(${(1.4 * d).toFixed(2)}px)` : "none";
      element.style.textShadow =
        d > 0.01 ? `${(-7 * d).toFixed(2)}px 0 rgb(90 210 255 / ${0.85 * d}), ${(7 * d).toFixed(2)}px 0 rgb(50 90 255 / ${0.85 * d})` : "none";
      if (d > 0.01 && map && noise) {
        map.setAttribute("scale", (60 * d).toFixed(1));
        const t = now / 1000;
        noise.setAttribute("baseFrequency", `${(0.006 + 0.008 * d).toFixed(4)} ${(0.05 + 0.015 * Math.sin(t * 2.3)).toFixed(4)}`);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage, showStill, reduced]);

  useEffect(() => {
    const hero = heroRef.current;
    if (stage !== "open" || !hero || memoryPhotos.length < 2) return;
    return listenForPhotoGestures(
      () => hero.getBoundingClientRect().bottom <= window.innerHeight + 1,
      photoIndex,
      memoryPhotos.length + 1, // the step past the last photo opens the ring box
      () => { photoTouchedAt.current = performance.now(); },
    );
  }, [stage]);

  // Touch and mouse stir the particles. Touch listeners are passive, so a vertical drag still
  // scrolls the page while the particles follow the finger the whole way.
  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;
    let release = 0;
    const local = (x: number, y: number) => {
      const bounds = sticky.getBoundingClientRect();
      return [x - bounds.left, y - bounds.top] as const;
    };
    const mouseMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") sceneRef.current?.point(...local(event.clientX, event.clientY));
    };
    // The press that opens the gift belongs to the box, not to the particles
    const onParticles = () => reveal.get() !== "closed";
    const mouseDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !onParticles()) return;
      const [x, y] = local(event.clientX, event.clientY);
      sceneRef.current?.point(x, y);
      sceneRef.current?.tap(x, y);
      sceneRef.current?.press(true);
    };
    const mouseUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse") sceneRef.current?.press(false);
    };
    const mouseLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      sceneRef.current?.press(false);
      sceneRef.current?.point(null);
    };
    const touchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !onParticles()) return;
      window.clearTimeout(release);
      const [x, y] = local(touch.clientX, touch.clientY);
      sceneRef.current?.point(x, y); // a finger lights particles up and drags them, like a hovering mouse
      sceneRef.current?.tap(x, y);
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) sceneRef.current?.point(...local(touch.clientX, touch.clientY));
    };
    const touchEnd = (event: TouchEvent) => {
      if (event.touches.length) return;
      release = window.setTimeout(() => sceneRef.current?.point(null), 450);
    };
    const passive = { passive: true } as const;
    sticky.addEventListener("pointermove", mouseMove, passive);
    sticky.addEventListener("pointerdown", mouseDown, passive);
    window.addEventListener("pointerup", mouseUp, passive);
    sticky.addEventListener("pointerleave", mouseLeave, passive);
    sticky.addEventListener("touchstart", touchStart, passive);
    sticky.addEventListener("touchmove", touchMove, passive);
    sticky.addEventListener("touchend", touchEnd, passive);
    sticky.addEventListener("touchcancel", touchEnd, passive);
    return () => {
      window.clearTimeout(release);
      sticky.removeEventListener("pointermove", mouseMove);
      sticky.removeEventListener("pointerdown", mouseDown);
      window.removeEventListener("pointerup", mouseUp);
      sticky.removeEventListener("pointerleave", mouseLeave);
      sticky.removeEventListener("touchstart", touchStart);
      sticky.removeEventListener("touchmove", touchMove);
      sticky.removeEventListener("touchend", touchEnd);
      sticky.removeEventListener("touchcancel", touchEnd);
    };
  }, []);

  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));

  function open() {
    if (intro !== "ready" || !reveal.advance("opening")) return; // already opening: ignore repeated taps and key presses
    const gift = giftRef.current;
    if (!gift) return;
    setStatus("Your gift is opening.");

    if (isReducedMotion()) {
      greetingAt.current = performance.now();
      void startBear(true);
      reveal.advance("bear");
      reveal.advance("open");
      setStatus(anniversary.revealDescription);
      return;
    }

    // The box is drawn in two layers (behind and in front of the particles): move both
    const part = (name: string) => {
      const found = [...(stickyRef.current?.querySelectorAll<SVGGElement>(`[data-part="${name}"]`) ?? [])];
      return found.length ? { animate: (keyframes: Keyframe[], options: KeyframeAnimationOptions) => found.forEach((element) => element.animate(keyframes, options)) } : null;
    };
    const keep = { fill: "forwards" } as const;

    // 1 · Both ends of the ribbon are pulled. The tails grow longer as ribbon slides out of the
    //     knot, the loops shrink and are drawn in after it, the knot cinches and comes undone,
    //     and the loose ribbon falls off the box. Only then does the lid lift.
    const bow = { duration: timeline.lid - timeline.loosen, ...keep };
    const pull = "cubic-bezier(.55, 0, .25, 1)";
    const drop = "cubic-bezier(.5, 0, .9, .45)";
    for (const [name, side] of [["tail-left", 1], ["tail-right", -1]] as const) {
      part(name)?.animate(
        [
          { transform: "none", easing: "ease-out" },
          // A grip and a first tug: the ribbon goes taut
          { transform: `rotate(${10 * side}deg) scale(1.06, 1.3)`, offset: 0.14, easing: "ease-in-out" },
          { transform: `rotate(${7 * side}deg) scale(1.04, 1.2)`, offset: 0.24, easing: pull },
          // The long pull: more and more ribbon comes out of the knot
          { transform: `rotate(${34 * side}deg) scale(1.15, 2.6)`, opacity: 1, offset: 0.74, easing: drop },
          // Let go: the loose end drops off the edge of the lid
          { transform: `translate(${-46 * side}px, 80px) rotate(${48 * side}deg) scale(1.05, 2.3)`, opacity: 0 },
        ],
        bow,
      );
    }
    for (const [name, side] of [["loop-left", -1], ["loop-right", 1]] as const) {
      part(name)?.animate(
        [
          { transform: "none", easing: "ease-out" },
          { transform: `scale(1.08, .86) rotate(${-4 * side}deg)`, offset: 0.14, easing: "ease-in-out" },
          { transform: "scale(.92, .82)", opacity: 1, offset: 0.24, easing: pull },
          // Drawn in through the knot by the ribbon being pulled
          { transform: `translate(${-4 * side}px, 3px) scale(.16, .3) rotate(${22 * side}deg)`, opacity: 0.9, offset: 0.66 },
          { transform: `scale(0) rotate(${30 * side}deg)`, opacity: 0, offset: 0.76 },
          { transform: "scale(0)", opacity: 0 },
        ],
        bow,
      );
    }
    part("knot")?.animate(
      [
        { transform: "none" },
        { transform: "scale(.8, 1.14)", offset: 0.14 }, // cinched by the tug
        { transform: "scale(.86, 1.08)", offset: 0.24 },
        { transform: "scale(1.2, .78)", opacity: 1, offset: 0.6 }, // loosening as the loops pass through
        { transform: "scale(.3)", opacity: 0.8, offset: 0.76 },
        { transform: "scale(0)", opacity: 0 },
      ],
      { ...bow, easing: "ease-in-out" },
    );
    // The bands over the lid and down the walls are the same ribbon: untied, they slip away too
    gift.querySelectorAll<SVGElement>("[data-ribbon]").forEach((band) =>
      band.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(5px)" }], {
        duration: 380,
        delay: bow.duration * 0.68,
        easing: "ease-in",
        ...keep,
      }),
    );

    // 2 · The lid pops off, then the walls fall open
    later(timeline.lid, () => {
      part("lid")?.animate(
        [
          { transform: "none" },
          { transform: "translateY(5px) scale(1.03, .96)", offset: 0.1 },
          { transform: "translate(-8px, -120px) rotate(-9deg)", offset: 0.4 },
          { transform: "translate(-44px, -320px) rotate(-26deg)", opacity: 1, offset: 0.75 },
          { transform: "translate(-64px, -440px) rotate(-34deg)", opacity: 0 },
        ],
        { duration: 960, easing: "cubic-bezier(.2, .75, .35, 1)", ...keep },
      );
    });
    later(timeline.walls, () => {
      const duration = 760;

      part("front-seam")?.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 90, easing: "ease-out", ...keep },
      );

      for (const wall of walls) {
        const name = `wall-${wall.name}`;

        if (wall.name.startsWith("front")) {
          const group = gift.querySelector<SVGGElement>(`[data-part="${name}"]`);
          if (group) animateFrontWall(group, wall, duration);
          continue;
        }

        part(name)?.animate(fallKeyframes(wall), {
          duration,
          delay: 70,
          easing: "linear",
          ...keep,
        });
      }
    });
    // The opened box lies flat for a moment, then fades away under the forming bear
    later(timeline.boxFade, () => part("box")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: "ease-in-out", ...keep }));

    // 3 · The confetti goes up as the lid clears the box; the emptied box fades away under it
    later(timeline.burst, () => {
      void startBear(false);
    });

    // 4 · The greeting appears under the bear as the falling confetti passes over its place
    later(timeline.greeting, () => {
      greetingAt.current = performance.now();
      setStatus(greeting.title.join(" "));
    });

    // 5 · The bear has formed: give it the screen for a moment, then let the story scroll
    later(timeline.settled, () => {
      reveal.advance("bear");
      setStatus(`${greeting.title.join(" ")} ${anniversary.revealDescription}`);
    });
    later(timeline.invite, () => {
      reveal.advance("open");
      setStatus(`${anniversary.revealDescription} Scroll to continue.`);
    });
  }

  // The lamp's "give": the box answers the press itself, before the click lands
  function press() {
    if (reveal.get() !== "closed" || isReducedMotion()) return;
    void prepare();
    stickyRef.current?.querySelectorAll('[data-part="box"]').forEach((box) =>
      box.animate([{ transform: "none" }, { transform: "scale(1.035, .955)", offset: 0.35 }, { transform: "none" }], {
        duration: 380,
        easing: "ease-out",
      }),
    );
  }

  // Start: the music begins as the gift box falls in, and from here the whole show plays by itself
  function start(auto = true) {
    if (started) return;
    setAutoScroll(auto);
    startedAt.current = performance.now();
    const audio = music.current;
    if (audio && !musicFailed.current) {
      audio.currentTime = 0;
      audio.playbackRate = MUSIC_RATE;
      audio.preservesPitch = true;
      audio.loop = true;
      try {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = 0;
        context.createMediaElementSource(audio).connect(gain).connect(context.destination);
        void context.resume();
        fader.current = { context, gain };
      } catch {
        audio.volume = 0;
      }
      audio.play().catch(() => { musicFailed.current = true; });
    } else musicFailed.current = true;
    setStarted(true);
  }

  // Back to the bouquet: the page goes straight to the top while the ring box is still on screen;
  // the question fades, the lid closes, the box turns back into the bouquet, and then the greeting
  // comes again (the story loop plays the ending backwards from here)
  function goBackUp() {
    const hero = heroRef.current;
    if (!hero) return;
    returning.current = true;
    greetingAt.current = -1;
    setStatus(greeting.title.join(" "));
    window.scrollTo({ top: hero.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
  }

  // The latest open(), for the show's clock to call
  useEffect(() => { openGift.current = open; });

  // The closed gift, waiting to be opened, gives a little shake
  const shakeGift = useCallback(() => {
    stickyRef.current?.querySelectorAll('[data-part="box"]').forEach((box) =>
      box.animate(
        [
          { transform: "none" },
          { transform: "translateY(-3px) rotate(-3deg)", offset: 0.14 },
          { transform: "translateY(-2px) rotate(3deg)", offset: 0.3 },
          { transform: "translateY(-1px) rotate(-2.2deg)", offset: 0.46 },
          { transform: "rotate(1.4deg)", offset: 0.62 },
          { transform: "rotate(-0.6deg)", offset: 0.8 },
          { transform: "none" },
        ],
        { duration: 680, easing: "ease-in-out" },
      ),
    );
  }, []);

  // The show follows the music's clock: open the gift at OPEN_AT, then scroll through the story,
  // then bring each photo forward in turn, and finally step on to the ring box
  useEffect(() => {
    if (!started || !autoScroll) return;
    const photos = memoryPhotos.length;
    let lastShake = 0;
    let invitedAt = -1;
    let frame = 0;
    // Where the show picks up again after the visitor has scrolled the photos themselves
    let handBack: { photo: number; at: number } | null = null;
    let handedBackAt = -Infinity;
    let landed = false; // the scroll has reached the bottom, and the page is the visitor's again
    // The song loops: count each time round, so the show's clock keeps going forward
    let rounds = 0;
    let lastRaw = 0;
    const musicTime = () => {
      const audio = music.current;
      const playing = audio && !musicFailed.current && !audio.error && (audio.currentTime > 0 || !audio.paused);
      if (!playing) return ((performance.now() - startedAt.current) / 1000) * MUSIC_RATE;
      if (audio.currentTime + 1 < lastRaw && Number.isFinite(audio.duration)) rounds++;
      lastRaw = audio.currentTime;
      return audio.currentTime + rounds * (Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const tick = () => {
      const time = musicTime();
      const stage = reveal.get();
      if (stage === "closed" && time >= OPEN_AT) openGift.current();
      // Every couple of seconds while it waits, once it has landed and not just before it opens
      else if (stage === "closed" && time > 2 && time < OPEN_AT - 0.9 && time - lastShake > 2.3) {
        lastShake = time;
        if (!isReducedMotion()) shakeGift();
      }
      if (stage === "open") {
        if (invitedAt < 0) invitedAt = time;
        const duration = musicFailed.current ? NaN : music.current?.duration ?? NaN;
        const schedule = autoplaySchedule(invitedAt, photos, duration);
        const show = autoplayAt(time, schedule, photos);
        const hero = heroRef.current;
        if (hero) {
          const bounds = hero.getBoundingClientRect();
          // Scrolled away from the photos after the show let go (by hand, or "Go back up"): the show is over
          if (landed && bounds.bottom > window.innerHeight + 2) return;
          if (!landed) {
            const length = hero.offsetHeight - window.innerHeight;
            const y = Math.round(bounds.top + window.scrollY + show.scroll * length);
            if (Math.abs(window.scrollY - y) >= 1) window.scrollTo({ top: y, behavior: "instant" });
            landed = show.scroll >= 1;
          }
          // The film: gliding from just before the scroll lands
          if (time >= schedule.photosFrom) {
            const touched = photoTouchedAt.current;
            if (performance.now() - touched < HAND_BACK_SECONDS * 1000) {
              // The visitor is scrolling the photos: theirs to move until they leave it alone
            } else {
              if (touched > handedBackAt) {
                handedBackAt = touched;
                handBack = { photo: photoIndex.current, at: time };
              }
              photoIndex.current = handBack ? photoAfterHandBack(time, schedule, photos, handBack) : show.photo;
            }
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, autoScroll, shakeGift]);

  // Fade the song in at its start and out before its end, every time round
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => {
      const audio = music.current;
      if (!audio) return;
      const level = musicLevel(audio.currentTime, audio.duration);
      const fade = fader.current;
      if (fade) fade.gain.gain.setTargetAtTime(level, fade.context.currentTime, 0.06);
      else audio.volume = level;
    }, 50);
    return () => window.clearInterval(timer);
  }, [started]);

  // Stop the music if the page goes away
  useEffect(() => () => music.current?.pause(), []);

  const opened = stage !== "closed";
  const invited = stage === "open";

  return (
    <section
      data-intro={intro}
      ref={heroRef}
      aria-labelledby="greeting-heading"
      className="relative"
      style={invited ? { height: `${TRACK_SCREENS * 100}svh` } : undefined}
    >
      {intro !== "ready" && (
        <div className="gift-loader">
          <div className="gift-loader-panel">
            <p role="status" className="gift-loader-title">{loadFailed ? "Your gift couldn’t finish loading." : loading ? "Preparing your gift…" : "Your gift is ready."}</p>
            {loadFailed ? (
              <button className="rounded-ui border border-accent px-6 py-3 text-xl" onClick={() => {
                setLoadFailed(false);
                setLoaded(0);
                setAttempt(value => value + 1);
              }}>Try again</button>
            ) : !loading ? (
              <>
                <button type="button" className="gift-start" onClick={() => start()} disabled={started}>
                  Start
                </button>
                <button type="button" className="gift-start-plain" onClick={() => start(false)} disabled={started}>
                  Continue without auto scroll
                </button>
                <p className="gift-start-note">Do not touch anything after starting</p>
              </>
            ) : (
              <>
                <div className="gift-loader-track" role="progressbar" aria-label="Gift loading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <span className="gift-loader-fill" style={{ width: `${percent}%` }} />
                </div>
                <span aria-hidden="true" className="gift-loader-percent">{percent}%</span>
              </>
            )}
          </div>
        </div>
      )}
      <div inert={intro !== "ready"} ref={stickyRef} className="hero sticky top-0 h-svh min-h-[30rem] overflow-hidden" style={{ touchAction: "pan-y pinch-zoom" }}>
        {/* Back walls and floor, behind the particles */}
        <div aria-hidden="true" className="gift-arrival-layer pointer-events-none absolute top-1/2 left-1/2 w-[min(84vw,36rem,calc(64svh*0.94))] -translate-x-1/2 -translate-y-1/2">
          <GiftBox layer="back" />
        </div>
        <div ref={layerRef} aria-hidden="true" className="bear-canvas pointer-events-none absolute inset-0">
          <canvas ref={canvasRef} className="absolute inset-0 size-full" />
          {stageMounted && <BearStage className="absolute inset-0" onReady={onStageReady} onLost={onStageLost} />}
        </div>

        <button
          disabled={intro !== "ready"}
          ref={giftRef}
          type="button"
          aria-label={opened ? "Your gift is open" : anniversary.giftLabel}
          aria-disabled={opened || undefined}
          tabIndex={opened ? -1 : 0}
          onPointerDown={press}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") press();
          }}
          onPointerEnter={() => void prepare()}
          onFocus={() => void prepare()}
          onClick={open}
          className="gift gift-arrival-layer absolute top-1/2 left-1/2 w-[min(84vw,36rem,calc(64svh*0.94))] -translate-x-1/2 -translate-y-1/2 rounded-ui"
        >
          <GiftBox layer="front" />
        </button>

        {/* The words: always in the document for screen readers; placed around the bear and heart by
            the layout effect, and shown on screen by the story loop */}
        <div className="pointer-events-none absolute inset-0">
          <div data-slot="words" className="absolute inset-x-4 text-center" style={{ top: "70%" }}>
            <h1 data-line="greeting" id="greeting-heading" className="text-[clamp(2.3rem,6.6vw,5rem)] font-bold leading-[0.95] tracking-[-0.04em]" style={hiddenLine("center top")}>
              <span className="block">{greeting.title[0]}</span> <span className="title-accent block text-accent">{greeting.title[1]}</span>
            </h1>
          </div>
          <p className="sr-only">
            {finale.left} love {finale.right}. {finale.line}.
          </p>
          <div data-slot="left" className="heart-word-position">
            <span data-line="i" aria-hidden="true" className="block font-serif heart-letter leading-none text-foreground" style={hiddenLine("right center")}>
              {finale.left}
            </span>
          </div>
          <div data-slot="right" className="heart-word-position">
            <span data-line="u" aria-hidden="true" className="block font-serif heart-letter leading-none text-foreground" style={hiddenLine("left center")}>
              {finale.right}
            </span>
          </div>
          <div data-slot="love" aria-hidden="true" className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: "50%", top: "45%" }}>
            <p data-line="love" className="font-serif text-[clamp(2.2rem,min(4.6vw,8svh),4.5rem)] leading-[1.05] italic" style={hiddenLine("center center")}>
              <span data-love-text className="block">{loveYou[0].text}</span>
              <span data-love-language className="mt-3 block font-mono text-[clamp(0.65rem,1.2vw,0.8rem)] not-italic uppercase tracking-[0.3em] text-muted">{loveYou[0].language}</span>
            </p>
          </div>
          <div data-slot="question" className="absolute inset-x-4 text-center" style={{ top: "75%" }}>
            <p data-line="question" className="text-[clamp(1.9rem,min(5.4vw,7svh),4.2rem)] font-bold leading-[0.95] tracking-[-0.04em]" style={hiddenLine("center top")}>
              <span className="block">{question[0]}</span> <span className="title-accent block text-accent">{question[1]}</span>
            </p>
            {finished && (
              <button type="button" className="gift-start pointer-events-auto mt-[clamp(1.25rem,4svh,2.5rem)]" onClick={goBackUp}>
                Go back up
              </button>
            )}
          </div>
          <div data-slot="under" className="heart-word-position">
            <span data-line="forever" aria-hidden="true" className="inline-block font-serif forever-word font-semibold leading-none italic text-accent" style={hiddenLine("center top")}>
              {finale.line}
            </span>
          </div>
        </div>

        {invited && <Filmstrip {...film} />}
        {invited && (
          <p ref={cueRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted">
            Scroll
            <span className="mx-auto mt-2 block h-6 w-px bg-current" />
          </p>
        )}

        <svg aria-hidden="true" className="absolute size-0">
          {lineKeys.map((key, i) => (
            <filter key={key} id={`ripple-${key}`} x="-30%" y="-60%" width="160%" height="220%" colorInterpolationFilters="sRGB">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.01 0.05"
                numOctaves={2}
                seed={i + 3}
              />
              <feDisplacementMap
                in="SourceGraphic"
                scale={0}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          ))}
        </svg>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}

// Each word starts hidden; the story loop shows it
const hiddenLine = (origin: string): React.CSSProperties => ({ opacity: 0, visibility: "hidden", transformOrigin: origin, willChange: "transform, opacity, filter" });
