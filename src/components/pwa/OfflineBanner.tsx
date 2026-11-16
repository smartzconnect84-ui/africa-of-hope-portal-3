import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/pwa";

/**
 * Honest connectivity notice: what still works offline and what genuinely
 * needs the network. It never claims a submission or payment went through.
 */
export default function OfflineBanner() {
  const { online, restored } = useOnlineStatus();
  if (online && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[80] px-3 pt-[env(safe-area-inset-top)]"
    >
      <div
        className={`mx-auto mt-2 flex max-w-2xl items-start gap-2.5 rounded-2xl border-4 px-3.5 py-2.5 shadow-lg ${
          online
            ? "border-[#D4AF37] bg-[#16803C] text-white"
            : "border-[#D4AF37] bg-black text-white"
        }`}
      >
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#D4AF37]">
          {online ? (
            <Wifi className="h-4 w-4 text-black" aria-hidden="true" />
          ) : (
            <WifiOff className="h-4 w-4 text-black" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em]">
            {online ? "Back online" : "You are offline"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-white/85">
            {online
              ? "Everything is connected again. Submit anything that was waiting."
              : "Cached pages still open. Sign-in, applications, payments and portal data need internet — nothing is saved to the server until you reconnect."}
          </p>
        </div>
      </div>
    </div>
  );
}