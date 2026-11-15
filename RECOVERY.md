# Compiled application recovery

## What survives

The source directories were present but contained no files. The root package
manifest, Vite configuration and application entry points were absent.
The existing dist directory contained a compiled application and public assets.

The recovery configuration preserves those exact files under .recovery/snapshot
before Vite cleans dist. Keep that entire directory with this project: it is the
only available application implementation, not a disposable cache.

## Commands

- npm run dev: serve the preserved application through Vite.
- npm run check:recovery: validate the snapshot and direct HTML asset references.
- npm run build: emit the preserved snapshot to dist.
- npm run preview: preview the emitted dist directory.

Vite 5.4.20 matches the installed package version. This minimal manifest describes
the recovery wrapper only; it does not claim to reconstruct the original
application's dependency manifest. React and other original runtime dependencies
are already bundled in the preserved JavaScript.

## Limitations

This is an artifact-preserving build, not a compilation of recovered source.
Original React components, TypeScript checks, tests, Supabase migrations, Edge
Functions and RLS policy definitions are unavailable in the inspected directories.
No database records, policies, bucket settings or authentication code were changed.
Existing compiled login and backend behavior remains unchanged and unverified.

The compiled service workers and configuration are preserved as-is. Their runtime
behavior and any baked-in external endpoints require separate testing. No secrets
or environment values should be reconstructed from guesses.

Do not edit hashed JavaScript to implement features. Obtain the original repository
source or a trusted backup before resuming component-level development. Reconcile
that source separately and retain this snapshot until the restored application
has been tested.

No Git commit, push, historical merge or live Supabase audit is performed by this
recovery.