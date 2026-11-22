import { beforeEach, describe, expect, it } from "vitest";
import { reveal } from "@/lib/reveal";

describe("reveal store", () => {
  beforeEach(() => reveal.reset());

  it("only moves forward, so repeated input can't restart the opening", () => {
    expect(reveal.advance("opening")).toBe(true);
    expect(reveal.advance("opening")).toBe(false);
    expect(reveal.advance("closed")).toBe(false);
    expect(reveal.get()).toBe("opening");
  });

  it("can skip straight to the end, as the reduced-motion reveal does", () => {
    expect(reveal.advance("open")).toBe(true);
    expect(reveal.advance("bear")).toBe(false);
    expect(reveal.get()).toBe("open");
  });

  it("tells subscribers about each change", () => {
    let calls = 0;
    const unsubscribe = reveal.subscribe(() => calls++);
    reveal.advance("opening");
    reveal.advance("opening");
    reveal.advance("bear");
    unsubscribe();
    expect(calls).toBe(2);
  });
});
