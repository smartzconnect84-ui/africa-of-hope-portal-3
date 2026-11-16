import QRCode from "qrcode";

const cache = new Map<string, string>();

/**
 * Generates a QR code that points at one certificate's public verification page.
 * The value is encoded in the QR itself, so scanning always opens that record.
 */
export async function certificateQrDataUrl(url: string): Promise<string> {
  const value = url.trim();
  if (!value) throw new Error("A verification URL is required to generate the QR code.");
  const cached = cache.get(value);
  if (cached) return cached;
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 512,
    color: { dark: "#0F2B1B", light: "#FFFFFF" },
  });
  cache.set(value, dataUrl);
  return dataUrl;
}

/** Non-throwing variant for render paths: the certificate prints without a QR if encoding fails. */
export async function tryCertificateQrDataUrl(url: string): Promise<string | null> {
  try {
    return await certificateQrDataUrl(url);
  } catch {
    return null;
  }
}
