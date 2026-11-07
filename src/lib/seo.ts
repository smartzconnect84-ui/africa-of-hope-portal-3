
export const CANONICAL_ORIGIN =
  "https://www.africaofhopelr.org";

export const SITE_NAME =
  "AFRICA OF HOPE School of Professional Studies";

export const SITE_DESCRIPTION =
  "AFRICA OF HOPE School of Professional Studies offers practical certificate programmes, professional training and verifiable certificates in Liberia.";

export const SITE_KEYWORDS =
  "AFRICA OF HOPE, professional studies Liberia, certificate programmes Liberia, online admissions Liberia, verify certificate Liberia, vocational training Margibi, computer training Liberia";

export const OG_IMAGE =
  "https://www.africaofhopelr.org/logo/aoh-logo.png";

export const OG_IMAGE_ALT =
  "AFRICA OF HOPE School of Professional Studies — practical certificate programmes with verifiable certificates in Liberia";

export const SEO_FAQS = [
  {
    q: "What does AFRICA OF HOPE School of Professional Studies offer?",
    a: "AFRICA OF HOPE offers practical certificate programmes and professional training in Liberia.",
  },
  {
    q: "Where is AFRICA OF HOPE located?",
    a: "AFRICA OF HOPE is located at Boystown Junction in Lower Margibi, Liberia.",
  },
  {
    q: "How can I verify an AFRICA OF HOPE certificate?",
    a: "Use the public certificate verification page and enter the certificate serial number.",
  },
];

export function applySearchConsoleVerification() {
  const verification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
  if (!verification) return;
  let tag = document.head.querySelector<HTMLMetaElement>('meta[name="google-site-verification"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "google-site-verification";
    document.head.appendChild(tag);
  }
  tag.content = verification;
}
