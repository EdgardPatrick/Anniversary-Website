// Shared button styles: rectangular with rounded corners, never pill-shaped.
// .btn adds the hover lift; .btn-primary adds the sheen (see globals.css, "Buttons").
const base =
  "btn inline-flex items-center justify-center gap-2 rounded-ui px-5 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const buttonPrimary = `${base} btn-primary bg-accent text-accent-foreground`;
export const buttonSecondary = `${base} border border-border-strong/60 bg-surface text-foreground hover:border-accent`;
