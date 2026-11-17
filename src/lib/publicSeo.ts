import { CANONICAL_ORIGIN, OG_IMAGE, OG_IMAGE_ALT, SAME_AS_PROFILES, SITE_DESCRIPTION, SITE_NAME, SEO_FAQS } from "./seo";
import { COURSE_CATALOGUE } from "./programSlugs";
import { viewToPath, type PublicView } from "./publicRoutes";

type SeoInput = { view: PublicView; displayName?: string };

export type BlogPostSeo = {
  title: string;
  excerpt: string;
  slug: string;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
  authorName?: string;
};

const PAGE_COPY: Record<PublicView["type"], { title: string; description: string }> = {
  home: { title: `${SITE_NAME} | Certificates that open doors`, description: SITE_DESCRIPTION },
  about: { title: `About ${SITE_NAME} | Practical Training in Liberia`, description: "Learn about AFRICA OF HOPE School of Professional Studies, a practical professional studies school serving learners at Boystown Junction, Lower Margibi, Liberia." },
  programmes: { title: `Certificate Programmes in Liberia | ${SITE_NAME}`, description: "Explore practical certificate programmes in technology, trades, business and hospitality at AFRICA OF HOPE School of Professional Studies in Liberia." },
  admissions: { title: `Admissions 2026/2027 | ${SITE_NAME}`, description: "Apply online to AFRICA OF HOPE School of Professional Studies and start a practical certificate programme in Liberia." },
  impact: { title: `Our Impact | ${SITE_NAME}`, description: "See AFRICA OF HOPE School of Professional Studies impact: practical certificate outcomes, student success stories, community stats and partners in Liberia." },
  "term-dates": { title: `Term Dates and Training Calendar | ${SITE_NAME}`, description: "View AFRICA OF HOPE School of Professional Studies training terms, cohort dates and study calendar information for learners in Liberia." },
  verify: { title: `Verify an AFRICA OF HOPE School of Professional Studies Certificate`, description: "Verify an AFRICA OF HOPE School of Professional Studies certificate by serial number against the school's live institutional register." },
  donate: { title: `Support ${SITE_NAME} | Donate to Practical Education`, description: "Support practical education, skills training and learner opportunities at AFRICA OF HOPE School of Professional Studies in Liberia." },
  transparency: { title: `Transparency Reports | ${SITE_NAME}`, description: "Read public transparency reports and accountability information from AFRICA OF HOPE School of Professional Studies." },
  team: { title: `Our Team | ${SITE_NAME}`, description: "Meet the mentors and team supporting practical certificate education at AFRICA OF HOPE School of Professional Studies in Liberia." },
  blog: { title: `News and Insights | ${SITE_NAME}`, description: "Read news, learner guidance and practical education insights from AFRICA OF HOPE School of Professional Studies in Liberia." },
  policies: { title: `School Policies | ${SITE_NAME}`, description: "Review public school policies for learners, admissions, certificates and responsible study at AFRICA OF HOPE School of Professional Studies." },
  campus: { title: `Campus Life | ${SITE_NAME}`, description: "Discover campus life, learning spaces and student support at AFRICA OF HOPE School of Professional Studies in Lower Margibi, Liberia." },
  cookies: { title: `Cookie Policy | ${SITE_NAME}`, description: "Read the cookie policy for the AFRICA OF HOPE School of Professional Studies website and learning portal." },
  newsletter: { title: `Newsletter | ${SITE_NAME}`, description: "Manage AFRICA OF HOPE School of Professional Studies newsletter preferences and subscriptions." },
  blogPost: { title: `News and Insights | ${SITE_NAME}`, description: "Read the latest practical education news and guidance from AFRICA OF HOPE School of Professional Studies in Liberia." },
  programmeDetail: { title: `Certificate Courses in Liberia | ${SITE_NAME}`, description: "Course duration, study modes, registration fees and how to apply for a certificate course at AFRICA OF HOPE School of Professional Studies in Liberia." },
};

export function programmeDetailCopy(slug: string): { title: string; description: string; summary: string } {
  const course = COURSE_CATALOGUE.find((c) => c.slug === slug);
  if (!course) return { title: PAGE_COPY.programmeDetail.title, description: PAGE_COPY.programmeDetail.description, summary: PAGE_COPY.programmeDetail.description };
  const title = `${course.title} Certificate in Liberia | ${SITE_NAME}`;
  const description = `${course.title} certificate at AFRICA OF HOPE School of Professional Studies: ${course.blurb} Modes: ${course.modes.join(", ")}. Registration US$5 (two-week), US$10 (one-month), US$30 (three-month), US$45 (six-month). Apply online for 2026/2027.`;
  return { title, description, summary: `${course.blurb} Study modes: ${course.modes.join(", ").toLowerCase()}; registration from US$5 by track.` };
}

export function pageCopyForView(view: PublicView) {
  return PAGE_COPY[view.type];
}

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
  const detailCopy = view.type === "programmeDetail" ? programmeDetailCopy(view.slug) : null;
  const copy = detailCopy ?? PAGE_COPY[view.type];
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
    "@type": view.type === "home" ? "EducationalOrganization" : view.type === "programmeDetail" ? "Course" : "WebPage",
    name: title,
    description: copy.description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: CANONICAL_ORIGIN },
    ...(view.type === "home" ? {
      telephone: "+231776679963",
      email: "afrohope033@gmail.com",
      address: { "@type": "PostalAddress", streetAddress: "Boystown Junction", addressLocality: "Lower Margibi", addressRegion: "Margibi County", addressCountry: "LR", postalCode: "1000" },
      areaServed: [{ "@type": "AdministrativeArea", name: "Liberia" }, { "@type": "Place", name: "Boystown Junction, Lower Margibi County, Liberia" }],
      sameAs: SAME_AS_PROFILES,
      image: OG_IMAGE,
    } : {}),
    ...(view.type === "programmeDetail" ? (() => {
      const course = COURSE_CATALOGUE.find((c) => c.slug === view.slug);
      return {
        provider: { "@type": "EducationalOrganization", name: SITE_NAME, url: CANONICAL_ORIGIN },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: course?.modes ?? ["Fully online", "Partially online", "Fully on-site"], courseWorkload: course?.schedule ?? "1 hour a day, 3 days a week (online)" },
        offers: { "@type": "Offer", priceCurrency: "USD", price: "5", category: "Registration package" },
      };
    })() : {}),
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

/** Per-article head + BlogPosting JSON-LD when a blog post loads. */
export function applyBlogPostSeo(post: BlogPostSeo) {
  const clean = (post.excerpt || "").trim().slice(0, 160) || PAGE_COPY.blogPost.description;
  const title = `${post.title} | ${SITE_NAME}`;
  const canonical = `${CANONICAL_ORIGIN}/blog/${encodeURIComponent(post.slug)}`;
  const image = post.coverImageUrl || OG_IMAGE;
  document.title = title;
  setMeta("name", "description", clean);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", clean);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", image);
  setMeta("property", "og:type", "article");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", clean);
  setMeta("name", "twitter:image", image);
  setCanonical(canonical);

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: clean,
    url: canonical,
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.authorName ? { author: { "@type": "Person", name: post.authorName } } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    publisher: { "@type": "EducationalOrganization", name: SITE_NAME, url: CANONICAL_ORIGIN },
    mainEntityOfPage: canonical,
  };
  let script = document.head.querySelector<HTMLScriptElement>('script[data-aoh-post-schema="true"]');
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.aohPostSchema = "true";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}
