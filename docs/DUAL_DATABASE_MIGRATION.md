# Dual-Database Refactor and Migration Strategy

## Scope

ZipShift currently exposes **108 API routes** from `server/index.ts`. The route surface is already functionally grouped, but the implementation is tightly coupled to MySQL through `mysql2/promise`, `?` placeholders, MySQL result metadata, MySQL DDL, `FIELD(...)`, `JSON_EXTRACT(...)`, and MySQL migration syntax.

The target is to make CockroachDB the primary operational database while retaining the existing MySQL/MariaDB system as a read-only backup and rollback source during the migration window. The two databases must not be treated as casually interchangeable: CockroachDB is PostgreSQL-wire-compatible, has different transaction and DDL behavior, and must become authoritative only after parity checks pass.

## Current route inventory

| Domain | Routes | Refactor priority |
| --- | ---: | --- |
| Admin, studies, settings, pages, audit | 30 | High: configuration and authorization are write-sensitive. |
| Care portal, documents, signatures, milestones, tasks, handoffs | 20 | High: integrity, privacy, file metadata, and append-only audit behavior. |
| Staff, YellowBook, reports, and events | 13 | High: operational workflows and exports. |
| Research, participant controls, assessments, exports | 9 | High: consent, withdrawal, retention, and de-identification. |
| Auth, profile, saved resources, setup | 16 | High: session and credential behavior. |
| Directory, intake, analytics, public resources, health | 20 | Medium: mostly read-heavy, but analytics and intake still mutate data. |

The complete route list remains in [`API.md`](API.md). The existing UI can continue calling the same `/api/*` paths while the server-side database adapter changes underneath it.

## Target architecture

```text
Express route handlers
        |
Domain services and authorization guards
        |
DatabasePort / repository functions
        |
+----------------------+----------------------+
| Cockroach primary    | MySQL legacy backup  |
| pg Pool, $1 params   | mysql2 pool, ? params|
| authoritative writes | read-only verification|
+----------------------+----------------------+
        |
Migration ledger + dual-write outbox + parity checks
```

### Database port

Introduce `server/db/` with a small database port rather than editing 100+ handlers in place:

- `DatabaseClient`: `query`, `execute`, transaction, health, and close operations.
- `CockroachClient`: `pg.Pool`, `$1` placeholders, `rows`, and `rowCount` normalization.
- `MySqlClient`: current `mysql2` pool retained as the legacy backup client.
- `repositories/`: domain-specific queries for auth, directory, cases, care, research, and admin.
- `queryTranslator`: only for short-term compatibility. It must not become a permanent SQL parser.

Route handlers should depend on repositories/services, not on driver-specific result tuples. The first refactor should convert the session/auth, profile, directory, and health paths because they are small and exercise the connection, parameter, row-mapping, and error layers.

### Dual-database operating modes

Use an explicit `DB_MODE` rather than implicit fallback:

- `legacy`: current MySQL behavior for rollback and baseline verification.
- `shadow`: Cockroach receives translated writes through a controlled outbox or migration worker; responses still come from MySQL. Differences are logged without changing user-visible behavior.
- `cockroach`: Cockroach is authoritative for reads and writes; MySQL receives a best-effort backup write through the outbox until the retention window ends.
- `cockroach-readonly-legacy-backup`: Cockroach is authoritative and MySQL is available only for manual recovery/parity checks.

Do not silently fall back from a failed Cockroach write to MySQL. That can create divergent IDs, duplicate signatures, or split audit histories. A write failure must be visible, retriable, and idempotent.

### Read and write policy

Reads should be Cockroach-first after shadow parity is proven. During shadow mode, a sampled read comparator can query both systems using the same logical repository method and compare normalized JSON, excluding nondeterministic timestamps and driver metadata.

Writes should enter a durable `migration_outbox` on the authoritative database. An outbox row contains an idempotency key, domain, operation, entity ID, minimal payload, attempt count, and status. The backup writer consumes the outbox and records success/failure. Sensitive document bytes and signatures must not be copied into analytics or logs; file storage remains outside the relational migration.

## Schema and data migration phases

### Phase 0 — freeze and inventory

1. Freeze schema changes in the legacy database.
2. Snapshot the MySQL database and record migration filenames/checksums.
3. Run the offline translator in this repository to generate Cockroach candidate DDL.
4. Review every warning, especially indexes, foreign keys, JSON expressions, timestamps, boolean defaults, and any unsupported MySQL syntax.

