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
  const [logo, favicon, portrait] = await Promise.all([
    imageFile("/logo/aoh-logo.png", "aoh-logo.png", "image/png"),
    imageFile("/favicon.png", "favicon.png", "image/png"),
    imageFile(FOUNDER_PROFILE.image, "shedrick-nungehn.jpeg", "image/jpeg"),
  ]);
  const placements = ["header", "footer", "portal", "auth", "certificate", "brochure"] as const;
  const logoUrl = await uploadSiteAsset("logo", logo);
  const logos: NonNullable<WebsiteSettings["logos"]> = {};
  for (const placement of placements) logos[placement] = await uploadSiteAsset(`logos/${placement}`, logo);
  const faviconUrl = await uploadSiteAsset("favicon", favicon);
  const portraitUrl = await uploadSiteAsset("team", portrait);
  return { logoUrl, faviconUrl, logos, portraitUrl };
}
