import type { WebsiteSettings } from "../types";

/**
 * Single source of truth for the school's public contact details.
 *
 * Public pages and structured data read these values from the backend website
 * settings (Admin → Website → Branding/footer), so editing the phone, e-mail or
 * address in the portal updates the live site — including the JSON-LD block that
 * Google reads. The constants below are only a last-resort fallback for a fresh
 * database that has not been seeded yet.
 */
export interface PublicContact {
  /** Display phone, e.g. "+231776679963". */
  phone: string;
  /** Digits only, for tel:/WhatsApp links. */
  phoneDigits: string;
  email: string;
  address: string;
  /** Short "City, Region" form used inside sentences. */
  locality: string;
  officeHours: string;
}

const FALLBACK = {
  phone: "+231776679963",
  email: "afrohope033@gmail.com",
  address: "Boystown Junction, Lower Margibi, Republic of Liberia",
  officeHours: "Mon–Fri, 8:00–17:00",
};

export function publicContact(settings?: Partial<WebsiteSettings> | null): PublicContact {
  const phone = (settings?.contactPhone || FALLBACK.phone).trim();
  const email = (settings?.contactEmail || FALLBACK.email).trim();
  const address = (settings?.address || FALLBACK.address).trim();
  // "Boystown Junction, Lower Margibi" — drop a trailing country for prose.
  const locality = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/liberia|republic/i.test(part))
    .join(", ") || "Lower Margibi";
  return {
    phone,
    phoneDigits: phone.replace(/[^\d]/g, ""),
    email,
    address,
    locality,
    officeHours: (settings?.officeHours || FALLBACK.officeHours).trim(),
  };
}
