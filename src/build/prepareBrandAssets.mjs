import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createBrandAssets } from "./brandAssets.ts";

// Generate before starting Vite as well as on build: static files remain
// available even in hosts that wrap/replace the development Vite config.
const files = await createBrandAssets();
for (const [name, bytes] of files) {
  const target = resolve("public", name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
console.info(`Prepared ${files.size} official AFRICA OF HOPE brand assets.`);
