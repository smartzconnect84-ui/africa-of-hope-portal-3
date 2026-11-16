import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Vercel-safe brand preparation.
// Never fails the build: if the network, sharp, or TS helper is unavailable,
// it logs a warning and exits 0 so `tsc -b && vite build` can still run.
// The Vite plugin (src/build/brandAssets.ts) serves/generates the same files
// at dev/build time when possible.
const SOURCE =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

try {
  const { createBrandAssets } = await import("./brandAssets.ts").catch(async () => {
    // Plain-node fallback: strip types via dynamic import is unavailable on
    // older Node runtimes; try compiled helper via tsx-style import first,
    // otherwise skip gracefully.
    return {};
  });
  if (typeof createBrandAssets !== "function") {
    console.warn(
      "[brand] createBrandAssets helper unavailable in this runtime; skipping pre-generation (Vite plugin will try at build time)."
    );
    process.exit(0);
  }
  const files = await createBrandAssets();
  for (const [name, bytes] of files) {
    const target = resolve("public", name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  console.info(`Prepared ${files.size} official AFRICA OF HOPE brand assets.`);
} catch (error) {
  // Check whether usable assets already exist (committed or cached).
  const hasLogo = await exists(resolve("public/logo/aoh-logo.png"));
  const hasFavicon = await exists(resolve("public/favicon.png"));
  if (hasLogo && hasFavicon) {
    console.warn(
      `[brand] Skipped regenerating brand assets (${error instanceof Error ? error.message : String(error)}). Using existing public/ files.`
    );
    process.exit(0);
  }
  console.warn(
    `[brand] Brand asset download unavailable (${error instanceof Error ? error.message : String(error)}). Source: ${SOURCE}. Continuing build with fallback favicon/logo if present.`
  );
  process.exit(0);
}
