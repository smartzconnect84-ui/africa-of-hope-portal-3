import { toJpeg, toPng } from "html-to-image";

export type CertificateImageFormat = "png" | "jpg";

export async function downloadCertificateImage(
  elementId: string,
  filename: string,
  format: CertificateImageFormat = "png",
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Certificate preview is unavailable.");
  const dataUrl = format === "jpg"
    ? await toJpeg(element, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff", quality: 0.95 })
    : await toPng(element, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = filename.replace(/\.(png|jpe?g)$/i, "") + (format === "jpg" ? ".jpg" : ".png");
  link.href = dataUrl;
  link.click();
}
