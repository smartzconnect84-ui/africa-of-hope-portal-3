# Backend actions and remaining release work

## Scope and preservation

This is a source-level review, not a live Supabase inspection. No migrations,
production settings, deployments, records or storage objects were changed by
these edits. No blanket CRUD permissions were added. Existing RLS and role
permissions remain authoritative. Completing personal-file actions does **not**
mean every backend module now supports every requested action.

## Implemented in this change

- The attached logo is the default for header, footer, portal identity and PWA
  assets. Older saved website settings receive a presentation-only brand
  upgrade; saving Website Settings records the revision and preserves later
  independent logo edits. Desktop sidebar now displays the portal logo too.
- Login and registration offer Remember me. Supabase auth writes use local
  storage when opted in and session storage otherwise; blocked browser storage
  falls back to memory. Existing sessions remain readable for compatibility.
  Sign-out removes stored auth values from both stores. No separate password
  copy is stored. Email confirmation on another device uses that device's own
  preference; session storage is scoped by browser tab, not an inactivity timer.
- Every signed-in role has a Donate link to the existing public donation flow.
- My files exposes the existing private document library to portal roles.
  Upload, signed-URL download, confirmed delete, rename/category move, and
  CSV/JSON metadata export are available for the current account's files.
  Exports do not include signed links or file bytes. Existing storage policies
  enforce access; this change does not make the documents bucket public.
- Untimed AssignmentInbox hand-in now uploads real files through the existing
  academic upload API, submits the returned path to submit_classwork and keeps
  text/reference fallback. Uploads are validated and submission success waits
  for the RPC. A successfully uploaded path is retained for a failed submission
  retry during that view's lifetime. Staff can open the saved attachment using
  a short-lived signed download URL under existing storage policies.
- CompletionCertificates no longer offers credential print/PDF for revoked
  certificates. Its handlers also reject invalid status. The shared PDF helper
  refuses revoked credentials; structured register exports retain the status
  as historical records, rather than issuing a valid credential. Public
  verification already reports revocation and must continue to do so.

## Coverage boundaries — not claimed complete

| Area | Source-level coverage / remaining work |
| --- | --- |
| Personal files | Upload, download, edit, confirmed delete and metadata export added/reused for each account. Live owner/cross-account RLS tests pending. |
| Assignments | Creation, submission and grading use existing permissions. Real untimed homework upload repaired. Live RPC/storage persistence and teacher download test pending. |
| Certificates | Existing issue/revoke and PDF/CSV/JSON paths retained; revoked credential output repaired. Live issuance/revocation and cross-device state freshness still require tests. |
| Student/staff accounts and admissions | Existing role-gated workflows retained. No universal deletion or bulk-write grant introduced. Detailed action-by-action QA remains required. |
| Finance, attendance, programmes, learning materials, CMS and communications | Existing workflows remain in place. This change has not audited or added all five actions to every screen. Authorization, audit-history and retention requirements must be established per operation before expanding deletion/edit/import capabilities. |
| Email, newsletter, push, Groq and realtime | Existing source implementation retained. Deployment and live-provider/device tests remain release blockers. |

## Staging acceptance tests (not executed here)

1. Sign in and register with Remember me both checked and unchecked. Close and
   reopen the browser and verify the intended lifetime. Test sign-out, recovery,
   email-confirmation links and a browser with blocked storage. Never use a shared
   device for a remembered session.
2. Check header/footer/sidebar/topbar and install/launch identity at phone and
   desktop widths. Save a placement-specific CMS logo, reload, and confirm the
   independent edit survives. Existing home-screen icons may require reinstall.
3. As Student, Teacher, Parent, Admission Officer, School Admin and Super Admin,
   open My files, upload, reload, rename/category-move, download, export and delete
   a test file. Confirm one account cannot list/download/move/delete another
   account's files by calling storage directly. Verify delete cancellation.
4. As an enrolled student, hand in a real homework attachment, reload and verify
   its database attachment_path. As the assigned teacher, download and grade it.
   Test oversized/unsupported files, failed upload, failed RPC and retry. The
   classwork-submissions bucket and its policies must already be deployed.
5. Revoke a test certificate, refresh the holder view, and verify print/PDF are
   unavailable and direct calls to the PDF helper fail. Confirm public serial
   verification reports Revoked and CSV/JSON records retain that status.
6. Follow RELEASE_CHECKLIST.md and PRODUCTION_AUDIT.md before any readiness claim.
   Automated compilation is not evidence that live services or physical devices
   passed these tests.
