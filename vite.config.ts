import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import checker from "vite-plugin-checker";
import brandAssets from "./src/build/brandAssets";

import dns from "node:dns";

try {
  dns.setDefaultResultOrder("verbatim");
} catch {
  /* non-fatal on Vercel */
}

// Strip dotfile directories (like .well-known) from dist after every build.
// Vite copies everything from public/ into dist/, including hidden dirs.
// Freebuff Sites rejects hidden files in the assets upload, so we remove them
// at the end of every build so the output is clean regardless of which script
// runs it. The build:sites script also strips dist/_redirects separately.
function stripDotfileDirs() {
  return {
    name: "exclude-dotfiles",
    enforce: "post",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      if (!fs.existsSync(dist)) return;
      for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
        if (
        (entry.isDirectory() && entry.name.startsWith(".")) ||
        entry.name === "_redirects"
      ) {
        const target = path.join(dist, entry.name);
        fs.rmSync(target, { recursive: true, force: true });
      }
      }
      // Remove crossorigin from module scripts in index.html so same-origin
      // module scripts are not blocked by missing CORS headers on the edge.
      const indexHtml = path.join(dist, "index.html");
      if (fs.existsSync(indexHtml)) {
        let html = fs.readFileSync(indexHtml, "utf-8");
        html = html.replace(/<script type="module" crossorigin src=/g, '<script type="module" src=');
        fs.writeFileSync(indexHtml, html);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, hmr: { clientPort: 443, protocol: 'wss' }, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } },
  plugins: [
    brandAssets(),
    react(),
    tailwindcss(),
    checker({
      typescript: !process.env.VERCEL,
    }),
    stripDotfileDirs(),
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
    sourcemap: false,
    minify: "esbuild",
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: ["framer-motion", "lucide-react"],
          data: ["@tanstack/react-query", "@supabase/supabase-js"],
        },
      },
    },
  },
});
