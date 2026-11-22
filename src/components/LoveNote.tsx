import { Section } from "@/components/Section";
import { anniversary } from "@/data/anniversary";

const { note, postmarks } = anniversary;

// The note the opening leads to, set like one of the portfolio's sections:
// a ruled header, one large line, and a ledger of the postmarks from the original card.
export function LoveNote() {
  return (
    <Section id="note" index="01" eyebrow={note.eyebrow}>
      <div className="reveal flex flex-col gap-6 sm:flex-row sm:items-baseline sm:justify-between" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.05em]">
          {note.message}
          <span className="text-accent">.</span>
        </h2>
        <p className="font-serif text-[clamp(1.4rem,2.6vw,2.1rem)] italic text-accent">{note.signoff}</p>
      </div>

      <dl className="reveal mt-16 grid border-t border-border font-mono text-xs uppercase tracking-[0.18em] sm:grid-cols-3" style={{ "--i": 2 } as React.CSSProperties}>
        {[
          ["From", postmarks.head, "♡"],
          ["Sent by", postmarks.foot, "✦"],
          ["Closed", postmarks.seal, "♡"],
        ].map(([label, value, mark]) => (
          <div key={value} className="flex items-center justify-between gap-4 border-b border-border py-4 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
            <dt className="text-muted">{label}</dt>
            <dd className="flex items-center gap-2 text-foreground">
              {value}
              <span aria-hidden="true" className="text-accent">
                {mark}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
