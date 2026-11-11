import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import checker from "vite-plugin-checker";
import brandAssets from "./src/build/brandAssets";
import { existsSync } from "node:fs";

import dns from "node:dns";

try {
  dns.setDefaultResultOrder("verbatim");
} catch {
  /* non-fatal on Vercel */
}

// The dala clear-log plugin only exists on internal dev machines. On Vercel
// (and any clean clone) it is absent, so load it optionally instead of
// hard-importing it — a missing dev-only file must never fail production.
let clearLogPlugin: () => { name: string } = () => ({ name: "noop-clear-log" });
try {
  if (existsSync("./dala-internal-vite-clear-log-plugin.js")) {
    const loadOptionalPlugin = new Function("path", "return import(path)") as (path: string) => Promise<unknown>;
    const mod = await loadOptionalPlugin("./dala-internal-vite-clear-log-plugin.js");
    const candidate = (mod as { default?: unknown }).default ?? mod;
    if (typeof candidate === "function") clearLogPlugin = candidate as () => { name: string };
  }
} catch {
  /* keep noop — production build continues */
}

// https://vite.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } },
  plugins: [
    clearLogPlugin(),
    {
      name: "ignore-workspace-env-rewrites",
      configureServer(server) {
        // v0 periodically rewrites this file; restarting Vite for each sync disconnects the preview.
        server.watcher.unwatch(path.resolve(process.cwd(), ".env.development.local"));
      },
    },
    brandAssets(),
    react(),
    tailwindcss(),
    checker({
      typescript: !process.env.VERCEL,
    }),
  ],
  
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 5000, // Increases the limit to 5MB
  },
});
