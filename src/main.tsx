import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProvider } from "./context/AppContext";
import { dismissSplash, registerServiceWorker } from "./lib/pwa";
import { restorePublicLaunch } from './lib/publicBranding';

restorePublicLaunch();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

// The branded splash lives in index.html so it paints before the bundle loads.
// Fade it out once React has committed the first screen.
requestAnimationFrame(() => {
  window.setTimeout(dismissSplash, 150);
});
