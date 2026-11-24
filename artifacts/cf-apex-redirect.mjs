// Apex -> www redirect for africaofhopelr.org on Cloudflare.
// Usage:  CF_TOKEN=your_api_token node cf-apex-redirect.mjs
// Token needs, for zone africaofhopelr.org:
//   Zone:Read, DNS:Edit, Single Redirect:Edit   (older name: Dynamic URL Redirects:Write)
// Safe to re-run: it reuses an existing apex record and an existing rule with our ref.

const TOKEN = process.env.CF_TOKEN;
if (!TOKEN) {
  console.error("Set CF_TOKEN first, e.g. CF_TOKEN=abc123 node cf-apex-redirect.mjs");
  process.exit(1);
}

const ZONE_NAME = "africaofhopelr.org";
const WWW = `www.${ZONE_NAME}`;
const API = "https://api.cloudflare.com/client/v4";
const PHASE = "http_request_dynamic_redirect";
const REF = "apex-to-www";

async function call(method, path, body, { allowMissing = false } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    const errs = data.errors || [];
    if (allowMissing && errs.some((e) => /could not find entrypoint/i.test(e.message || ""))) {
      return null;
    }
    console.error(`${method} ${path} failed:`);
    for (const e of errs) console.error(`  [${e.code}] ${e.message}`);
    if (errs.some((e) => /not authorized/i.test(e.message || ""))) {
      console.error(
        "  -> the token is missing a scope (most often Single Redirect: Edit, which is called\n" +
          "     'Dynamic URL Redirects: Write' in some token screens)."
      );
    }
    process.exit(1);
  }
  return data.result;
}

const zones = await call("GET", `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
const zone = (zones || [])[0];
if (!zone) {
  console.error(`No zone named ${ZONE_NAME} is visible to this token.`);
  process.exit(1);
}
console.log(`zone ${zone.name} (${zone.id})`);

// 1. Proxied placeholder record so Cloudflare answers for the apex and can apply rules to it.
const records = await call(
  "GET",
  `/zones/${zone.id}/dns_records?name=${encodeURIComponent(ZONE_NAME)}&per_page=100`
);
const existing = (records || []).find((r) => ["A", "AAAA", "CNAME"].includes(r.type));
if (existing) {
  console.log(
    `apex record already exists: ${existing.type} ${existing.name} -> ${existing.content} (proxied=${existing.proxied})`
  );
  if (!existing.proxied) console.warn("  warning: it is not proxied, so redirect rules will not apply to it.");
} else {
  const rec = await call("POST", `/zones/${zone.id}/dns_records`, {
    type: "A",
    name: ZONE_NAME,
    content: "192.0.2.1",
    proxied: true,
    ttl: 1,
    comment: "Placeholder for apex -> www redirect, no origin behind it",
  });
  console.log(`created proxied A ${rec.name} -> ${rec.content}`);
}

// 2. Single Redirect rule: keep the path and query string, 301 to https://www.
const entrypoint = await call("GET", `/zones/${zone.id}/rulesets/phases/${PHASE}/entrypoint`, undefined, {
  allowMissing: true,
});
const writable = ["ref", "action", "action_parameters", "expression", "description", "enabled"];
const rules = ((entrypoint && entrypoint.rules) || [])
  .filter((r) => r.ref !== REF)
  .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => writable.includes(k))));

rules.push({
  ref: REF,
  action: "redirect",
  description: "Apex to www",
  expression: `(http.host eq "${ZONE_NAME}")`,
  action_parameters: {
    from_value: {
      target_url: { expression: `concat("https://${WWW}", http.request.uri.path)` },
      status_code: 301,
      preserve_query_string: true,
    },
  },
  enabled: true,
});

const saved = await call("PUT", `/zones/${zone.id}/rulesets/phases/${PHASE}/entrypoint`, { rules });
const rule = (saved.rules || []).find((r) => r.ref === REF);
console.log(`redirect rule ${rule ? "deployed" : "saved"}: ${ZONE_NAME}/* -> https://${WWW}/... (301)`);
console.log(`check with: curl -sI https://${ZONE_NAME}/portal/ | head -5`);
