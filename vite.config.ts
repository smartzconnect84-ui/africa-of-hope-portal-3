import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import checker from "vite-plugin-checker";
// @ts-expect-error - No type declarations for custom plugin
import clearLogPlugin from "./dala-internal-vite-clear-log-plugin.js";

import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

// Optional dev proxy for a local Supabase stack (e.g. `supabase start`). Set
// SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 and VITE_SUPABASE_URL=/supabase-api.
const supabaseProxyTarget = process.env.SUPABASE_PROXY_TARGET;
const proxy = supabaseProxyTarget
  ? {
      "/supabase-api": {
        target: supabaseProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (p: string) => p.replace(/^\/supabase-api/, ""),
      },
    }
  : undefined;

// https://vite.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, proxy, hmr: { clientPort: 443, protocol: 'wss' }, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } },
  plugins: [
    clearLogPlugin(),
    react(),
    tailwindcss(),
    checker({
      typescript: true,
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
