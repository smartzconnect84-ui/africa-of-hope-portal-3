// AFRICA OF HOPE — Cloudflare Worker entry for Freebuff Sites.
// The app is a prerendered Vite SPA, so the Worker only forwards to the static
// asset binding. Client-side routes fall back to index.html (manifest `spa`).
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
