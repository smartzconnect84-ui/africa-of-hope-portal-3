import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import checker from "vite-plugin-checker";
import brandAssets from "./src/build/brandAssets";

import dns from "node:dns";

try {
  dns.setDefaultResultOrder("verbatim");
} catch {
  /* non-fatal on Vercel */
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
