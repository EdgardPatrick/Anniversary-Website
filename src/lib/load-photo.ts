const photos = new Map<string, Promise<HTMLImageElement>>();

export function loadPhoto(src: string): Promise<HTMLImageElement> {
  const cached = photos.get(src);
  if (cached) return cached;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  const pending = image.decode().then(() => image).catch((error) => {
    photos.delete(src);
    throw error;
  });
  photos.set(src, pending);
  return pending;
}
