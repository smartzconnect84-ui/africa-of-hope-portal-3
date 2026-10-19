import { useCallback, useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "aoh-pwa-installed";
const DISMISSED_KEY = "aoh-pwa-dismissed-at";

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/* ------------------------------------------------------------------ install */

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    try {
      return localStorage.getItem(INSTALLED_KEY) === "1" || isStandalone();
    } catch {
      return isStandalone();
    }
  });
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* private mode */
      }
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    if (isStandalone()) onInstalled();
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const resetDismiss = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    canInstall: !!deferred && !installed,
    isIos: isIos(),
    installed,
    dismissed,
    install,
    dismiss,
    resetDismiss,
  };
}

/* ------------------------------------------------------- service worker core */

type UpdateListener = (hasUpdate: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
let reloadWhenActivated = false;
const updateListeners = new Set<UpdateListener>();

function notifyUpdate(hasUpdate: boolean) {
  updateListeners.forEach((listener) => listener(hasUpdate));
}

function requestReloadOnce() {
  if (reloadWhenActivated) return;
  reloadWhenActivated = true;
  window.location.reload();
}

/** Activates the waiting worker so the next load serves the new build. */
export function applyServiceWorkerUpdate() {
  const worker =
    waitingWorker ??
    null;
  if (!worker) {
    requestReloadOnce();
    return;
  }
  reloadWhenActivated = true;
  worker.postMessage({ type: "SKIP_WAITING" });
  // Safety net: if the browser never fires `controllerchange`, reload anyway.
  window.setTimeout(() => {
    if (reloadWhenActivated) requestReloadOnce();
  }, 4000);
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Only register on http(s) — avoids noise in sandboxed previews.
  if (!/^https?:$/.test(window.location.protocol)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadWhenActivated) requestReloadOnce();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const flag = (worker: ServiceWorker | null) => {
          if (!worker) return;
          waitingWorker = worker;
          notifyUpdate(true);
        };

        // An update may already be waiting from a previous visit.
        if (registration.waiting && navigator.serviceWorker.controller) flag(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              flag(installing);
            }
          });
        });

        // Look for a new deploy when the user returns to the tab. The browser
        // throttles this compare itself, so it is cheap.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => undefined);
          }
        });
      })
      .catch(() => undefined);
  });
}

export function useServiceWorkerUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const listener: UpdateListener = (value) => setHasUpdate(value);
    updateListeners.add(listener);
    if (waitingWorker) setHasUpdate(true);
    return () => {
      updateListeners.delete(listener);
    };
  }, []);

  return {
    hasUpdate: hasUpdate && !dismissed,
    applyUpdate: applyServiceWorkerUpdate,
    dismissUpdate: () => setDismissed(true),
  };
}

/* ------------------------------------------------------------ connectivity */

export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const goOnline = () => {
      setOnline(true);
      setRestored(true);
      timer = window.setTimeout(() => setRestored(false), 4500);
    };
    const goOffline = () => {
      setRestored(false);
      setOnline(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return { online, restored };
}

/* ---------------------------------------------------------------- splash */

/** Fades out the branded launch splash once React has mounted. */
export function dismissSplash() {
  if (typeof document === "undefined") return;
  const splash = document.getElementById("aoh-splash");
  if (!splash) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const remove = () => splash.remove();
  if (reduce) {
    remove();
    return;
  }
  splash.setAttribute("data-hidden", "true");
  window.setTimeout(remove, 420);
}