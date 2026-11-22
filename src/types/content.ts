// Shapes for the site's content (src/data/). Pages read these records instead of hard-coding copy,
// so words can change without touching layout.

export interface Greeting {
  /** Small line above the heading */
  eyebrow: string;
  /** Heading lines; the last one gets the accent color */
  title: string[];
  lead: string;
  /** Label of the button that leads to the note */
  action: string;
}

/** The last beat of the scroll story: "I ♥ U", then a word under the heart */
export interface Finale {
  left: string;
  right: string;
  line: string;
}

export interface LoveNote {
  eyebrow: string;
  message: string;
  signoff: string;
}

export interface Postmarks {
  head: string;
  foot: string;
  seal: string;
}

export interface Anniversary {
  /** Browser tab title */
  title: string;
  description: string;
  /** Short name used in the footer */
  brand: string;
  /** Accessible name of the gift box, which is the only control on the opening screen */
  giftLabel: string;
  /** Read aloud once the bear has formed */
  revealDescription: string;
  greeting: Greeting;
  finale: Finale;
  note: LoveNote;
  postmarks: Postmarks;
}
