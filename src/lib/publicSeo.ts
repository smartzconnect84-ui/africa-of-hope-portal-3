import { CANONICAL_ORIGIN, OG_IMAGE, OG_IMAGE_ALT, SITE_DESCRIPTION, SITE_NAME, SEO_FAQS } from "./seo";
import { viewToPath, type PublicView } from "./publicRoutes";

type SeoInput = { view: PublicView; displayName?: string };

const PAGE_COPY: Record<PublicView["type"], { title: string; description: string }> = {
  home: { title: `${SITE_NAME} | Certificates that open doors`, description: SITE_DESCRIPTION },
  about: { title: `About AFRICA OF HOPE | Professional Studies in Liberia`, description: "Learn about AFRICA OF HOPE, a practical professional studies school serving learners at Boystown Junction, Lower Margibi, Liberia." },
  programmes: { title: `Certificate Programmes in Liberia | AFRICA OF HOPE`, description: "Explore practical certificate programmes in technology, trades, business and hospitality at AFRICA OF HOPE in Liberia." },
  admissions: { title: `Admissions 2026/2027 | AFRICA OF HOPE Liberia`, description: "Apply online to AFRICA OF HOPE School of Professional Studies and start a practical certificate programme in Liberia." },
  "term-dates": { title: `Term Dates and Training Calendar | AFRICA OF HOPE`, description: "View AFRICA OF HOPE training terms, cohort dates and study calendar information for learners in Liberia." },
  verify: { title: `Verify an AFRICA OF HOPE Certificate`, description: "Verify an AFRICA OF HOPE certificate by serial number against the school's live institutional register." },
  donate: { title: `Support AFRICA OF HOPE | Donate to Practical Education`, description: "Support practical education, skills training and learner opportunities at AFRICA OF HOPE in Liberia." },
  transparency: { title: `Transparency Reports | AFRICA OF HOPE`, description: "Read public transparency reports and accountability information from AFRICA OF HOPE School of Professional Studies." },
  team: { title: `Our Team | AFRICA OF HOPE Liberia`, description: "Meet the mentors and team supporting practical certificate education at AFRICA OF HOPE in Liberia." },
  blog: { title: `News and Insights | AFRICA OF HOPE`, description: "Read news, learner guidance and practical education insights from AFRICA OF HOPE in Liberia." },
  policies: { title: `School Policies | AFRICA OF HOPE`, description: "Review public school policies for learners, admissions, certificates and responsible study at AFRICA OF HOPE." },
  campus: { title: `Campus Life | AFRICA OF HOPE Liberia`, description: "Discover campus life, learning spaces and student support at AFRICA OF HOPE in Lower Margibi, Liberia." },
  cookies: { title: `Cookie Policy | AFRICA OF HOPE`, description: "Read the cookie policy for the AFRICA OF HOPE website and learning portal." },
  newsletter: { title: `Newsletter | AFRICA OF HOPE`, description: "Manage AFRICA OF HOPE newsletter preferences and subscriptions." },
  blogPost: { title: `AFRICA OF HOPE News and Insights`, description: "Read the latest practical education news and guidance from AFRICA OF HOPE in Liberia." },
};

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

export function applyPublicSeo({ view, displayName }: SeoInput) {
  const copy = PAGE_COPY[view.type];
  const title = displayName && view.type === "home" ? `${displayName} | Certificates that open doors` : copy.title;
  const path = viewToPath(view).split("?")[0] || "/";
  const canonical = `${CANONICAL_ORIGIN}${path}`;
  document.title = title;
  setMeta("name", "description", copy.description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", copy.description);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", OG_IMAGE);
  setMeta("property", "og:image:alt", OG_IMAGE_ALT);
  setMeta("property", "og:type", view.type === "blogPost" ? "article" : "website");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", copy.description);
  setMeta("name", "twitter:image", OG_IMAGE);
  setCanonical(canonical);

  const schema = {
    "@context": "https://schema.org",
    "@type": view.type === "home" ? "EducationalOrganization" : "WebPage",
    name: title,
    description: copy.description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: CANONICAL_ORIGIN },
    ...(view.type === "home" ? {
      telephone: "+231776679963",
      email: "afrohope033@gmail.com",
      address: { "@type": "PostalAddress", streetAddress: "Boystown Junction", addressLocality: "Lower Margibi", addressCountry: "LR" },
      image: OG_IMAGE,
    } : {}),
    ...(view.type === "home" ? { mainEntity: SEO_FAQS.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) } : {}),
  };
  let script = document.head.querySelector<HTMLScriptElement>('script[data-aoh-page-schema="true"]');
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.aohPageSchema = "true";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}
