import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { ensureSnapshot, snapshotRoot } from "./scripts/recovery-snapshot.mjs";

const files = ensureSnapshot();
const entry = "\0aoh-recovery-entry";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml"
};

function serveSnapshot(request, response, next) {
  if (!["GET", "HEAD"].includes(request.method)) return next();
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.statusCode = 400;
    response.end("Invalid request path");
    return;
  }
  if (pathname.startsWith("/api/")) return next();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment === ".." || segment.startsWith(".") && segment !== ".well-known")) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  let target = path.resolve(snapshotRoot, `.${pathname}`);
  if (!target.startsWith(`${snapshotRoot}${path.sep}`) && target !== snapshotRoot) return next();
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    if (path.extname(pathname) || !request.headers.accept?.includes("text/html")) return next();
    target = path.join(snapshotRoot, "index.html");
  }
  response.setHeader("Content-Type", mimeTypes[path.extname(target)] || "application/octet-stream");
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = fs.createReadStream(target);
  stream.on("error", (error) => response.destroy(error));
  stream.pipe(response);
}

export default defineConfig({
  publicDir: false,
  server: {
    host: "0.0.0.0",
    allowedHosts: true
  },
  plugins: [
    {
      name: "preserve-compiled-aoh",
      configureServer(server) {
        server.middlewares.use(serveSnapshot);
      },
      resolveId(id) {
        return id === "aoh-recovery-entry" ? entry : null;
      },
      load(id) {
        return id === entry ? "export {};" : null;
      },
      generateBundle() {
        files.forEach((absolute) => {
          this.emitFile({
            type: "asset",
            fileName: path.relative(snapshotRoot, absolute).split(path.sep).join("/"),
            source: fs.readFileSync(absolute)
          });
        });
      }
    }
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: "aoh-recovery-entry"
    }
  }
});