export interface MemoryPhoto {
  src: string;
  alt: string;
  date: string;
  description: string;
}

// Place images in public/photos, then add one entry for each frame in display order.
export const memoryPhotos: MemoryPhoto[] = [
  { src: "", alt: "", date: "", description: "" },
  { src: "", alt: "", date: "", description: "" },
  { src: "", alt: "", date: "", description: "" },
];
