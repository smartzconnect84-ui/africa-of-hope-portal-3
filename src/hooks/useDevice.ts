import * as React from "react";

export type DeviceKind = "mobile" | "tablet" | "desktop";

/**
 * Device layout hook for the public landing experience.
 * Pure layout signal — it never reads or rewrites copy, CMS data or routes.
 *
 * Breakpoints follow Tailwind defaults so classNames and JS stay in sync:
 * - mobile:  < 768px  (base + sm phones, large phones)
 * - tablet:  768–1023px (md, portrait tablets / landscape phones)
 * - desktop: >= 1024px (lg+, laptops / desktops)
 */
export function useDevice(): {
  device: DeviceKind;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number | undefined;
} {
  const [width, setWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const device: DeviceKind =
    width === undefined ? "desktop" : width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";

  return {
    device,
    isMobile: device === "mobile",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    width,
  };
}

/** CSS-only device flags mirrored on <html> by DeviceLayoutScript (no JS needed per page). */
export const DEVICE_BREAKPOINTS = { mobileMax: 767, tabletMin: 768, tabletMax: 1023, desktopMin: 1024 } as const;
