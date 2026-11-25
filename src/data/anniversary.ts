import type { Anniversary } from "@/types/content";

// Every personal line from the original page, kept word for word. After the bear forms, the
// greeting and the finale appear one beat at a time as the visitor scrolls.
export const anniversary: Anniversary = {
  title: "For you · Happy Anniversary",
  description: "A little something for you, wrapped in your favorite blue.",
  brand: "For you",
  giftLabel: "Open your anniversary gift",
  revealDescription: "A bouquet of blue tulips around a sunflower, wrapped in light blue.",
  greeting: {
    eyebrow: "An anniversary delivery",
    title: ["Happy Anniversary,", "baeby."],
    lead: "A little something for you, wrapped in your favorite blue.",
    action: "Read your love note",
  },
  finale: {
    left: "I",
    right: "U",
    line: "Forever",
  },
  note: {
    eyebrow: "Love note",
    message: "I love you",
    signoff: "Yours, always",
  },
  postmarks: {
    head: "Love post",
    foot: "Special delivery",
    seal: "Sealed with love",
  },
};
