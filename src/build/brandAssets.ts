import type { Plugin } from "vite";
import sharp from "sharp";

// Permanent owner-supplied source. Production emits local files so installed
// identity and the launch screen do not depend on third-party image hosting.
const SOURCE = "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

async function keyOutBlackBackground(input: Buffer): Promise<Buffer> {
  // The owner-supplied mark ships on a flat black field. Key near-black pixels
  // to transparent so the splash, header and PWA surfaces show the mark
  // itself — CSS cannot remove a background baked into the file.
  // Dark-green figures are preserved because only pixels dark on ALL channels
  // are keyed (green figures have a strong green channel).
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const TH = 32;
  const FEATHER = 22;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const m = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (m <= TH) data[i + 3] = 0;
    else if (m < TH + FEATHER) data[i + 3] = Math.round(data[i + 3] * ((m - TH) / FEATHER));
  }
  // Trim the now-transparent margins so the mark renders larger in the same
  // slot without shifting nearby nav links, cards or text.
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

let pending: Promise<Map<string, Buffer>> | undefined;
export const createBrandAssets = () => pending ??= (async () => {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Official logo download failed (${response.status}). Retry the build; no placeholder icon will be shipped.`);
    const original = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(original).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Official logo is not a valid image.");
    const result = new Map<string, Buffer>();
    const cleaned = await keyOutBlackBackground(original).catch(() => original);
    result.set("logo/aoh-logo.png", await sharp(cleaned).png().toBuffer());
    const square = async (size: number, maskable = false) => {
      // Maskable content fits inside a square whose corners lie within the
      // central 80%-diameter safe circle. No part of the mark is cropped.
      const content = maskable ? Math.floor(size * 0.56) : Math.floor(size * 0.92);
      const image = await sharp(cleaned).resize(content, content, { fit: "contain", background: "#ffffff00" }).png().toBuffer();
      return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
        .composite([{ input: image, gravity: "centre" }]).png().toBuffer();
    };
    for (const size of [32, 180, 192, 512]) {
      const name = size === 32 ? "favicon.png" : size === 180 ? "icons/apple-touch-icon.png" : `icons/icon-${size}.png`;
      result.set(name, await square(size));
    }
    result.set("icons/maskable-512.png", await square(512, true));
    // Modern ICO containers support a lossless PNG payload.
    const favicon = result.get("favicon.png")!;
    const ico = Buffer.alloc(22);
    ico.writeUInt16LE(1, 2);
    ico.writeUInt16LE(1, 4);
    ico[6] = 32; ico[7] = 32;
    ico.writeUInt16LE(1, 10);
    ico.writeUInt16LE(32, 12);
    ico.writeUInt32LE(favicon.length, 14);
    ico.writeUInt32LE(22, 18);
    result.set("favicon.ico", Buffer.concat([ico, favicon]));
    return result;
  })().catch((error: unknown) => { pending = undefined; throw error; });

export default function brandAssets(): Plugin {
  return {
    name: "aoh-production-brand-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url || "").split("?")[0].replace(/^\//, "");
        if (!/^(?:(logo\/aoh-logo|favicon|icons\/(icon-(192|512)|apple-touch-icon|maskable-512))\.png|favicon\.ico)$/.test(pathname)) return next();
        void createBrandAssets().then((files) => {
          const file = files.get(pathname);
          if (!file) return next();
          response.setHeader("Content-Type", pathname.endsWith(".ico") ? "image/x-icon" : "image/png");
          response.setHeader("Cache-Control", "public, max-age=3600");
          response.end(file);
        }).catch((error: unknown) => {
          server.config.logger.error(String(error));
          response.statusCode = 503;
          response.end("Brand assets unavailable. Retry after checking the source image connection.");
        });
      });
    },
    async generateBundle() {
      for (const [fileName, source] of await createBrandAssets()) this.emitFile({ type: "asset", fileName, source });
    },
  };
}
