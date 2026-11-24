const PREFS = ["compactSidebar", "reduceMotion", "largeText", "highContrast"] as const;

export type DevicePref = (typeof PREFS)[number];

const CLASS_MAP: Record<DevicePref, string> = {
  compactSidebar: "aoh-device-compact-sidebar",
  reduceMotion: "aoh-device-reduce-motion",
  largeText: "aoh-device-large-text",
  highContrast: "aoh-device-high-contrast",
};

export function readDevicePref(key: DevicePref): boolean {
  try {
    return localStorage.getItem(`aoh-device:${key}`) === "1";
  } catch {
    return false;
  }
}

export function applyDevicePreferences(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of PREFS) {
    const cls = CLASS_MAP[key];
    if (readDevicePref(key)) root.classList.add(cls);
    else root.classList.remove(cls);
  }
}

export function setDevicePref(key: DevicePref, value: boolean): void {
  try {
    localStorage.setItem(`aoh-device:${key}`, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  applyDevicePreferences();
}