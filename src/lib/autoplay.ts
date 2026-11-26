// The hands-free show that runs after the Start button: everything follows the music's clock, so
// the gift, the scroll, the photos and the ring box stay in time with the song even if it buffers.
//
// 0 s     the music starts as the gift box falls in
// 9 s     the gift opens
// then    once the bear invites the scroll, the page scrolls slowly through the story, and lets go
//         of the page once it reaches the bottom
// then    the film glides steadily through the photos, already moving as the strip arrives
// last    one step past the last photo: the ring box, with the rest of the song under the question
//
// Times here are positions in the song, so they hold at any playback speed.

/** The song plays this much faster than recorded (its pitch is kept) */
export const MUSIC_RATE = 1.15;

/**
 * If the visitor scrolls the photos themselves, the show lets them; once they have left it alone
 * this long (seconds), it carries on from the photo they stopped on
 */
export const HAND_BACK_SECONDS = 5;
/** Seconds into the music when the gift opens */
export const OPEN_AT = 9;
/** The song fades in over this long at its start, and out over this long before its end, each time round (music seconds) */
export const FADE_IN = 3;
export const FADE_OUT = 4;

/** How loud the song should be at music time `time` (within one play-through), 0 → 1 */
export function musicLevel(time: number, duration: number) {
  const fadeIn = time / FADE_IN;
  const fadeOut = Number.isFinite(duration) ? (duration - time) / FADE_OUT : 1;
  return Math.min(1, Math.max(0, Math.min(fadeIn, fadeOut)));
}
/** How long the slow scroll through the bouquet, heart and bear takes */
export const SCROLL_SECONDS = 24;
/** The film starts gliding this long before the scroll lands, while it is still arriving, so it never stops */
const GLIDE_LEAD = 1.5;
/** The glide gathers speed over this long, so its start blends into the film's arrival */
const GLIDE_RAMP = 2;
/** A moment on the last photo before the ring box */
const LAST_PHOTO_REST = 1.5;
/** Music left to play under the ring box and the question, at the slowest pace */
const ENDING_RESERVE = 30;
/** The glide runs this much faster than the pace that would exactly fill the song */
const PACE = 1.6;
const PHOTO_SECONDS = { min: 1.4, max: 5, fallback: 3.2 };

export interface AutoplaySchedule {
  /** Music time when the scroll starts and ends */
  scrollFrom: number;
  scrollTo: number;
  /** Music time when the film starts gliding, and how long it takes to move on by one photo at full speed */
  photosFrom: number;
  perPhoto: number;
  /** Music time when the film leaves for the ring box */
  ringAt: number;
}

/** How far the glide has gone after `seconds`, in seconds at full speed: a soft start, then steady */
const glided = (seconds: number) =>
  seconds <= 0 ? 0 : seconds < GLIDE_RAMP ? (seconds * seconds) / (2 * GLIDE_RAMP) : seconds - GLIDE_RAMP / 2;

/** How long a glide over `photos` photos takes, soft start included */
const glideTime = (photos: number, perPhoto: number) => photos * perPhoto + GLIDE_RAMP / 2;

/**
 * Plans the show once the page can scroll (`invitedAt`, music seconds), for `photos` photos and a
 * song `duration` seconds long (NaN or Infinity if unknown).
 */
export function autoplaySchedule(invitedAt: number, photos: number, duration: number): AutoplaySchedule {
  const scrollFrom = invitedAt;
  const scrollTo = scrollFrom + SCROLL_SECONDS;
  const photosFrom = scrollTo - GLIDE_LEAD;
  const fill = Number.isFinite(duration) ? (duration - ENDING_RESERVE - photosFrom) / Math.max(1, photos) : PHOTO_SECONDS.fallback * PACE;
  const perPhoto = Math.min(PHOTO_SECONDS.max, Math.max(PHOTO_SECONDS.min, fill / PACE));
  return { scrollFrom, scrollTo, photosFrom, perPhoto, ringAt: photosFrom + glideTime(photos - 1, perPhoto) + LAST_PHOTO_REST };
}

/** Eases in, then keeps going at a steady speed right to the bottom, so the film arrives still moving */
const EASE_IN = 0.25;
const ease = (t: number) => (t < EASE_IN ? (t * t) / (EASE_IN * (2 - EASE_IN)) : (2 * t - EASE_IN) / (2 - EASE_IN));

/** The film's position at music time `time` when it set off from `photo` at music time `at` */
const glide = (time: number, schedule: AutoplaySchedule, photos: number, photo: number, at: number) =>
  Math.min(photos - 1, photo + glided(time - at) / schedule.perPhoto);

/**
 * Where the show is at music time `time`: how far down the story the page should be (0 → 1),
 * and the film's position in photos (gliding from 0 to photos - 1, then `photos` for the ring box).
 */
export function autoplayAt(time: number, schedule: AutoplaySchedule, photos: number) {
  const t = Math.min(1, Math.max(0, (time - schedule.scrollFrom) / (schedule.scrollTo - schedule.scrollFrom)));
  const photo = time >= schedule.ringAt ? photos : glide(time, schedule, photos, 0, schedule.photosFrom);
  return { scroll: ease(t), photo };
}

/**
 * The film's position at music time `time` once the visitor has handed it back: gliding on again
 * from `from.photo` at music time `from.at`, resting a moment on the last photo, then the ring box (`photos`).
 */
export function photoAfterHandBack(time: number, schedule: AutoplaySchedule, photos: number, from: { photo: number; at: number }) {
  const ringAt = from.at + glideTime(photos - 1 - from.photo, schedule.perPhoto) + LAST_PHOTO_REST;
  return from.photo >= photos || time >= ringAt ? photos : glide(time, schedule, photos, from.photo, from.at);
}
