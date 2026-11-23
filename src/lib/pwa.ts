import { useCallback, useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "aoh-pwa-installed";
const DISMISSED_KEY = "aoh-pwa-dismissed-at";

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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

type UpdateState = { hasUpdate: boolean; busy: boolean; error: string; notice: string };
let waitingWorker: ServiceWorker | null = null;
let registrationStarted = false;
let reloadRequested = false;
let reloaded = false;
let activationTimer: number | undefined;
let updateState: UpdateState = { hasUpdate: false, busy: false, error: "", notice: "" };
const updateListeners = new Set<(state: UpdateState) => void>();

function publishUpdate(patch: Partial<UpdateState>) {
  updateState = { ...updateState, ...patch };
  updateListeners.forEach(listener => listener(updateState));
}
function requestReloadOnce() {
  if (reloaded) return;
  reloaded = true;
  window.clearTimeout(activationTimer);
  window.location.reload();
}

export async function checkForAppUpdate() {
  publishUpdate({ error: "", notice: "Checking for updates…" });
  try {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) throw new Error("App updates require HTTPS and a browser with service worker support.");
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) throw new Error("The app worker is not ready. Reload this page online and try again.");
    await registration.update();
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      publishUpdate({ hasUpdate: true, notice: "An update is ready to install." });
    } else {
      publishUpdate({ notice: registration.installing ? "An update is downloading. You will be notified when it is ready." : "No waiting update found." });
    }
  } catch (error) {
    publishUpdate({ error: error instanceof Error ? error.message : "Could not check for updates. Try again online.", notice: "" });
  }
}

/** Only reload after activation and only following an explicit click in this tab. */
export async function applyServiceWorkerUpdate() {
  if (updateState.busy) return;
  publishUpdate({ busy: true, error: "", notice: "" });
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const worker = registration?.waiting ?? (waitingWorker?.state === "installed" ? waitingWorker : null);
    if (!worker) throw new Error("The waiting update is no longer available. Check for updates again.");
    reloadRequested = true;
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated" && reloadRequested) requestReloadOnce();
    });
    worker.postMessage({ type: "SKIP_WAITING" });
    activationTimer = window.setTimeout(() => {
      if (worker.state === "activated") requestReloadOnce();
      else {
        reloadRequested = false;
        publishUpdate({ busy: false, error: "Activation timed out. Your work has not been reloaded. Try again online." });
      }
    }, 12000);
  } catch (error) {
    reloadRequested = false;
    publishUpdate({ busy: false, error: error instanceof Error ? error.message : "Update failed. Try again." });
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext || registrationStarted) return;
  registrationStarted = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadRequested) requestReloadOnce();
  });
  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const flag = (worker: ServiceWorker | null) => {
        if (!worker) return;
        waitingWorker = worker;
        publishUpdate({ hasUpdate: true, error: "", notice: "An update is ready to install." });
      };
      if (registration.waiting) flag(registration.waiting);
      const watch = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) flag(registration.waiting ?? worker);
        });
      };
      watch();
      registration.addEventListener("updatefound", watch);
      const check = () => { if (navigator.onLine) void registration.update().catch(() => undefined); };
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      window.addEventListener("online", check);
      window.setInterval(() => { if (document.visibilityState === "visible") check(); }, 60 * 60 * 1000);
      check();
    } catch (error) {
      publishUpdate({ error: error instanceof Error ? error.message : "App worker registration failed." });
    }
  };
  if (document.readyState === "complete") void start();
  else window.addEventListener("load", () => void start(), { once: true });
}

export function useServiceWorkerUpdate() {
  const [state, setState] = useState(updateState);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    updateListeners.add(setState);
    setState(updateState);
    return () => { updateListeners.delete(setState); };
  }, []);
  return {
    ...state,
    hasUpdate: state.hasUpdate && !dismissed,
    updateReady: state.hasUpdate,
    applyUpdate: applyServiceWorkerUpdate,
    checkUpdate: () => { setDismissed(false); void checkForAppUpdate(); },
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