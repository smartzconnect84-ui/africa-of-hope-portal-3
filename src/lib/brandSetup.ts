import type { WebsiteSettings } from "@/types";
import { FOUNDER_PROFILE } from "@/data/teamContent";
import { uploadSiteAsset } from "./storage";

async function imageFile(url: string, name: string, type: string): Promise<File> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status}). No settings have been published.`);
  const blob = await response.blob();
  return new File([blob], name, { type });
}

/** Explicit administrator action: copy owner-provided assets into existing
 * Supabase storage. New UUID paths only; no old files or settings are deleted. */
export async function copySuppliedBrandAssets(): Promise<{
  logoUrl: string;
  faviconUrl: string;
  logos: NonNullable<WebsiteSettings["logos"]>;
  portraitUrl: string;
}> {
  const [logo, favicon] = await Promise.all([
    imageFile("/logo/aoh-logo.png", "aoh-logo.png", "image/png"),
    imageFile("/favicon.png", "favicon.png", "image/png"),
  ]);
  const placements = ["header", "footer", "portal", "auth", "certificate", "brochure"] as const;
  const logoUrl = await uploadSiteAsset("logo", logo);
  const logos: NonNullable<WebsiteSettings["logos"]> = {};
  for (const placement of placements) logos[placement] = await uploadSiteAsset(`logos/${placement}`, logo);
  const faviconUrl = await uploadSiteAsset("favicon", favicon);
  let portraitUrl = FOUNDER_PROFILE.image;
  try {
    const portrait = await imageFile(FOUNDER_PROFILE.image, "shedrick-nungehn.jpeg", "image/jpeg");
    portraitUrl = await uploadSiteAsset("team", portrait);
  } catch {
    // Keep the approved source URL when the external host blocks browser fetches.
    // Logo and favicon copying must remain usable even when that optional source is unavailable.
  }
  return { logoUrl, faviconUrl, logos, portraitUrl };
}
