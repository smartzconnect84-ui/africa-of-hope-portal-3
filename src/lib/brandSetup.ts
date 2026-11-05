import type { WebsiteSettings } from "@/types";
import { FOUNDER_PROFILE } from "@/data/teamContent";
import { uploadSiteAsset } from "./storage";

/**
 * Built-in production assets. These ship with the site bundle (generated from
 * the official logo at build time) so the header, footer, portal, sign-in,
 * certificates and favicon keep working even when Supabase storage cannot be
 * reached. This is the "frontend copy" admins can fall back to.
 */
export const BUILT_IN_LOGO = "/logo/aoh-logo.png";
export const BUILT_IN_FAVICON = "/favicon.png";
/** Permanent owner-supplied founder portrait (survives Supabase disconnects). */
export const BUILT_IN_PORTRAIT =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/1owwaae5m6/WhatsApp_Image_2026-04-04_at_1.19.06_AM.jpeg";

export type BrandPlacement = "header" | "footer" | "portal" | "auth" | "certificate" | "brochure";
export const BRAND_PLACEMENTS: BrandPlacement[] = ["header", "footer", "portal", "auth", "certificate", "brochure"];

export interface BrandCopyResult {
  logoUrl: string;
  faviconUrl: string;
  logos: NonNullable<WebsiteSettings["logos"]>;
  portraitUrl: string;
  /** True when Supabase storage could not be reached at all. Draft still updated with built-in URLs so nothing is lost. */
  storageUnreachable: boolean;
  /** Per-asset notes for the admin, shown as one toast / review line. */
  warnings: string[];
}

function friendlyLoadError(name: string, status?: number): Error {
  return new Error(
    status
      ? `Could not load ${name} (response ${status}). Check your connection and try again. No settings have been published.`
      : `Could not load ${name}. Check your connection and try again. No settings have been published.`
  );
}

function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|fetch|load failed|cors|timed out|timeout|abort/i.test(message);
}

async function imageFile(url: string, name: string, type: string): Promise<File> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch {
    throw friendlyLoadError(name);
  }
  if (!response.ok) throw friendlyLoadError(name, response.status);
  const blob = await response.blob();
  return new File([blob], name, { type: type || blob.type || "application/octet-stream" });
}

function friendlyStorageError(action: string, error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  if (/bucket not found|row-level security|42501|permission denied/i.test(raw)) {
    return new Error(
      `${action}: file storage is not set up yet. Ask an administrator to apply the latest database migration. Nothing has been published.`
    );
  }
  if (isOfflineError(error) || isOfflineError(raw)) {
    return new Error(
      `${action}: the storage service could not be reached. Check your connection and that Supabase is linked, then try again. Nothing has been published.`
    );
  }
  return new Error(`${action}: ${raw || "upload failed"}. Nothing has been published.`);
}

/**
 * Instant, offline-safe fallback: point every placement at the built-in
 * frontend assets. No network, no Supabase. Use when Supabase is disconnected
 * so logos never disappear from the public site.
 */
export function builtInBrandAssets(): {
  logoUrl: string;
  faviconUrl: string;
  logos: NonNullable<WebsiteSettings["logos"]>;
  portraitUrl: string;
} {
  const logos: NonNullable<WebsiteSettings["logos"]> = {};
  for (const placement of BRAND_PLACEMENTS) logos[placement] = BUILT_IN_LOGO;
  return { logoUrl: BUILT_IN_LOGO, faviconUrl: BUILT_IN_FAVICON, logos, portraitUrl: FOUNDER_PROFILE.image || BUILT_IN_PORTRAIT };
}

/**
 * Explicit administrator action: copy owner-provided assets into Supabase
 * storage. New UUID paths only; no old files or settings are deleted.
 *
 * Resilient by design:
 * - Each upload is attempted independently; one failure no longer aborts the rest.
 * - The founder portrait (a cross-origin URL) is never fatal: if the browser
 *   blocks the download (CORS/offline), the existing portrait URL is kept.
 * - If storage itself is unreachable, built-in frontend URLs are returned so the
 *   draft preview keeps working and no logos are lost.
 */
export async function copySuppliedBrandAssets(): Promise<BrandCopyResult> {
  const warnings: string[] = [];

  // Load each source independently: one missing local file must never abort
  // the whole copy with a raw network error. If a built-in file cannot be
  // read, we keep the built-in URL for those slots and report it plainly.
  let logoFile: File | null = null;
  let faviconFile: File | null = null;
  try {
    logoFile = await imageFile(BUILT_IN_LOGO, "official logo", "image/png");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Could not load official logo. Kept the built-in image.");
  }
  try {
    faviconFile = await imageFile(BUILT_IN_FAVICON, "favicon", "image/png");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Could not load favicon. Kept the built-in image.");
  }

  // Portrait is cross-origin; browsers may block fetch (CORS). That must never
  // surface as a raw "Failed to fetch" — keep the existing URL instead.
  let portraitFile: File | null = null;
  try {
    portraitFile = await imageFile(FOUNDER_PROFILE.image, "founder portrait", "image/jpeg");
  } catch {
    warnings.push("Founder portrait could not be re-downloaded in this browser, so the existing portrait link was kept.");
  }

  const logos: NonNullable<WebsiteSettings["logos"]> = {};
  let logoUrl = BUILT_IN_LOGO;
  let faviconUrl = BUILT_IN_FAVICON;
  let portraitUrl = FOUNDER_PROFILE.image || BUILT_IN_PORTRAIT;
  let storageOk = false;
  let storageFailed = false;

  const tryUpload = async (label: string, folder: string, file: File): Promise<string | null> => {
    try {
      const url = await uploadSiteAsset(folder, file);
      storageOk = true;
      return url;
    } catch (error) {
      storageFailed = true;
      warnings.push(friendlyStorageError(label, error).message.replace(/\. Nothing has been published\.$/, ". Kept the built-in image for this slot."));
      return null;
    }
  };

  const defaultLogo = logoFile ? await tryUpload("Default logo", "logo", logoFile) : null;
  if (defaultLogo) logoUrl = defaultLogo;
  for (const placement of BRAND_PLACEMENTS) {
    const url = logoFile ? await tryUpload(`Logo (${placement})`, `logos/${placement}`, logoFile) : null;
    logos[placement] = url ?? BUILT_IN_LOGO;
  }
  const favicon = faviconFile ? await tryUpload("Favicon", "favicon", faviconFile) : null;
  if (favicon) faviconUrl = favicon;
  if (portraitFile) {
    const portrait = await tryUpload("Founder portrait", "team", portraitFile);
    if (portrait) portraitUrl = portrait;
  }

  return {
    logoUrl,
    faviconUrl,
    logos,
    portraitUrl,
    storageUnreachable: !storageOk && storageFailed,
    warnings,
  };
}
