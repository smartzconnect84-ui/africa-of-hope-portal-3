import { useEffect, useRef, useState } from "react";
import { NotificationIconButton, NotificationFeedPopover } from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";
import { isKnockConfigured } from "@/lib/knock";

export default function KnockNotificationBell() {
  const [isVisible, setIsVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!isKnockConfigured()) return null;

  return (
    <>
      <NotificationIconButton
        ref={buttonRef}
        onClick={() => setIsVisible((v) => !v)}
      />
      <NotificationFeedPopover
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        buttonRef={buttonRef}
      />
    </>
  );
}