### Phase 1 — schema translation

Run:

```bash
pnpm db:translate-mysql
```

The command reads `server/migrations/*.sql`, writes candidate files under `db/cockroach-migrations/`, and emits a manifest. It does not connect to either database. The output is intentionally reviewable before any DDL is applied.

The translator handles the current migration patterns: MySQL identifier quoting, `AFTER` clauses, MySQL index-add syntax, `DATETIME`, `JSON`, text aliases, unsigned modifiers, timestamp defaults, and identity columns. It fails on constructs that require a manual semantic decision, such as triggers, procedures, `ON DUPLICATE KEY`, `INSERT IGNORE`, `ENUM`, `FULLTEXT`, or spatial indexes.

### Phase 2 — empty Cockroach schema

Apply the reviewed candidate DDL to a new Cockroach database or schema. Apply tables and indexes in dependency order. Add foreign keys after base tables exist if Cockroach rejects an inline constraint because of ordering. Record each applied migration in a Cockroach-side ledger with source checksum and review status.

The existing Cockroach `pwa_prototype.pwa_prototypes` table is a separate prototype catalog. It should not be confused with the ZipShift application schema; use a dedicated application database/schema or explicitly document the namespace boundary before adding tables.

### Phase 3 — bulk copy

Copy data in dependency order, preserving UUIDs and legacy timestamps. Use bounded batches, explicit column lists, and an idempotency key. Do not copy passwords in plaintext or expose private document contents. Hashes and storage keys may be copied only when their access policy is preserved.

Validate row counts, primary-key uniqueness, foreign-key consistency, nullability, JSON validity, timestamp ranges, and representative authorization queries. For sensitive domains, compare normalized aggregates rather than dumping rows into logs.

### Phase 4 — shadow API

Refactor one repository slice at a time. Keep the response contract stable while the repository calls Cockroach. In shadow mode, execute the equivalent legacy read/write operation asynchronously and compare normalized outcomes. Start with health/auth/profile, then directory, cases/staff, care portal, research, and admin.

### Phase 5 — cutover and rollback

Cut over by environment flag, not by source rewrite. Monitor error rate, transaction retry rate, outbox lag, parity mismatch count, and authorization-denial differences. Roll back reads to MySQL only while writes are paused or reconciled; never run uncontrolled bidirectional writes.

Retain MySQL as a read-only backup until the agreed retention and reconciliation window expires. Take a final snapshot before decommissioning it.

## SQL compatibility decisions

- `?` placeholders become `$1`, `$2`, and so on in Cockroach queries.
- `mysql2` tuple results become `pg` result objects with `rows` and `rowCount`.
- `FIELD(status, ...)` becomes a `CASE` expression or application-side ordering.
- `JSON_EXTRACT` becomes Cockroach JSONB operators such as `response_json->>'q9'`.
- MySQL `TINYINT(1)` becomes `BOOLEAN`; verify all `0/1` values before conversion.
- MySQL `DATETIME` requires an explicit timezone decision; use `TIMESTAMPTZ` only when source values are UTC-aware.
- `CHAR(36)` UUID strings can remain text-compatible during the first cutover; convert to native `UUID` only after all foreign-key and import tooling is ready.
- MySQL `AFTER` clauses have no schema-order meaning in Cockroach and are removed.
- MySQL engine, charset, collation, and unsigned modifiers are removed or mapped explicitly.
- Cockroach transaction retries must be handled at the transaction boundary, not by replaying arbitrary HTTP handlers.

## Required environment configuration

Do not commit actual values. Configure these in the deployment secret manager:

```dotenv
DB_MODE=legacy
COCKROACH_DATABASE_URL=postgresql://<user>:<password>@<host>:26257/<database>?sslmode=verify-full
LEGACY_DATABASE_URL=mysql://<user>:<password>@<host>:3306/<database>
DB_SHADOW_SAMPLE_RATE=0.05
DB_OUTBOX_BATCH_SIZE=100
```

The current runtime has neither connection string. A real migration and API connectivity test must wait until both values are securely injected.

## Completion gates

The migration is ready for production only when `pnpm run check`, the complete test suite, route-level integration tests, schema parity checks, sampled shadow comparisons, and rollback drills all pass. The API must preserve current endpoint paths and response semantics while authorization, consent, audit, file, and research-retention behavior remains unchanged.
