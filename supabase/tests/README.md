# Supabase academic contract tests

`academic_migration_rollback_contract.sql` validates the academic migration and
its RPC, RLS, approval, notification, audit, roster, lesson, and material
contracts against a production-shaped Supabase database.

The harness runs inside one transaction and ends with a mandatory `ROLLBACK`.
The wrapper fails on SQL errors, missing assertions, or failed assertions.

The repository does not contain the base schema. This harness therefore needs a
reviewed production-shaped database with existing `auth.users` and `programs`
rows. It reapplies the migration and takes table locks until rollback. Use a
database-owner connection only during an approved maintenance window:

```sh
DATABASE_URL="postgresql://..." npm run test:academic:db
```

The wrapper prints the contract results and removes its temporary output file.
