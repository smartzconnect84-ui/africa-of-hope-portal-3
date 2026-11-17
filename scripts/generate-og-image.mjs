/**
 * Builds the raster share card public/og-card.png (1200x630) from
 * public/og-card.svg so shared links unfurl a real picture on every
 * network. Runs in the build chain (see package.json "build").
 * Never fails the build — the SVG source stays as the fallback.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgFile = join(root, "public", "og-card.svg");
const pngFile = join(root, "public", "og-card.png");

try {
  if (!existsSync(svgFile)) {
    console.log("[og-image] public/og-card.svg not found — skipping");
    process.exit(0);
  }
  const { default: sharp } = await import("sharp");
  const svg = readFileSync(svgFile);
  await sharp(svg, { density: 150 })
    .resize(1200, 630, { fit: "cover" })
    .png()
    .toFile(pngFile);
  console.log("[og-image] wrote public/og-card.png (1200x630)");
} catch (err) {
  console.log(`[og-image] skipped PNG render (${String(err).slice(0, 120)}); SVG fallback remains`);
}
