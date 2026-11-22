# Verification checklist — AfroHope portal

Last workspace checks run this turn:
- `npm run typecheck` — exit 0.
- `npm test` — 52 passed, 1 skipped, 0 failed.
- Local build not re-run this turn; the most recent verified build was
  `VERCEL=1 npm run build:sites` exit 0 with www canonicals, sitemap and og-card.

Files changed and committed:
- index.html
- public/_redirects, public/llms.txt, public/robots.txt, public/sitemap.xml,
  public/og-card.png, public/og-card.svg
- scripts/generate-sitemap.mjs, scripts/prerender-routes.mjs
- src/auth/AuthProvider.tsx
- src/components/AdminSystemSettings.tsx
- src/components/AdminWebsiteSettings.tsx
- src/components/CmsPrimitives.tsx
- src/components/Navigation.tsx
- src/components/academic/CourseDiscussions.tsx
- src/components/admin/EntranceTestAdmin.tsx
- src/components/portal/EmailOutboxPanel.tsx
- src/components/portal/PortalSidebar.tsx
- src/context/AppContext.tsx
- src/lib/seo.ts
- src/lib/storage.ts
- src/types.ts
- supabase/functions/admin-users/index.ts
- src/lib/portalTheme.ts (new)
- supabase/migrations/20261122120000_discussion_and_aptitude_write_paths.sql (new)
- supabase/migrations/20261122130000_site_videos_and_email_audit.sql (new)
- QYANT.md

Verified in the cloud browser this turn:
- Public site at 1440x900 renders the themed dark-green sign-in page.

Not verified (needs staff login or another action):
- Admin Appearance sidebar preview.
- Video upload / Site videos bucket write.
- Email manage screen and Retry failed.
- site-videos anonymous read policy.
- End-to-end password reset or invite with a real recipient.

Remaining known blockers:
- No staff login available in this workspace.
- supabase/functions/admin-users/index.ts source was rewritten here but has
  not been rebuilt/redeployed, so the redirectTo change is not live yet.
