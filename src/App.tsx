import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";
import { AppProvider, useApp } from "@/context/AppContext";
import { AssistantVisibilityProvider } from "./context/AssistantVisibility";
import { AuthProvider } from "@/auth/AuthProvider";
import type { User } from "./types";
import Navigation from "./components/Navigation";
import { LanguageProvider } from "./lib/locale";
import { useVisiblePortalViews, getPortalView } from "./portalViews";
import PublicMarketingSite from "./components/PublicMarketingSite";
import AuthPortal, { PasswordRecoveryDialog, type AuthTab } from "./components/AuthPortal";
import HopeAssistant from "./components/assistant/HopeAssistant";
import OfflineBanner from "./components/pwa/OfflineBanner";
import UpdatePrompt from "./components/pwa/UpdatePrompt";
import CurrencyConverter from "./components/CurrencyConverter";
import { Button } from "@/components/ui/button";
import { applyPublicBranding } from './lib/publicBranding';
import { consumePendingPushView, resolvePushDestination, takeLaunchPushTarget } from '@/lib/androidPush';
import { initOneSignalClickRouting } from '@/lib/onesignal';
import { initNativeOneSignal } from '@/lib/nativeOneSignal';

function PendingNotice({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { state } = useApp();
  const auth = state.websiteSettings.auth;
  const declined = user.status === "Suspended";
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f6f8f7] p-6">
      <div className="w-full max-w-md rounded-3xl border border-emerald-900/10 bg-white p-8 text-center shadow-sm">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${declined ? "bg-rose-100" : "bg-amber-100"}`}>
          {declined
            ? <AlertTriangle className="h-6 w-6 text-rose-600" />
            : <Clock className="h-6 w-6 text-amber-600" />}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          {declined ? "Application not approved" : (auth.pendingTitle || "Application under review")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {declined
            ? `Hello ${user.name}, your enrolment request was declined. Please contact the registrar for guidance.`
            : (auth.pendingBody
                ? `Hello ${user.name}. ${auth.pendingBody}`
                : `Hello ${user.name}, your registration sits in the administrator approval queue. Portal access unlocks once the registrar approves your file.`)}
        </p>
        <Button variant="outline" className="mt-5" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  );
}

function Portal({ onExitToPublic, initialTab }: { onExitToPublic: () => void; initialTab: AuthTab }) {
  const { currentUser, logout } = useApp();
  const [view, setView] = useState(() => {
    try { return localStorage.getItem("aoh-portal-view") || "dashboard"; }
    catch { return "dashboard"; }
  });
  const { ctx, views } = useVisiblePortalViews();

  // f123 — remember the last portal page across refresh.
  useEffect(() => {
    try { localStorage.setItem("aoh-portal-view", view); } catch { /* optional preference */ }
  }, [view]);

  // Resume a push-tap destination after sign-in (works for PWA + APK wrapper).
  useEffect(() => {
    try {
      const pending = consumePendingPushView();
      if (!pending) return;
      const dest = resolvePushDestination(`/?push_view=${pending}`);
      if (dest.site === "portal" && dest.view) setView(dest.view);
    } catch { /* best-effort */ }
  }, [currentUser?.id]);

  useEffect(() => {
    const resume = () => setView("course-player");
    const pushNav = (e: Event) => {
      try {
        const dest = resolvePushDestination(String((e as CustomEvent<string>).detail ?? "/"));
        if (dest.site === "portal" && dest.view) setView(dest.view);
      } catch { /* ignore malformed push targets */ }
    };
    const helpdesk = (e: Event) => {
      // Direct "Report / Complain to Admin" link stores the requested category
      // so the helpdesk opens with Report preselected (see HelpdeskWorkspace).
      const detail = (e as CustomEvent<string>).detail;
      try {
        if (typeof detail === "string" && detail) sessionStorage.setItem("aoh-helpdesk-initial-category", detail);
        else sessionStorage.removeItem("aoh-helpdesk-initial-category");
      } catch { /* sessionStorage may be unavailable */ }
      setView("helpdesk");
    };
    const appeals = () => setView("grade-appeals");
    const donate = () => setView("donate");
    window.addEventListener("aoh-resume-learning", resume);
    window.addEventListener("aoh-push-navigate", pushNav);
    window.addEventListener("aoh-open-helpdesk", helpdesk);
    window.addEventListener("aoh-open-appeals", appeals);
    window.addEventListener("aoh-open-donate", donate);
    return () => {
      window.removeEventListener("aoh-resume-learning", resume);
      window.removeEventListener("aoh-push-navigate", pushNav);
      window.removeEventListener("aoh-open-helpdesk", helpdesk);
      window.removeEventListener("aoh-open-appeals", appeals);
      window.removeEventListener("aoh-open-donate", donate);
    };
  }, []);

  if (!currentUser) return <AuthPortal onBackToSite={onExitToPublic} initialTab={initialTab} />;
  if (currentUser.role === "Student" && currentUser.status !== "Active") {
    return <PendingNotice user={currentUser} onSignOut={logout} />;
  }

  // Fall back to "dashboard" once the current view is no longer visible
  // (role switch, a permission revoked under the user, etc.).
  const activeKey = views.some((v) => v.key === view) ? view : "dashboard";
  const activeView = getPortalView(activeKey);

  return (
    <Navigation view={activeKey} onNavigate={setView} onExitToPublic={onExitToPublic}>
      <div key={currentUser.id}>{activeView?.render(ctx)}</div>
    </Navigation>
  );
}

function Shell() {
  const { state } = useApp();
  const [site, setSite] = useState<"public" | "portal">(() => {
    try { return localStorage.getItem("aoh-site") === "portal" ? "portal" : "public"; }
    catch { return "public"; }
  });
  const [authTab, setAuthTab] = useState<AuthTab>("signin");

  useEffect(() => {
    try { localStorage.setItem("aoh-site", site); } catch { /* optional preference */ }
  }, [site]);

  // Apply the CMS-configured academy name / favicon at runtime so a change
  // published from the CMS shows up without a rebuild. Only drives
  // `document.title` while the portal is active — PublicMarketingSite owns
  // the title on every public view (Home/Programmes/Blog/post), and this
  // effect would otherwise race it (both run on mount/update) and clobber
  // the per-view title back to the bare academy name.
  useEffect(() => {
    const w = state.websiteSettings;
    if (site === "portal") {
      const name = w.academyName || state.settings.academyName;
      if (name) document.title = name;
    }
  }, [state.websiteSettings, state.settings.academyName, site]);

  // Launch deep-link (?push_view=) from a lock-screen tap + foreground click
  // routing registration. Shared by installed PWA and APK wrapper (TWA/WebView
  // open the same URL, so both land here identically).
  useEffect(() => {
    // Native APK wrapper (Capacitor/Cordova shell): the Android SDK owns push.
    // Browser PWA: the Web SDK owns push. The two never double-init.
    try { void initNativeOneSignal().catch(() => undefined); } catch { /* best-effort */ }
    initOneSignalClickRouting();
    try {
      const target = takeLaunchPushTarget();
      if (!target) return;
      const dest = resolvePushDestination(`/?push_view=${target.view}`);
      if (dest.site === "portal" && dest.view) {
        try { sessionStorage.setItem("aoh-push-pending", JSON.stringify({ url: target, at: Date.now() })); } catch { /* ignore */ }
        setSite("portal");
      }
    } catch { /* best-effort */ }
  }, []);

  // Applies the Admin > System Settings > Appearance theme as CSS variables
  // and data attributes read by src/index.css, so a saved theme takes effect
  // immediately without a rebuild.
  useEffect(() => {
    const theme = state.themeSettings;
    const root = document.documentElement;
    root.style.setProperty("--portal-primary", theme.primaryColor);
    root.style.setProperty("--portal-accent", theme.accentColor);
    root.style.setProperty(
      "--portal-radius",
      theme.borderRadius === "sharp" ? "0.25rem" : theme.borderRadius === "pill" ? "9999px" : "0.75rem",
    );
    root.dataset.portalFont = theme.fontFamily;
    root.dataset.portalAlign = theme.contentAlignment;
    root.dataset.portalIcons = theme.iconStyle;

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const applyMode = () => {
      const dark = theme.mode === "dark" || (theme.mode === "system" && prefersDark.matches);
      root.classList.toggle("dark", dark);
    };
    applyMode();
    if (theme.mode === "system") {
      prefersDark.addEventListener("change", applyMode);
      return () => prefersDark.removeEventListener("change", applyMode);
    }
  }, [state.themeSettings]);

  return (
    <>
      {site === "public" ? (
        <PublicMarketingSite
          onEnterPortal={(tab?: AuthTab) => {
            setAuthTab(tab ?? "signin");
            setSite("portal");
          }}
        />
      ) : (
        <Portal onExitToPublic={() => setSite("public")} initialTab={authTab} />
      )}
      <CurrencyConverter />
      <PasswordRecoveryDialog />
      <HopeAssistant />
      <OfflineBanner />
      <UpdatePrompt />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <LanguageProvider>
          <Toaster position="top-right" richColors closeButton />
          <AssistantVisibilityProvider>
            <Shell />
          </AssistantVisibilityProvider>
        </LanguageProvider>
      </AppProvider>
    </AuthProvider>
  );
}
