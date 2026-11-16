import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, X } from "lucide-react";

export const PUBLIC_PAGE_IMAGE_PAGES = [
  { key: "about", label: "About page header" },
  { key: "programmes", label: "Programmes page header" },
  { key: "term-dates", label: "Term dates page header" },
  { key: "team", label: "Team page header" },
  { key: "blog", label: "Blog page header" },
  { key: "policies", label: "Policies page header" },
  { key: "transparency", label: "Transparency page header" },
  { key: "donate", label: "Donate page header" },
  { key: "verify", label: "Verify page header" },
  { key: "admissions", label: "Admissions section header" },
  { key: "support", label: "Support section header" },
  { key: "contact", label: "Contact section header" },
] as const;

export type PublicPageImageKey = (typeof PUBLIC_PAGE_IMAGE_PAGES)[number]["key"];

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevBody = document.body.style.overflow;
    const prevRoot = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevRoot;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4"
      onClick={onClose}
    >
      <span id={titleId} className="sr-only">
        Enlarged view: {alt || "uploaded image"}
      </span>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close enlarged image"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img
        src={src}
        alt={alt || "Enlarged uploaded image"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86dvh] max-w-[92vw] rounded-2xl bg-white object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}

/**
 * Every uploaded public image renders through this button so a tap/click
 * opens a full-size view. Keyboard users get a real button with a label.
 */
export default function ExpandableImage({
  src,
  alt,
  className,
  imgClassName,
  eager,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  if (!src) return null;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View larger image: ${alt || "uploaded photo"}`}
        title="Click to view larger"
        className={`group relative block w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${className ?? ""}`}
      >
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={imgClassName ?? "aoh-photo h-full w-full object-cover object-center"}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Expand className="h-3.5 w-3.5" /> View
        </span>
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={close} />}
    </>
  );
}

/** Optional CMS-managed banner shown at the top of a public page. Click-to-view enabled. */
export function PageHeroImage({ src, alt }: { src?: string; alt: string }) {
  if (!src?.trim()) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <ExpandableImage
        src={src}
        alt={alt}
        className="rounded-2xl ring-1 ring-emerald-900/10"
        imgClassName="aoh-photo h-52 w-full rounded-2xl object-cover object-center sm:h-72"
      />
    </div>
  );
}
