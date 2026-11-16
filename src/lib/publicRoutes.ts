/**
 * Clean-URL routing for the public marketing site.
 * Canonical paths (no `#`): /, /about, /programmes, /admissions,
 * /term-dates, /verify, /donate, /transparency, /team, /blog,
 * /blog/:slug, /policies, /campus-life, /cookies, /newsletter/confirm,
 * /newsletter/unsubscribe.
 * Home section jumps use `?section=<id>` (e.g. /?section=support&support=donation)
 * so no hash navigation remains. Legacy `#...` URLs redirect to clean paths.
 */

export type PublicView =
  | { type: "home"; anchor: string | null }
  | { type: "programmes" }
  | { type: "term-dates" }
  | { type: "admissions" }
  | { type: "campus" }
  | { type: "policies" }
  | { type: "transparency" }
  | { type: "cookies" }
  | { type: "donate" }
  | { type: "blog" }
  | { type: "about" }
  | { type: "team" }
  | { type: "newsletter"; action: "confirm" | "unsubscribe"; params: string }
  | { type: "verify"; serial: string | null }
  | { type: "blogPost"; slug: string };

const stripSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export function parsePublicPath(pathname: string, search = ""): PublicView {
  const path = stripSlash((pathname || "/").toLowerCase());
  const params = new URLSearchParams(search || "");

  if (path === "/" || path === "") {
    const section = params.get("section");
    // Plain / with no section is Home top; /?section=contact etc scrolls there.
    return { type: "home", anchor: section };
  }
  if (path === "/about" || path === "/about-us" || path === "/who-we-are") return { type: "about" };
  if (path === "/programmes" || path === "/programs") return { type: "programmes" };
  if (path === "/admissions" || path === "/apply" || path === "/apply-online") return { type: "admissions" };
  if (path === "/term-dates") return { type: "term-dates" };
  if (path === "/policies") return { type: "policies" };
  if (path === "/transparency") return { type: "transparency" };
  if (path === "/cookies") return { type: "cookies" };
  if (path === "/donate") return { type: "donate" };
  if (path === "/blog") return { type: "blog" };
  if (path === "/team" || path === "/our-team") return { type: "team" };
  if (path === "/campus-life" || path === "/campus") return { type: "campus" };
  if (path === "/verify") {
    const serial = params.get("serial") || params.get("id") || params.get("certificate");
    return { type: "verify", serial };
  }
  if (path === "/newsletter/confirm" || path === "/newsletter/unsubscribe") {
    const action = path.endsWith("unsubscribe") ? "unsubscribe" : "confirm";
    return { type: "newsletter", action, params: params.toString() };
  }
  const blogMatch = /^\/blog\/(.+)$/.exec(pathname);
  if (blogMatch) {
    let slug = blogMatch[1].replace(/^\/+|\/+$/g, "");
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* keep raw slug */
    }
    if (slug) return { type: "blogPost", slug };
    return { type: "blog" };
  }
  // Unknown path: fall back to Home (lets the 404-ish URL still render the site).
  return { type: "home", anchor: null };
}

export function viewToPath(view: PublicView): string {
  switch (view.type) {
    case "home":
      return view.anchor ? `/?section=${encodeURIComponent(view.anchor)}` : "/";
    case "about":
      return "/about";
    case "programmes":
      return "/programmes";
    case "admissions":
      return "/admissions";
    case "term-dates":
      return "/term-dates";
    case "policies":
      return "/policies";
    case "transparency":
      return "/transparency";
    case "cookies":
      return "/cookies";
    case "donate":
      return "/donate";
    case "blog":
      return "/blog";
    case "team":
      return "/team";
    case "campus":
      return "/campus-life";
    case "verify":
      return view.serial ? `/verify?serial=${encodeURIComponent(view.serial)}` : "/verify";
    case "blogPost":
      return `/blog/${encodeURIComponent(view.slug)}`;
    case "newsletter":
      return `/newsletter/${view.action}${view.params ? `?${view.params}` : ""}`;
    default:
      return "/";
  }
}

/**
 * Legacy hash (`#about`, `#/verify?serial=X`, `#blog/slug`,
 * `#support-donation`, `#contact` …) → clean path, or null when not a
 * recognised legacy route. Used once on load for backwards compatibility
 * with printed QR codes, old bookmarks and assistant links.
 */
export function legacyHashToPath(hash: string): string | null {
  if (!hash || hash === "#") return "/";
  const h = hash.trim();
  const newsletter = h.match(/^#newsletter\/(confirm|unsubscribe)\?(.*)$/i);
  if (newsletter) return `/newsletter/${newsletter[1].toLowerCase()}?${newsletter[2]}`;
  const verify = h.match(/^#\/?verify(?:\?(.*))?$/i);
  if (verify) return verify[1] ? `/verify?${verify[1]}` : "/verify";
  if (/^#(programmes|programs)\/?$/i.test(h)) return "/programmes";
  if (/^#term-dates\/?$/i.test(h)) return "/term-dates";
  if (/^#policies\/?$/i.test(h)) return "/policies";
  if (/^#cookies\/?$/i.test(h)) return "/cookies";
  if (/^#donate\/?$/i.test(h)) return "/donate";
  if (/^#transparency\/?$/i.test(h)) return "/transparency";
  if (/^#\/?(team|our-team)\/?$/i.test(h)) return "/team";
  if (/^#(admissions|apply|apply-online)\/?$/i.test(h)) return "/admissions";
  if (/^#(about|about-us|who-we-are)\/?$/i.test(h)) return "/about";
  if (/^#campus-life\/?$/i.test(h)) return "/campus-life";
  if (/^#blog\/?$/i.test(h)) return "/blog";
  const blogPost = h.match(/^#blog\/(.+)$/i);
  if (blogPost) return `/blog/${blogPost[1]}`;
  const support = h.match(/^#support-(donation|volunteer|partner|staff)$/i);
  if (support) return `/?section=support&support=${support[1].toLowerCase()}`;
  if (/^#support\/?$/i.test(h)) return "/?section=support";
  if (/^#(home)?\/?$/i.test(h)) return "/";
  // Any other old anchor (#contact, #impact, #summary…) becomes a home section jump.
  const anchor = h.match(/^#([a-z][a-z0-9_-]*)$/i);
  if (anchor) return `/?section=${encodeURIComponent(anchor[1].toLowerCase())}`;
  return null;
}

/**
 * Normalises CMS-configured hrefs (or hardcoded legacy hrefs) to clean paths:
 * `#about` → `/about`, `#blog/slug` → `/blog/slug`, `#support-donation` →
 * `/?section=support&support=donation`, `#contact` → `/?section=contact`.
 * Absolute URLs, `/` paths and `?` queries pass through untouched.
 */
export function normalizePublicHref(href: string): string {
  const raw = (href || "").trim();
  if (!raw) return "/";
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("?")) return `/${raw}`;
  if (raw.startsWith("#")) return legacyHashToPath(raw) ?? "/";
  return raw;
}

export function supportKindFromSearch(search: string): string | null {
  try {
    const v = new URLSearchParams(search || "").get("support");
    return v && /^(donation|volunteer|partner|staff)$/i.test(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function homeSectionFromSearch(search: string): string | null {
  try {
    return new URLSearchParams(search || "").get("section");
  } catch {
    return null;
  }
}
