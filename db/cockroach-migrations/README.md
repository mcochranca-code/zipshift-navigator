# CockroachDB migration candidates

These files were generated offline by `pnpm db:translate-mysql` from the incremental SQL files in `server/migrations/`. They are candidate DDL only and have not been applied to CockroachDB.

The source migration directory does not contain the original baseline schema for core tables such as `app_users`, `app_sessions`, `referral_cases`, and `case_events`. Obtain and review a complete MySQL schema snapshot before applying these candidates. The generated files therefore represent translated deltas, not a standalone database bootstrap.

Review `manifest.json` for source checksums and warnings. In particular, verify index declarations, foreign-key ordering, timestamp semantics, JSON behavior, and identifier types. Do not apply these files to a production cluster until the baseline schema, migration order, row-copy plan, authorization parity, and rollback plan have been reviewed.
