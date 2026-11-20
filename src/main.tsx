import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { dismissSplash, registerServiceWorker } from "./lib/pwa";
import { restorePublicLaunch } from './lib/publicBranding';
restorePublicLaunch();
registerServiceWorker();

// Supabase finishes confirmation, recovery and magic-link sign-ins itself:
// `detectSessionInUrl` on the client in src/integrations/supabase/client.ts
// reads the returned token and raises SIGNED_IN / PASSWORD_RECOVERY.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// The branded splash lives in index.html so it paints before the bundle loads.
// Fade it out once React has committed the first screen.
requestAnimationFrame(() => {
  window.setTimeout(dismissSplash, 150);
});