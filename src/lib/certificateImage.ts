import { toPng } from "html-to-image";

export async function downloadCertificateImage(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Certificate preview is unavailable.");
  const dataUrl = await toPng(element, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}
