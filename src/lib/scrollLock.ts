/**
 * One shared, reference-counted page-scroll lock.
 *
 * Each overlay (public menu, portal drawer, image lightbox) used to save and
 * restore `document.body/html.style.overflow` on its own. When two overlays
 * overlapped — or one closed after another had already opened — the saved
 * value was itself "hidden", so the whole page stayed locked after everything
 * closed. A single counter releases the lock exactly once, when the last
 * overlay closes, and puts back the exact styles and scroll position it found.
 *
 * iOS Safari ignores `overflow: hidden` on <body>, so the body is pinned with
 * `position: fixed` there; the previous scroll offset is restored on release.
 */

type SavedStyles = {
  bodyOverflow: string;
  rootOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  scrollY: number;
};

let lockCount = 0;
let saved: SavedStyles | null = null;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Locks page scrolling and returns the matching release function. */
export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  const body = document.body;
  const root = document.documentElement;

  if (lockCount === 0) {
    saved = {
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      scrollY: window.scrollY,
    };
    if (isIOS()) {
      body.style.position = "fixed";
      body.style.top = `-${saved.scrollY}px`;
      body.style.width = "100%";
    }
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
  }

  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0 || !saved) return;

    const restore = saved;
    saved = null;
    body.style.overflow = restore.bodyOverflow;
    root.style.overflow = restore.rootOverflow;
    body.style.position = restore.bodyPosition;
    body.style.top = restore.bodyTop;
    body.style.width = restore.bodyWidth;
    if (window.scrollY !== restore.scrollY) window.scrollTo(0, restore.scrollY);
  };
}
