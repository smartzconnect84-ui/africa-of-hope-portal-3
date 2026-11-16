# Agent instructions

This project is built and maintained with [Qyant](https://qyant.dev).

## Read this first

**[QYANT.md](./QYANT.md) is the project's memory.** It records what this app is
for, the data model, every route and page, the environment variables that have
been wired, and the decisions taken so far. Read it before changing anything —
it is shorter and more current than re-reading the whole codebase.

## Keeping it true

QYANT.md is updated as part of the same change that alters the code. When you
add a table, a route, an environment variable or a dependency, or take a
decision worth remembering, update the matching section and append one line to
the change log. Never let the code and the memory disagree.

QYANT.md is written by the agent, not by hand: it is read-only in the Qyant
editor.

## House style

Every change follows this, whether it is made in Qyant or anywhere else.


- **Subject-specific modern design.** Choose a palette, type system and distinctive
  composition from the brief; no universal blue/orange card-grid template. Solid
  colours, no gradients; intentional secondary/status colours. Light by default,
  user branding first, liquid glass optional. Record tokens in the main stylesheet.
- **Visual substance in every phase.** A public hero needs a relevant focal
  visual and clear CTA, not just oversized text over empty space. Choose real
  photography, a product preview, original illustration or a diagram for the
  subject; honour minimal-motion briefs over default 3D. Never expose private
  data in a public preview; label illustrative samples. Plan assets with the
  layout, preserve the visual concept through auth/backend phases, and review
  visual completeness again at the end. User colours take precedence; choose
  from the brief, not a random palette rotation.
- **Purposeful layouts.** Varied, content-driven marketing sections; no mandatory
  full-screen heights. A website has a hero; an app opens on the working screen
  after authentication when private. Fit navbar/sidebar/footer to the product.
- **Complete UX.** Real copy, functional actions, honest empty/loading/error states,
  accessible forms, no TODO sections and no fabricated proof or demo identity.
- **Marketing 3D by default.** On new landing sites/redesigns, include a relevant
  Three.js scene, scroll-linked motion and meaningful infographics. React/Next
  can use Fiber/Drei/React Spring/Rapier; other frontends use Three/Motion/Rapier
  without switching stacks. Check installed dependencies. Drag objects use
  raycasting, spring wobble and physical release/collisions when appropriate.
- **Performance and accessibility.** Client-only lazy scenes, capped pixel ratio,
  resource cleanup, offscreen pause, mobile simplification, reduced-motion and
  WebGL fallbacks. Keep HTML content/CTA usable without canvas. Apps/admin need
  purposeful motion and data charts, not mandatory heavy 3D.
- **Relevant images.** Supplied assets or verified image URLs, useful alt text,
  never guessed IDs, fake customer portraits, or unrelated placeholder photos.
- **Responsive from 280px.** No page overflow; flexible grids and readable type.
  Consistent buttons/fields, curved borders, visible focus and keyboard access.
  Preserve mobile usability while improving desktop composition. Check phone,
  tablet and wide desktop layouts, expanded menus, long labels and media crops
  with browser tools when available; report limitations honestly otherwise.
- **Preserve the user's chosen design on small edits.** Apply a redesign when
  requested; these current rules supersede older generated style restrictions.

## Authentication and authorization

AUTHENTICATION AND AUTHORIZATION — complete the prerequisites, not just the screens.
- Infer authentication from the requested workflow. An admin panel, private
  dashboard, account, personal records, wallet, approvals, or user-owned data
  requires real sign-in even when the user does not separately request a login
  page. Implement it in the same delivery. Public marketing pages do not need
  an account gate. Preserve an existing working auth system when extending it.
- For an admin workflow, create a separate /admin/login entry and protected
  /admin pages, alongside /login when members also sign in. Add a clear sign-in
  entry to the public navbar and an Admin sign-in link where relevant. Signed-in
  navigation shows the correct account actions and a working sign-out button.
  Use equivalent routes in the selected framework; never switch stacks for auth.
- Email/password authentication is the default prerequisite for a new private
  workflow. Implement users and sessions in the project's server-side Postgres
  layer, following its existing schema/migration conventions. Settings describe
  configured OAuth providers; an unset switch does NOT prohibit local password
  login that the requested workflow needs. Show OAuth buttons only for enabled,
  configured providers. Never render an unconfigured provider as working.
- SWITCHES. When a turn builds or keeps sign-in, end the answer with one
  line naming every method the app offers after it, e.g.
  <qyant:auth>password, google</qyant:auth> (values: password, google,
  github, linkedin). SpinBuild turns those switches on in Settings when the
  change is applied and supplies their environment, so the user never has to.
  Name only methods whose code is in the project after this turn.
- Hash passwords with Argon2id (at least 19 MiB, 2 iterations, parallelism 1)
  or asynchronous node:crypto scrypt (N=131072, r=8, p=1, adequate maxmem).
  Use a unique random salt, constant-time comparison, parameterized SQL, normalized
  uniquely indexed email, server-side validation, and a password policy allowing
  long passphrases (minimum 15 characters without MFA, maximum at least 64).
  Never store plaintext/reversible passwords or return password hashes to clients.
- Use a maintained auth library compatible with the installed framework or a
  complete opaque-session implementation: at least 32 random bytes per token,
  only a hash stored in the database, expiry, rotation on login/privilege change,
  revocation on logout. Set host-only HttpOnly, SameSite cookies with Path=/;
  Secure on HTTPS. Do not put sessions, passwords, or privileged roles in
  localStorage. Do not invent a hard-coded signing secret. Database-backed
  opaque sessions can work without an extra third-party service or secret.
- PROTECT ADMIN ON THE SERVER. Before rendering private pages, reading their
  data, or running an API/route handler/server action, verify the session and
  the role from trusted server data. Anonymous users go to the appropriate
  login page; APIs return 401. Non-admin users receive 403 for admin operations.
  A hidden nav item, client redirect, middleware alone, or a login overlay is
  not authorization. Centralize guards and call them at every protected entry.
- Scope member queries and mutations to the authenticated user. Never trust a
  submitted userId, role, cookie flag, URL parameter, or client state as proof
  of permission. Never select the first/seeded user as the current account.
- Make login, signup and password attempts rate-limited on the server, with
  generic failure messages. Protect cookie-authenticated mutations with CSRF
  tokens or strict same-origin validation, including login and logout. Validate
  return URLs as local paths. Never share cached private responses across users.
- Public registration creates a member only. NEVER let a public form, request
  field, first signup, or demo credential create an admin. Ship a documented,
  runnable owner-only bootstrap script using the same password hasher and safe
  interactive input when no admin exists. No default admin password, no public
  bootstrap endpoint, no seeded privileged session, and no credential in source.
- Sample content must be visibly labeled demo data. Never seed real-looking
  spendable balances, payments, identities or approvals into a real user's
  account. Empty private accounts get useful honest empty states. Do not fake
  authentication or show "signed in as" a sample person to make a demo look full.
- Fail closed if auth/database setup fails: do not fall back to an unlocked
  dashboard. Each delivered phase must keep private/admin routes protected.
  Complete the login form, validation, errors, session persistence, sign-out,
  role checks, and safe first-admin setup without waiting for a follow-up prompt.
- Verify anonymous denial, member-versus-admin access, cross-account denial,
  invalid credentials, session expiry/logout, and CSRF rejection. A successful
  build alone does not verify auth. Report honestly what was exercised; never
  claim a deployed app is secure just because these instructions were followed.

## Conventions

- This is a static browser application. When it needs saved data, an API
  is added in `server.mjs` with Postgres queries in `db.js`; the browser
  calls the API. Never import server/database code into `src/`, and never
  expose DATABASE_URL with a VITE_ prefix.
- Components live under `src/`, one per file, named after what they are.
- The entry point mounts a single root component; routing, if the app needs
  it, is client-side.
- Plain CSS in the files the scaffold already has. Do not add a build step
  or a UI framework unless asked for one.
- Add schema using new numbered SQL migrations. Sessions, authorization and
  private data access are server-side, not localStorage or a client-only guard.
- `PORT` is managed by the platform. Never hard-code it, and never pin a
  port in the dev-server config.
