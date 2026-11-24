/**
 * Stamps a per-build id into dist/sw.js so every deploy installs a *new*
 * service worker. Without it the deployed sw.js is byte-identical release
 * after release, the browser never finds a waiting worker, and the in-app
 * "Feature update" prompt can never appear.
 *
 * Runs last in `npm run build`, after `vite build` and the prerender step, so
 * the hash covers the exact shell that ships. A rebuild with no code change
 * keeps the same id (correctly: there is nothing new to install).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const swFile = join(dist, "sw.js");
const indexFile = join(dist, "index.html");

if (!existsSync(swFile) || !existsSync(indexFile)) {
  console.log("[sw-stamp] dist/sw.js not found — skipping (dev mode?)");
  process.exit(0);
}

const hash = createHash("sha256");
/** Hash a folder tree by relative path + contents, in a stable order. */
function hashTree(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) hashTree(path);
    else {
      hash.update(relative(dist, path));
      hash.update(readFileSync(path));
    }
  }
}

// index.html carries the hashed asset names, so any real change alters this.
hash.update("index.html");
hash.update(readFileSync(indexFile));
hashTree(join(dist, "assets"));

const buildId = hash.digest("hex").slice(0, 12);
const source = readFileSync(swFile, "utf8");
const pattern = /const VERSION = "[^"]*";/;

if (!pattern.test(source)) {
  console.error("[sw-stamp] Could not find `const VERSION = \"…\";` in dist/sw.js — refusing to ship an unstampable worker.");
  process.exit(1);
}

writeFileSync(swFile, source.replace(pattern, `const VERSION = "build-${buildId}";`));
console.log(`[sw-stamp] dist/sw.js VERSION = build-${buildId}`);
