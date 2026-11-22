"use client";

import { useRevealStage } from "@/lib/use-preferences";

// Holds everything below the hero until the gift has been opened, so the first screen is the box alone.
// Without JavaScript the <noscript> rule in the layout shows it anyway.
export function AfterReveal({ children }: { children: React.ReactNode }) {
  const stage = useRevealStage();
  return (
    <div data-after-reveal hidden={stage !== "open"}>
      {children}
    </div>
  );
}
