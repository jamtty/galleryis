// Local artwork images never leave the browser (the §2 privacy stance): a
// picked File becomes an objectURL, kept alive for the works-panel thumbnail
// and revoked when the work is removed, plus a downscaled canvas that the
// scene builds its texture from.
//
// The same path serves a saved layout coming back out of IndexedDB, because
// what was saved is the downscaled canvas re-encoded, not the original file.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 10 * 1024 * 1024; // §6 client-enforced cap
export const MAX_WORKS = 15; // §6 client-enforced cap
export const MAX_TEXTURE_PX = 2048; // mobile GPU-memory ceiling

// Display forms of the caps above, interpolated into the i18n copy so the
// strings can never drift from the enforced values.
export const MAX_MB = MAX_BYTES / (1024 * 1024);
const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
export const ACCEPTED_TYPES_LABEL = ACCEPTED_TYPES.map(
  (type) => TYPE_LABELS[type] ?? type,
).join(" · ");

export type UploadRejection = "type" | "size" | "limit" | "unreadable";

/** Null when the file is accepted; the i18n rejection key otherwise. */
export function validateFile(
  file: File,
  worksCount: number,
): UploadRejection | null {
  if (worksCount >= MAX_WORKS) return "limit";
  if (!ACCEPTED_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_BYTES) return "size";
  return null;
}

export interface LoadedImage {
  /** objectURL of the original file, revoke when the work is removed. */
  url: string;
  /** ≤2048 px copy the texture reads from. */
  canvas: HTMLCanvasElement;
  naturalWidth: number;
  naturalHeight: number;
}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = url;
  });
}

/**
 * Accepts a Blob, not just a File, so a re-encoded canvas read back from
 * IndexedDB rehydrates through the identical decode-and-downscale path an
 * upload takes. A stored blob is already ≤{@link MAX_TEXTURE_PX}, so the scale
 * step is a no-op for it.
 */
export async function loadArtworkImage(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = await decode(url);
    const scale = Math.min(
      1,
      MAX_TEXTURE_PX / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d canvas context");
    // Matte onto white before drawing. A fresh canvas is transparent *black*
    // and the scene's material is opaque, so every pixel a PNG left
    // transparent, which is most of any exported logo or icon, reached the
    // wall as `rgb(0,0,0)`: works hung as black rectangles while the panel
    // thumbnail, an `<img>` the browser composites over the panel, looked
    // perfectly fine. White is what the wall is, and what a transparent PNG
    // comes back as from a printer; a hung work is an opaque object, not a
    // hole to see the wall through. Doing it here rather than at draw time
    // keeps the stored copy opaque too, so a saved layout cannot bring the
    // black back on reload.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      url,
      canvas,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Format and quality the local copy is kept in, see {@link encodeCanvas}. */
const STORAGE_TYPE = "image/webp";
const STORAGE_QUALITY = 0.82;
const FALLBACK_TYPE = "image/jpeg";
const FALLBACK_QUALITY = 0.85;

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if (typeof canvas.toBlob !== "function") return Promise.resolve(null);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The bytes kept on the device: the already-downscaled canvas re-encoded, not
 * the original file. A 2048 px WebP is ~25× smaller than a 10 MB original,
 * which is the difference between fifteen works fitting in a phone's storage
 * budget and not, and the scene renders this canvas anyway, so nothing is
 * lost. Re-encoding also drops the original's EXIF (GPS, camera, capture time),
 * which is the right side of the privacy stance to err on.
 *
 * `toBlob` silently falls back to PNG where WebP encoding is missing, and a PNG
 * of a photograph is *larger* than the JPEG it came from, so check what came
 * back rather than trusting the requested type.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, STORAGE_TYPE, STORAGE_QUALITY);
  if (webp?.type === STORAGE_TYPE) return webp;
  const jpeg = await toBlob(canvas, FALLBACK_TYPE, FALLBACK_QUALITY);
  if (jpeg) return jpeg;
  throw new Error("canvas encode failed");
}
