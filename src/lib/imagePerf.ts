/**
 * Client-side image optimisation — the single biggest win for upload speed
 * and runtime memory on low-end phones.
 *
 * Large phone photos (4–12 MB) are downscaled to a max dimension of 1920px
 * and re-encoded as JPEG/WebP (~70–85% smaller) BEFORE they reach Supabase,
 * so uploads finish faster, use less RAM, and cost less bandwidth/storage.
 * GIFs, SVGs and files already under ~800 KB are passed through untouched.
 */

const MAX_DIMENSION = 1920;
const QUALITY = 0.82;
const PASSTHROUGH_BYTES = 800 * 1024;

export function shouldCompress(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return false;
  if (file.size < PASSTHROUGH_BYTES) return false;
  return file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
}

export async function compressImage(file: File, opts?: { preserveTransparency?: boolean }): Promise<File> {
  if (!shouldCompress(file)) return file;
  const preserve = Boolean(opts?.preserveTransparency) || (file.type === "image/png" && hasTransparencyHint(file));
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    // Logos and marks stay crisp at a smaller cap so text edges never blur.
    const cap = preserve ? 1024 : MAX_DIMENSION;
    const scale = Math.min(1, cap / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: preserve ? true : false });
    if (!ctx) return file;
    if (preserve) {
      // Transparent path: no white base, no flatten — alpha channel survives.
      ctx.clearRect(0, 0, w, h);
    } else {
      // White base so transparent PNGs don't turn black when flattened to JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const outType = preserve
      ? (file.type === "image/webp" ? "image/webp" : "image/png")
      : (file.type === "image/png" && hasTransparencyHint(file) ? "image/png" : "image/jpeg");
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "photo";
    return new File([blob], `${base}-optimized.${ext}`, { type: outType });
  } catch {
    return file;
  }
}

function hasTransparencyHint(file: File): boolean {
  return /logo|icon|splash|seal|favicon/i.test(file.name);
}

/** Frees a blob URL created with URL.createObjectURL — call after upload. */
export function revokePreview(url?: string) {
  try {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  } catch {
    /* noop */
  }
}
