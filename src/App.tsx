import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";
import { AppProvider, useApp } from "./context/AppContext";
import { AssistantVisibilityProvider } from "./context/AssistantVisibility";
import { AuthProvider } from "@/auth/AuthProvider";
import type { User } from "./types";
import Navigation from "./components/Navigation";
import { useVisiblePortalViews, getPortalView } from "./portalViews";
import PublicMarketingSite from "./components/PublicMarketingSite";
import AuthPortal, { PasswordRecoveryDialog, type AuthTab } from "./components/AuthPortal";
import HopeAssistant from "./components/assistant/HopeAssistant";
import { Button } from "@/components/ui/button";

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
  const [view, setView] = useState("dashboard");
  const { ctx, views } = useVisiblePortalViews();

  useEffect(() => {
    setView("dashboard");
  }, [currentUser?.id]);

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
      {activeView?.render(ctx)}
    </Navigation>
  );
}

function Shell() {
  const { state } = useApp();
  const [site, setSite] = useState<"public" | "portal">("public");
  const [authTab, setAuthTab] = useState<AuthTab>("signin");

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
    if (w.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = w.faviconUrl;
    }
  }, [state.websiteSettings, state.settings.academyName, site]);

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
      <PasswordRecoveryDialog />
      <HopeAssistant />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Toaster position="top-right" richColors closeButton />
        <AssistantVisibilityProvider>
          <Shell />
        </AssistantVisibilityProvider>
      </AppProvider>
    </AuthProvider>
  );
}