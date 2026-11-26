// Reduce Motion, all in one place (the same store as the portfolio's). Every animated part of the
// site asks this module, never the device setting directly.
//
// A saved choice wins; until there is one, the device's "reduce motion" setting decides, and changes
// to it are followed live. The answer is mirrored on <html data-motion="reduce|full">, which is what
// the CSS uses (globals.css), and components subscribe with useReducedMotion().

const STORAGE_KEY = "reduce-motion"; // "on" | "off"; missing = follow the device
const QUERY = "(prefers-reduced-motion: reduce)";

// Runs in <head> before the page paints, so the first frame already has the right motion
export const motionScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var r=s==='on'?true:s==='off'?false:window.matchMedia('${QUERY}').matches;document.documentElement.dataset.motion=r?'reduce':'full';}catch(e){}})();`;

type Choice = "on" | "off" | null;

let choice: Choice | undefined; // read from storage the first time it's needed
const listeners = new Set<() => void>();
let media: MediaQueryList | null = null;

const isBrowser = () => typeof window !== "undefined";

function readChoice(): Choice {
  if (choice === undefined) {
    try {
      const saved = isBrowser() ? localStorage.getItem(STORAGE_KEY) : null;
      choice = saved === "on" || saved === "off" ? saved : null;
    } catch {
      choice = null;
    }
  }
  return choice;
}

function deviceReduces() {
  return isBrowser() && window.matchMedia(QUERY).matches;
}

function isReduced(): boolean {
  if (!isBrowser()) return false;
  const saved = readChoice();
  return saved === null ? deviceReduces() : saved === "on";
}

function reflect() {
  if (!isBrowser()) return;
  document.documentElement.dataset.motion = isReduced() ? "reduce" : "full";
}

function emit() {
  reflect();
  listeners.forEach((listener) => listener());
}

const onDeviceChange = () => {
  if (readChoice() === null) emit(); // only matters while no choice is saved
};

const onStorage = (event: StorageEvent) => {
  if (event.key !== STORAGE_KEY) return; // changed in another tab
  choice = event.newValue === "on" || event.newValue === "off" ? event.newValue : null;
  emit();
};

export const motion = {
  // For useSyncExternalStore, and for long-lived effects that want to react without re-running
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1 && isBrowser()) {
      media = window.matchMedia(QUERY);
      media.addEventListener("change", onDeviceChange);
      window.addEventListener("storage", onStorage);
      reflect(); // in case the head script couldn't run
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && media) {
        media.removeEventListener("change", onDeviceChange);
        window.removeEventListener("storage", onStorage);
        media = null;
      }
    };
  },
  getSnapshot: isReduced,
  getServerSnapshot: () => false,
};

export { isReduced as isReducedMotion };
