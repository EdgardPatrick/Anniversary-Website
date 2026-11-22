import { Arrow } from "@/components/Arrow";
import { anniversary } from "@/data/anniversary";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 pt-14 pb-10 sm:px-6">
        <div>
          <p className="text-lg font-semibold tracking-tight">{anniversary.brand}</p>
          <p className="mt-1 text-sm text-muted">{anniversary.postmarks.seal}</p>
        </div>
        <a
          href="#top"
          className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-foreground"
        >
          Back to the bear
          <Arrow direction="up" />
        </a>
      </div>

      {/* Decorative: the name, huge, fading into the bottom edge */}
      <p
        aria-hidden="true"
        className="wordmark pointer-events-none -mb-[0.18em] text-center text-[clamp(3.5rem,16vw,13rem)] font-extrabold uppercase leading-none tracking-tighter whitespace-nowrap"
      >
        {anniversary.brand}
      </p>
    </footer>
  );
}
