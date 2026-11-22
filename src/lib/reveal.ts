// Where the visitor is in the gift's opening, shared by the hero and the content below it.
// It only moves forward, so repeated taps or key presses can never restart or overlap a stage.

export type RevealStage = "closed" | "opening" | "bear" | "open";

const order: RevealStage[] = ["closed", "opening", "bear", "open"];

let stage: RevealStage = "closed";
const listeners = new Set<() => void>();

export const reveal = {
  get: () => stage,

  /** Moves to `next` if it's further along; returns whether anything changed */
  advance(next: RevealStage) {
    if (order.indexOf(next) <= order.indexOf(stage)) return false;
    stage = next;
    if (typeof document !== "undefined") document.documentElement.dataset.reveal = stage;
    listeners.forEach((listener) => listener());
    return true;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => stage,
  getServerSnapshot: (): RevealStage => "closed",

  /** Tests only */
  reset() {
    stage = "closed";
  },
};
