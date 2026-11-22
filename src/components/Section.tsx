interface SectionProps {
  id: string;
  index: string;
  eyebrow: string;
  children: React.ReactNode;
}

// A section with the portfolio's spec-sheet header:
//   01 ─────────────── LOVE NOTE
export function Section({ id, index, eyebrow, children }: SectionProps) {
  return (
    <section id={id} tabIndex={-1} aria-label={eyebrow} className="mx-auto max-w-6xl scroll-mt-10 px-4 py-20 outline-none sm:px-6 md:py-28">
      <div aria-hidden="true" className="reveal flex items-center gap-4 font-mono text-xs uppercase tracking-[0.2em] text-muted">
        <span className="text-accent">{index}</span>
        <span className="rule-draw h-px flex-1 bg-border-strong/50" />
        <span>{eyebrow}</span>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}
