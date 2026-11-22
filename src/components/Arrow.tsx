// A small arrow that slides forward when its button or link is hovered (.btn-arrow in globals.css)
export function Arrow({ direction = "right", className = "" }: { direction?: "right" | "down" | "up"; className?: string }) {
  const d = direction === "down" ? "M12 5v14M5 12l7 7 7-7" : direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M5 12h14M13 5l7 7-7 7";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-dir={direction}
      className={`btn-arrow shrink-0 ${/\bsize-/.test(className) ? "" : "size-4"} ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
