let available: boolean | undefined;

export function supportsWebGL() {
  if (typeof document === "undefined") return true;
  if (available !== undefined) return available;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    available = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    available = false;
  }
  return available;
}
