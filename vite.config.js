import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});