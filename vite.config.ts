import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import checker from "vite-plugin-checker";
// @ts-expect-error - No type declarations for custom plugin
import clearLogPlugin from "./dala-internal-vite-clear-log-plugin.js";

import dns from "node:dns";
import fs from "node:fs";

dns.setDefaultResultOrder("verbatim");

{
  const url = "https://gatnzfjpuokopqyksqoy.supabase.co/functions/v1/assistant";
  const anon =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhdG56ZmpwdW9rb3BxeWtzcW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjAyMTcsImV4cCI6MjEwNzgzNjIxN30.g0tptBFvclxGhqePFrWz0nov3R_DRsOgnSQJpKjdDT8";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  console.error("ASSISTANT_PROBE start");
  fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Hello, who are you?" }],
      surface: "public",
    }),
  })
    .then(async (resp) => {
      const text = await resp.text();
      const safe = text.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]").slice(0, 800);
      console.error(`ASSISTANT_PROBE status=${resp.status} type=${resp.headers.get("content-type")} body=${safe}`);
    })
    .catch((err) => {
      console.error(`ASSISTANT_PROBE failed ${err instanceof Error ? err.name + ": " + err.message : "unknown"}`);
    })
    .finally(() => clearTimeout(timer));
}

// https://vite.dev/config/
export default defineConfig({ server: { host: true, allowedHosts: true, hmr: { clientPort: 443, protocol: 'wss' }, headers: { 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' } },
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
