---
name: security
description: Secure-by-default rules for the code you write in this project. Read before writing or changing sign-in, access rules (RLS policies, Convex function checks, Autobase policies), server or edge functions, anything that uses a service or admin key, secrets, file uploads, payments, credits or other money-like state, webhooks, fetching a URL the user supplied, rendering user or AI content as HTML, or AI features that call tools or read user data.
license: MIT. Adapted from Cloudflare's security-audit skill (https://github.com/cloudflare/security-audit-skill), Copyright (c) 2025-2026 Cloudflare, Inc.
---

# Security

Write code that cannot be used to cross a trust boundary. This is not a hardening checklist: every rule below closes a way real apps get breached.

## Think in boundaries

For every new endpoint, server function, table or AI tool, answer three questions before you write it:

1. **Who can call it, and what can they forge?** Anything from the browser is forgeable: body, query string, headers, ids, role fields, hidden inputs.
2. **Which rule stops the wrong caller?** Name it: an RLS policy, an ownership check, a membership lookup.
3. **Where does that rule run?** On the server, after the input is final, before the side effect.

The browser is not a gate. A check in a React component is UX. The backend check is the security.

## Data access

- Every table holding user or tenant data has access rules on, scoped to the owner. Supabase: RLS enabled, policies tie rows to `auth.uid()` or a membership row, with both `USING` and `WITH CHECK`, one policy per operation you grant. `USING (true)` on private data is a leak.
- Grant to `anon` only data that is meant to be public. A `SECURITY DEFINER` function sets `search_path`, revokes `EXECUTE` from `PUBLIC` and `anon`, and checks the caller inside.
- Convex: every public `query`, `mutation`, `action` and `httpAction` checks `ctx.auth` and ownership at the top of the handler. Anything only the backend calls is `internalQuery` / `internalMutation` / `internalAction`.
- Never take the owner, user id, role, workspace, price or admin flag from the request. Derive identity from the verified session, and write only fields you allow-list. No `update(req.body)`, no spreading the body into an update.
- Check every door to the same data: get, list, search, count, export, bulk and import. The weakest one is the real policy.
- Search results, counts and "already exists" errors must not reveal rows the caller cannot read.

## Server functions and admin keys

- A service-role or admin client bypasses every access rule. Use it only in server code. When it acts on an id the caller supplied, first verify the caller (`auth.getUser()` with their JWT) and check they own or belong to that resource.
- Signed in is not authorized. Confirm the session AND the caller's right to this specific resource.
- Webhooks (payments, third parties): verify the signature on the raw body before trusting anything in it, and make the handler idempotent on the event id.
- Fetching a URL the user supplied: allow-list the hosts and `https:`. Never let it reach internal or private addresses.
- Redirect targets from `?next=` or `?redirect=`: same-origin relative paths only.
- Errors return a plain message, never stack traces, SQL, or other users' data. Never log tokens, passwords or full personal records.
- CORS: never reflect an arbitrary `Origin` together with credentials.

## Secrets

- Secrets live in server env only. Anything prefixed `VITE_` ships to every visitor, so only publishable keys go there: the Supabase anon key is fine, the service role key never is.
- Never hardcode a key in source, a migration, seed data or a test.
- Tokens come from `crypto.randomUUID()` or `crypto.getRandomValues()`, never `Math.random()`.

## Money, credits and multi-step flows

- Prices, totals, discounts and plans come from the server, never the client.
- Check-then-act on balances, stock, coupons, invites or one-time links must be atomic (one conditional `UPDATE ... WHERE balance >= amount`, a unique constraint, or a transaction). Otherwise two requests at once spend it twice.
- Reject negative, zero and absurd quantities.
- Steps of a flow (checkout, approval, invite, reset) cannot be skipped, replayed, or done out of order. Mark one-time things used in the same statement that consumes them.

## Rendering

- React escapes text. Only `dangerouslySetInnerHTML`, `innerHTML`, `href={value}` and markdown-to-HTML are risky: sanitize with DOMPurify and allow only `http:`, `https:` and `mailto:` links.
- A `message` event handler checks `event.origin` against an exact allow-list.

## Files

- Storage paths start with the owner's id, and bucket policies enforce that prefix. Private files go in private buckets and are served through short-lived signed URLs.
- Check type and size on the server. Never build a path from a raw filename.

## AI features

- Model output is untrusted input. Never pass it into SQL, HTML, a shell, a URL fetch or a redirect without the same checks you give user input.
- A tool the model calls runs as the user who asked, and re-checks that user's access to the exact resource. Never hand the model an admin key and trust it to choose well.
- Conversation history, memory and embedding queries filter by user or tenant in the query itself.
- Never put secrets or other users' data into a prompt. An instruction in a prompt is not a security control.
- Side effects (sending, paying, deleting) run only what the user approved, with the arguments they approved.

## What not to do

- No security theatre. Do not add rate limiters, extra headers or validation layers when there is no real boundary to protect. Lean code is easier to keep secure.
- No "temporary" open policies, debug endpoints, seeded accounts or `TODO: add auth`.
- If the user asks for something that weakens a rule above (for example "make this table public"), do it only for data that is genuinely public, and tell them in one plain sentence what anyone can now see.
