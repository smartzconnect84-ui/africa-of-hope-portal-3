import { RefreshCw, X } from "lucide-react";
import { useServiceWorkerUpdate } from "@/lib/pwa";

/**
 * Unobtrusive "new version available" notice. The waiting service worker is
 * only activated when the visitor asks for it, so an exam or a half-filled
 * application form is never reloaded underneath them.
 */
export default function UpdatePrompt() {
  const { hasUpdate, busy, error, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();
  if (!hasUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[78] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border-4 border-[#D4AF37] bg-white p-3.5 shadow-2xl"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#16803C]">
          <RefreshCw className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-black">Update available</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            A newer version of the AFRICA OF HOPE app is ready. Refresh when you are not in the
            middle of a form.
          </p>
          {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          <button
            type="button"
            onClick={() => void applyUpdate()}
            disabled={busy}
            className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#16803C] px-4 text-sm font-semibold text-white transition hover:bg-[#12692f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16803C]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {busy ? "Updating…" : "Refresh now"}
          </button>
        </div>
        <button
          type="button"
          onClick={dismissUpdate}
          disabled={busy}
          aria-label="Dismiss update notice"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-black"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}