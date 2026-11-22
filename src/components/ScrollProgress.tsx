"use client";

import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const bar = useRef<HTMLProgressElement>(null);

  useEffect(() => {
    const update = () => {
      const page = document.documentElement;
      const distance = page.scrollHeight - page.clientHeight;
      if (bar.current) bar.current.value = distance > 0 ? window.scrollY / distance : 0;
    };
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <progress ref={bar} value={0} max={1} aria-label="Page scroll progress" className="scroll-progress" />;
}
