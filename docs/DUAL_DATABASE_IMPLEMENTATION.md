# Dual-Database Implementation Notes

This document describes the code added for staged CockroachDB adoption. It is intentionally safe when credentials are absent: importing the adapter does not connect to either database, and health checks are explicit operations.

## Adapter and repository boundary

`server/db/dualDatabase.ts` owns driver differences. It creates a CockroachDB `pg.Pool` from `COCKROACH_DATABASE_URL` and a legacy MySQL pool from `LEGACY_DATABASE_URL` or the existing `DATABASE_URL`. `DB_MODE` controls which path is authoritative:

- `legacy`: use MySQL only.
- `shadow`: return Cockroach results and sample equivalent MySQL reads for parity comparison.
- `cockroach`: use Cockroach only.
- `cockroach-readonly-legacy-backup`: use Cockroach for runtime operations while retaining MySQL only for explicit backup checks.

`toPostgresPlaceholders` allows the first repository slices to retain the current parameter-array style while converting unquoted `?` parameters to PostgreSQL `$1` placeholders. This is a transition aid, not a substitute for reviewing query semantics such as `FIELD`, `JSON_EXTRACT`, timestamp arithmetic, and MySQL-specific duplicate handling.

`server/db/repositories.ts` demonstrates the intended repository pattern with the existing `pwa_prototype.pwa_prototypes` table. Future repositories should own domain SQL and return application-shaped objects; route handlers should not know which driver produced the rows.

### First migrated route batch

The first staged batch now uses repositories while preserving the existing response contracts:

- session lookup used by `/api/auth/me`, `/api/auth/verify`, logout, and protected routes;
- active-user lookup used by `/api/auth/login`;
- client profile reads from `GET /api/profile`;
- directory search from `GET /api/directory`.

These are read-oriented paths, so they can be exercised in `shadow` mode before write migration. Account creation, password reset, profile writes, saved-resource mutations, and the remaining domain routes intentionally remain on the legacy MySQL pool until the write-side outbox and Cockroach schema are available.

## Parity and shadow monitoring contract

`ParityMonitor` records sampled shadow queries, normalized matches, mismatches, target errors, and the last mismatch fingerprint. Normalization sorts object keys and rows, converts dates to ISO strings, and converts buffers to base64 so driver representation differences do not create false positives.

The recommended dashboard API is:

```text
GET /api/admin/database-parity
GET /api/admin/database-health
```

Both endpoints must remain admin-only. The parity response should expose aggregate counts and timestamps, never raw query parameters, row contents, credentials, signed URLs, document metadata, or participant identifiers. Health responses may include latency and a redacted error category, but not raw connection strings or server error text in production.

Dashboard cards should show the current mode, Cockroach/legacy configuration state, sampled shadow queries, match rate, mismatch count, error count, outbox lag, and last observation time. A mismatch should link to an internal correlation/fingerprint identifier rather than displaying sensitive row data.

## Baseline schema snapshot

Run the snapshot only with the legacy connection configured:

```bash
pnpm db:snapshot:mysql
```

The script writes `db/baseline/mysql-schema.sql` and `db/baseline/mysql-schema.manifest.json`. It executes `SHOW TABLES` and `SHOW CREATE TABLE` only; it copies no row data and does not print the connection string. The snapshot is the missing foundation required before the incremental migration candidates under `db/cockroach-migrations/` can be applied. In the current sandbox run, it correctly stopped before writing because neither `LEGACY_DATABASE_URL` nor `DATABASE_URL` was configured; this prevents an empty or misleading baseline file from entering the repository.

After review, translate the complete baseline and incremental deltas:

```bash
pnpm db:translate-mysql
pnpm db:translate-mysql:check
```

The `:check` command intentionally exits nonzero when manual-review warnings remain. That is a release gate, not a runtime failure.

## Cutover implementation order

1. Add the baseline schema snapshot and review all translated DDL.
2. Create the Cockroach database/schema and migration ledger.
3. Implement repositories for health, auth/session, profile, directory, and pwa prototype reads.
4. Add read-only `/api/admin/database-health` and `/api/admin/database-parity` endpoints.
5. Add the dashboard surface to the admin workspace.
6. Run shadow reads for low-risk read paths and compare normalized outputs.
7. Migrate writes through a durable outbox with idempotency keys; never silently retry a failed write against the other database.
8. Expand repository coverage through cases/staff, care portal, research, and admin domains.
9. Cut over by `DB_MODE`, validate rollback, and retain MySQL read-only until reconciliation is complete.
