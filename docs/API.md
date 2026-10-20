# ZipShift Navigator API Reference

This document is the implementation reference for the Express API in [`server/index.ts`](../server/index.ts). It describes the current `main` router, its authentication and authorization boundaries, request limits, response conventions, cursor pagination, case-event idempotency, and database transaction behavior.

The router currently declares **110 API endpoints**: 52 `GET`, 37 `POST`, 18 `PATCH`, 2 `PUT`, and 1 `DELETE`. The inventory at the end of this document is generated from the route declarations so it can be compared directly with the source.

## Quick start

- Base path: `/api`
- Development API: `http://localhost:3001/api`
- Combined development command: `pnpm run dev`
- Production command: `pnpm run build && pnpm start`
- Health probe: `GET /api/health`
- JSON body limit: 1 MB through the global `express.json()` middleware.
- File upload limit: 20 MB for `POST /api/care-portal/cases/:caseId/files`.
- Default response type: `application/json`, except PDF, CSV, redirects, and raw file upload routes.

The API is not a public unauthenticated CRUD surface. Client-side route visibility is only a UX boundary; the server re-checks session, role, case access, study membership, consent, specialist assignment, document state, and audit requirements inside the route handler.

## Request and response conventions

### Authentication

Successful registration, setup, and login create a server-side session in `app_sessions` and set the `zipshift_session` cookie. The cookie is currently `httpOnly`, `SameSite=Lax`, `Secure` in production, scoped to `/`, and valid for seven days. For controlled service-to-service or test calls, the server also accepts the `x-session-id` header.

The session payload resolves to:

```json
{
  "id": "user-uuid",
  "email": "person@example.org",
  "displayName": "Example Person",
  "role": "client|admin|researcher",
  "specialistRole": "care_coordinator|null"
}
```

`requireSession` returns `401` with `{ "error": "Sign in is required." }` when the session is missing or expired. `requireRole` returns `403` with `{ "error": "You do not have permission to access this workspace." }` when the session role is not allowed. Study membership failures use either `403` or a deliberately non-disclosing `404` depending on the route.

### Common status codes

| Status | Meaning | Typical response |
| --- | --- | --- |
| `200` | Successful read, update, logout, or idempotent replay | Resource JSON, `{ success: true }`, or export body |
| `201` | Successful create or first event submission | Created resource, ID, or `{ success: true, eventId }` |
| `400` | Invalid body, query, path-related input, unsupported enum, or malformed file | `{ error: string }` |
| `401` | Missing, expired, or invalid session | `{ error: string }` |
| `403` | Authenticated but not authorized for the workspace, team, or study | `{ error: string }` |
| `404` | Resource missing or intentionally hidden by an access boundary | `{ error: string }` |
| `409` | Valid request conflicts with setup, duplicate state, or workflow transition | `{ error: string }` |
| `500` | Unexpected server/database/storage failure | Safe generic `{ error: string }` where the handler provides one |

Clients should not depend on database error text, SQL details, signed storage URLs, reset tokens, or private document metadata appearing in error responses.

### File and export behavior

- `POST /care-portal/cases/:caseId/files` uses a raw request body with `Content-Type: application/pdf` or `application/octet-stream`. The route requires a PDF magic header (`%PDF`), stores the object privately, records its SHA-256, and writes an audit event.
- `GET /care-portal/files/:fileId/download` returns a redirect to a short-lived signed storage URL after care-team authorization.
- PDF export routes return an attachment with `application/pdf`.
- CSV export routes return `text/csv; charset=utf-8` and a `Content-Disposition` attachment filename.
- Signed URLs and storage keys must never be copied into analytics, logs, issues, or long-lived client state.

## Public, setup, and runtime endpoints

| Method | Route | Contract and authorization |
| --- | --- | --- |
| `GET` | `/health` | Public liveness response `{ ok: true, databaseMode }`. Does not prove that every domain query is healthy. |
| `GET` | `/setup/status` | Public setup state `{ needsAdminSetup }`. |
| `POST` | `/setup/admin` | Setup-only administrator creation. Requires display name 2–100 characters, valid email, and a password with at least 12 characters containing letters and numbers. Returns `201 { user }`; returns `409` after setup exists. |
| `GET` | `/providers` | Public curated provider seed dataset. |
| `GET` | `/coverage/zips` | Public supported ZIP coverage metadata. |
| `GET` | `/emergency-resources` | Public emergency resource data. |
| `GET` | `/county-resources` | Public county resource data. |
| `GET` | `/resources/canonical` | Public canonical resources merged from navigator and directory records. |
| `GET` | `/operations/schedules` | Public provider operating schedules and verification state. |
| `GET` | `/pages/:slug` | Publicly reads a page only when the page is published. |
| `GET` | `/global-settings` | Public presentation/runtime settings. |

The admin-only runtime diagnostics are documented below with the administrative endpoints.

## Authentication, profile, consent, and saved resources

| Method | Route | Contract and authorization |
| --- | --- | --- |
| `POST` | `/auth/register` | Creates a client account and profile. Requires valid display name, email, password, and logical age/date-of-birth validation. Returns `201 { user }`; duplicate email returns `409`. |
| `POST` | `/auth/login` | Accepts `email` or `username` plus `password`. Invalid credentials return the same `401` response. On success creates a seven-day session and returns `{ user }`. |
| `POST` | `/auth/forgot-password` | Accepts `email` and always returns a generic message to avoid account enumeration. Development mode may include a reset token; production must not expose it. |
| `POST` | `/auth/reset-password` | Accepts `token` and a valid password. Hashes the new password, marks the token used, and revokes all existing sessions for the user. |
| `POST` | `/auth/logout` | Deletes the current server session when present and clears the session cookie. Safe to call without a session. |
| `GET` | `/auth/me` | Requires a valid session; returns `{ user, expiresAt }`. |
| `GET` | `/auth/verify` | Requires a valid session; returns `{ user }`. |
| `GET` | `/profile` | Requires a session; returns current user data and normalized client profile fields. |
| `PUT` | `/profile` | Client-only profile update. Normalizes display name, phone, city, language, and accessibility preferences. |
| `GET` | `/profile/consents` | Client-only list of active consent documents and the latest decision for the current user. |
| `POST` | `/profile/consents` | Client-only consent decision. Requires an active consent document and a valid `granted`, `declined`, or `withdrawn` decision. |
| `GET` | `/saved-resources` | Requires a session; lists the current user’s saved provider IDs ordered newest first. |
| `PUT` | `/saved-resources/:providerId` | Requires a session; idempotently saves a provider/resource ID. |
| `DELETE` | `/saved-resources/:providerId` | Requires a session; removes only the current user’s saved record. |

Consent is not authorization. A consent record does not bypass role, case, team, study-membership, or document-state checks.

## Directory, analytics, intake, and referrals

| Method | Route | Contract and authorization |
| --- | --- | --- |
| `GET` | `/directory` | Public directory search. Supported filters include `search`, `city`, and `category`; response is `{ resources }` with normalized provider fields. |
| `POST` | `/analytics/zip-search` | Records aggregate ZIP-search behavior. Keep payloads pseudonymous and minimum-necessary. |
| `POST` | `/analytics/field-event` | Records an allowlisted field-test event type and pseudonymous metadata. Do not send names, case IDs, tokens, or document data. |
| `POST` | `/intake` | Creates a client referral/intake case after validating profile, provider, service, consent, handoff, and access details. Returns `201 { caseId, caseNumber }`. |
| `POST` | `/feedback` | Records access feedback against a case and creates a timeline/notification side effect. Requires a valid case context and validated rating/barriers/narrative. |
| `GET` | `/cases/mine` | Lists cases visible to the signed-in client or staff workspace. |
| `GET` | `/notifications` | Returns notifications scoped to the current session and relevant case workflow. |
| `GET` | `/cases/:caseId/events` | Returns the authorized case event timeline. See the cursor section below. |
| `POST` | `/events` | Authenticated, case-scoped event ingestion with allowlist, bounded JSON, idempotency, and transaction semantics. See the event section below. |

## Cursor pagination for case events

The legacy response remains available when neither `limit` nor `cursor` is supplied:

```http
GET /api/cases/{caseId}/events
```

```json
{
  "events": [
    {
      "eventType": "ACCESS_FEEDBACK_SUBMITTED",
      "note": "The first visit required a second trip.",
      "createdAt": 1700000000000
    }
  ]
}
```

Clients may opt into bounded keyset pagination:

```http
GET /api/cases/{caseId}/events?limit=50&cursor={opaque-cursor}
```

| Parameter | Rules |
| --- | --- |
| `limit` | Optional string integer. Clamped to `1..100`; defaults to `50` when pagination is enabled. |
| `cursor` | Optional opaque HMAC-signed token. Do not decode, modify, persist as a user-facing identifier, or construct manually. |
| Ordering | Stable ascending `(created_at, id)` ordering. The ID tie-breaker prevents duplicate/omitted rows with equal timestamps. |
| Access | The case must exist. Clients may read their own case; staff roles use the server’s case-access policy. Missing or unauthorized cases return `404`. |
| Invalid cursor | Returns `400 { error: "Invalid or expired cursor." }`. Restart from the first page. |

Paginated responses contain at most `limit` events and a `nextCursor` when more rows are available:

```json
{
  "events": [
    { "eventType": "CLIENT_PROFILE_UPDATED", "note": null, "createdAt": 1700000000000 }
  ],
  "nextCursor": "base64url-body.hmac-signature"
}
```

The cursor body contains version `1`, sort `created_at,id:asc`, the last row timestamp, and the last row ID. The HMAC uses `CURSOR_SIGNING_SECRET`; a development fallback exists for local-only operation and must be replaced in deployed environments.

## Generic case-event ingestion

`POST /api/events` requires a valid session and case access. The accepted request shape is:

```json
{
  "caseId": "case-uuid",
  "eventType": "NAVIGATOR_MESSAGE_SENT",
  "eventData": { "channel": "secure_chat" },
  "note": "Message queued for the navigator.",
  "idempotencyKey": "retry-key-123456"
}
```

Validation rules:

- `caseId`: non-empty string, maximum 80 characters.
- `eventType`: one of `CONTACT_WEBFORM_SUBMIT`, `ACCESS_FEEDBACK_SUBMITTED`, `CASE_STATUS_UPDATED`, `CLIENT_PROFILE_UPDATED`, `REFERRAL_CREATED`, `NAVIGATOR_MESSAGE_SENT`, `NAVIGATOR_QUIET_HOURS_UPDATED`, or `NAVIGATOR_FHIR_PREVIEWED`.
- `eventData`: object with bounded depth, entry count, key length, and serialized size of 16 KB or less.
- `note`: optional trimmed string, maximum 2,000 characters.
- `idempotencyKey`: optional ASCII-safe key, 16–100 characters.
- Unknown body fields are rejected.

First submission returns `201`:

```json
{ "success": true, "eventId": "event-uuid", "replayed": false }
```

A repeated submission by the same actor with the same `idempotencyKey` returns `200` with the original event ID and `replayed: true`. The idempotency key is scoped by actor, not globally.

## Staff, navigator operations, and YellowBook

Staff workspace routes use session and role checks, then apply case/team-specific authorization inside the handler.

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/staff/cases` | Staff-visible case list with status, priority, assignment, and workflow filters. |
| `PATCH` | `/staff/cases/:caseId` | Updates permitted case status, priority, assignment, and workflow fields; records relevant events/audit history. |
| `POST` | `/staff/navigator-events` | Records an authorized staff navigator event. |
| `GET` | `/staff/yellowbook/cases/:caseId` | Reads YellowBook encounters for an authorized case. |
| `POST` | `/staff/yellowbook` | Creates an encounter for an authorized case. |
| `GET` | `/staff/yellowbook/:encounterId/events` | Reads encounter timeline/audit events. |
| `PATCH` | `/staff/yellowbook/:encounterId` | Updates encounter data after case and role checks. |
| `GET` | `/staff/yellowbook/:encounterId/export.pdf` | Generates an authorized printable PDF. |
| `GET` | `/staff/reports/summary` | Staff dashboard summary. |
| `GET` | `/staff/reports/export` | Authorized CSV case/report export; records a generated-report audit row. |
| `GET` | `/staff/reports/field-test` | Staff field-test analytics. |
| `GET` | `/staff/reports/zip-demand` | Staff ZIP-demand aggregates. |
| `POST` | `/staff/users` | Authorized staff provisioning flow. |

## Care coordination, intake packets, documents, files, and signatures

Care portal routes require the care-team authorization helper. The current implementation represents care-team access through authenticated administrative/research workspace roles plus specialist assignment checks for restricted forms and milestone/team operations.

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/intake-library` | Lists active packet forms and storage metadata for authorized care users. |
| `POST` | `/intake-library/assemble` | Accepts `caseId`, title, and 1–20 active `formIds`; creates an assembled packet and audit event. |
| `GET` | `/care-portal/dashboard` | Case-scoped care dashboard. |
| `GET` | `/care-portal/queue` | Care-team work queue. |
| `GET` | `/care-portal/cases/:caseId` | Authorized case coordination view. |
| `GET` | `/care-portal/cases/:caseId/documents` | Returns uploaded file metadata plus document audit rows. |
| `POST` | `/care-portal/cases/:caseId/documents` | Creates a care-coordination document record. |
| `PATCH` | `/care-portal/documents/:documentId` | Updates document metadata/state. |
| `POST` | `/care-portal/documents/:documentId/signatures` | Adds a role-checked document signature. |
| `POST` | `/care-portal/cases/:caseId/files` | Raw PDF upload, max 20 MB, requires `%PDF` signature, stores SHA-256 and audit metadata. Optional headers: `x-file-name`, `x-packet-form-id`. |
| `GET` | `/care-portal/files/:fileId/download` | Redirects to a signed private storage URL. |
| `PATCH` | `/care-portal/files/:fileId/status` | Moves uploaded files to `review` or `void` with state-transition and specialist-role checks. |
| `POST` | `/care-portal/files/:fileId/signatures` | Accepts a PNG data URL under the documented bound, validates PNG magic bytes, stores a signature object, hashes it, and transitions the file to `signed`. |
| `GET` | `/care-portal/milestones` | Lists milestones, optionally filtered by `team` and `caseId`; bounded to the current care queue. |
| `POST` | `/care-portal/cases/:caseId/milestones` | Creates a typed milestone for an allowed specialist team. |
| `PATCH` | `/care-portal/milestones/:milestoneId` | Updates milestone state/metadata with team permission checks. |
| `GET` | `/care-portal/milestones/:milestoneId/audit` | Reads milestone audit events. |
| `GET` | `/care-portal/tasks` | Lists care tasks. |
| `POST` | `/care-portal/cases/:caseId/tasks` | Creates a case task for an allowed team. |
| `PATCH` | `/care-portal/tasks/:taskId` | Updates/completes a task. |
| `POST` | `/care-portal/cases/:caseId/handoffs` | Creates a care-team handoff. |
| `PATCH` | `/care-portal/handoffs/:handoffId` | Accepts or updates a handoff. |

Document operations intentionally keep storage keys, signature hashes, signer roles, and audit details server-controlled. Signed or void documents cannot be moved through ordinary status transitions.

## Administration, dual-database diagnostics, and research configuration

Admin-only routes require `role=admin`. Study configuration is intentionally separated from research participant operations.

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/admin/database-parity` | Returns the dual-database adapter snapshot for migration parity monitoring. |
| `GET` | `/admin/database-health` | Returns adapter mode and health checks. |
| `GET` | `/admin/users` | Lists account identity, role, specialist assignment, active state, and timestamps. |
| `PATCH` | `/admin/users/:userId` | Updates display name, account role, specialist role, or active state; administrators cannot deactivate their own session. |
| `POST` | `/admin/users/:userId/reset-password` | Validates password, updates hash, revokes sessions, and records an admin audit event. |
| `GET` | `/admin/studies` | Lists studies with owner, member, protocol, and consent-document counts. |
| `POST` | `/admin/studies` | Creates a study and owner membership after validating key, title, dates, status, and active staff owner. |
| `PATCH` | `/admin/studies/:studyId` | Updates study metadata/status/owner/dates. |
| `GET` | `/admin/studies/:studyId` | Returns study, protocols, consent documents, and memberships. |
| `POST` | `/admin/studies/:studyId/protocols` | Creates a protocol version with status and effective date. |
| `PATCH` | `/admin/protocols/:protocolId` | Updates protocol title, summary, status, and effective date. |
| `POST` | `/admin/studies/:studyId/members` | Adds a study member with membership role validation. |
| `GET` | `/admin/studies/:studyId/research-config` | Returns study protocol, consent, dictionary, instrument, and scoring configuration. |
| `GET` | `/research/studies/:studyId/research-config` | Researcher-readable version after study-membership authorization. |
| `POST` | `/admin/studies/:studyId/dictionaries` | Creates a data-dictionary version. |
| `GET` | `/admin/dictionaries/:dictionaryId` | Reads a dictionary and variables. |
| `PATCH` | `/admin/dictionaries/:dictionaryId` | Updates dictionary metadata/status. |
| `POST` | `/admin/dictionaries/:dictionaryId/variables` | Adds a validated dictionary variable. |
| `PATCH` | `/admin/dictionary-variables/:variableId` | Updates a dictionary variable. |
| `POST` | `/admin/studies/:studyId/instruments` | Creates a research instrument. |
| `GET` | `/admin/instruments/:instrumentId` | Reads instrument metadata, items, and scoring rules. |
| `PATCH` | `/admin/instruments/:instrumentId` | Updates instrument metadata/scoring rules. |
| `POST` | `/admin/instruments/:instrumentId/items` | Adds an instrument item. |
| `PATCH` | `/admin/instrument-items/:itemId` | Updates an instrument item. |
| `POST` | `/admin/studies/:studyId/consent-documents` | Creates a consent-document version. |
| `PATCH` | `/admin/consent-documents/:documentId` | Updates consent status, purpose, language, version, and expiry metadata. |

Configuration changes that affect participant interpretation should remain versioned and auditable.

## Research operations and de-identified export

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/research/studies` | Lists studies available to the current admin/researcher; non-admins are filtered by active membership. |
| `GET` | `/research/studies/:studyId/participant-controls` | Lists pseudonymous participant controls and assessment counts after study access. |
| `POST` | `/research/studies/:studyId/participant-controls` | Enrolls a study-linked case only when active research consent exists; returns pseudonym and retention date. |
| `PATCH` | `/research/participant-controls/:controlId/retention` | Updates retention timestamp or clears it. |
| `POST` | `/research/participant-controls/:controlId/withdraw` | Withdraws participation, marks active assessments withdrawn, and records a case event. |
| `GET` | `/research/participant-controls/:controlId/assessments` | Lists assessments by pseudonym, instrument, score, status, and creation time. |
| `POST` | `/research/participant-controls/:controlId/assessments` | Records PHQ-9 or PRAPARE structured responses; validates PHQ-9 item range and derives score when needed. |
| `GET` | `/research/studies/:studyId/export.csv` | Exports enrolled, non-directly-identifying study rows after study authorization and records a generated-report audit row. |

Research exports must preserve consent, withdrawal, retention, and minimum-necessary data rules. The server never treats a client-supplied pseudonym as an authorization credential.

## Settings, CMS pages, and audit

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/admin/global-settings` | Admin view of editor settings and revision context. |
| `PATCH` | `/admin/global-settings` | Updates validated editor settings and records revision/audit metadata. |
| `POST` | `/admin/global-settings/undo` | Reverts a prior setting revision. |
| `GET` | `/admin/audit` | Lists administrative audit events. |
| `GET` | `/admin/pages` | Lists editable pages. |
| `POST` | `/admin/pages` | Creates a page. |
| `PATCH` | `/admin/pages/:pageId` | Updates page content/status; public reads only published pages. |

## Transaction and persistence model

### Request transactions

The reusable [`withMySqlTransaction`](../server/db/transactions.ts) helper owns one pooled MySQL connection for a callback:

1. Acquire a connection with `pool.getConnection()`.
2. Call `beginTransaction()`.
3. Execute the callback using that connection for every query/write.
4. Commit on success and return the callback result.
5. On callback failure, attempt rollback, preserve the original error even if rollback fails, and always release the connection in `finally`.

`POST /api/events` uses this helper when an `idempotencyKey` is present. The event row and retry-ledger row are committed together. A duplicate `(actor_user_id, idempotency_key)` race is handled by reading back the already-created event ID and returning a replay response.

The transaction helper does not make every multi-write endpoint atomic. Existing intake, care, research, and settings routes still contain domain-specific sequential writes; a future hardening pass should migrate each multi-write workflow that must be all-or-nothing onto the same helper.

### Schema and index migration behavior

The cursor/index migration is separate from request transactions:

- MySQL DDL can auto-commit, so `scripts/migrate-cursor-indexes.ts --apply` runs statements sequentially and reports how many completed if a later statement fails.
- `server/migrations/20261019_add_cursor_indexes_and_event_idempotency.sql` adds composite browse indexes and the `case_event_idempotency` table.
- The generated Cockroach candidate is under `db/cockroach-migrations/` and requires the project’s normal manual portability review.
- Apply migrations in filename order before enabling routes that depend on the new table/indexes.

### Database adapters

`getDualDatabase()` exposes the current database mode, health, and parity snapshot to admin diagnostics. The legacy Express router currently uses the MySQL pool for route persistence; the dual-database adapter/repository layer supports the migration and parity work. Do not infer that a healthy `/api/health` response proves dual-database parity.

## Security and operational requirements

- Keep `CURSOR_SIGNING_SECRET`, `DATABASE_URL`, storage credentials, and built-in service keys outside source control.
- Replace the development cursor-secret fallback before any public deployment.
- Never log request bodies for authentication, event, signature, consent, or file routes.
- Do not expose password-reset tokens in production responses.
- Keep signed storage URLs short-lived and out of analytics/logging.
- Treat `403` and intentionally masked `404` responses as part of the privacy boundary.
- Use synthetic data in tests, screenshots, fixtures, and issue reports.
- Verify authorization on the server even when the React route is hidden.

## Adding or changing an endpoint

1. Add the route inside the correct domain section in `server/index.ts`.
2. Put authentication, role, case, team, and study checks before private reads/writes or storage redirects.
3. Validate path, query, and body inputs; reject unknown or sensitive fields where appropriate.
4. Preserve stable response shapes and document new request/response fields here.
5. Add success, validation, unauthenticated, unauthorized, not-found, conflict, and transaction-failure tests as applicable.
6. Add an ordered migration for persistence changes and update migration documentation.
7. Run `pnpm run check`, `pnpm test`, `pnpm run build`, and the focused cursor/transaction tests.

## Complete route inventory

The following table is generated from the `app.get/post/put/patch/delete` declarations in `server/index.ts`. It intentionally lists route paths without duplicating every payload field from the domain sections above.

<!-- ROUTE_INVENTORY_START -->
| Method | Route | Domain | Handler boundary |
| --- | --- | --- | --- |
| `GET` | `/health` | Runtime / setup / CMS | Public |
| `GET` | `/admin/database-parity` | Admin / configuration | Admin |
| `GET` | `/admin/database-health` | Admin / configuration | Admin |
| `GET` | `/setup/status` | Runtime / setup / CMS | Public |
| `POST` | `/setup/admin` | Runtime / setup / CMS | Setup-only |
| `POST` | `/auth/register` | Identity / profile | Public / validated |
| `POST` | `/auth/login` | Identity / profile | Public / validated |
| `POST` | `/auth/forgot-password` | Identity / profile | Public / validated |
| `POST` | `/auth/reset-password` | Identity / profile | Public / validated |
| `POST` | `/auth/logout` | Identity / profile | Public / validated |
| `GET` | `/auth/me` | Identity / profile | Session |
| `GET` | `/auth/verify` | Identity / profile | Session |
| `GET` | `/profile` | Identity / profile | Session |
| `PUT` | `/profile` | Identity / profile | Session |
| `GET` | `/saved-resources` | Identity / profile | Session |
| `PUT` | `/saved-resources/:providerId` | Identity / profile | Session |
| `DELETE` | `/saved-resources/:providerId` | Identity / profile | Session |
| `GET` | `/directory` | Public / directory / analytics | Session |
| `GET` | `/resources/canonical` | Public / directory / analytics | Public |
| `GET` | `/operations/schedules` | Public / directory / analytics | Public |
| `GET` | `/providers` | Public / directory / analytics | Public |
| `GET` | `/coverage/zips` | Public / directory / analytics | Public |
| `POST` | `/analytics/zip-search` | Public / directory / analytics | Public / bounded |
| `POST` | `/analytics/field-event` | Public / directory / analytics | Public / bounded |
| `GET` | `/staff/reports/field-test` | Staff / field operations | Staff guard |
| `GET` | `/staff/reports/zip-demand` | Staff / field operations | Staff guard |
| `POST` | `/intake` | Navigator / cases | Session |
| `GET` | `/cases/mine` | Navigator / cases | Session |
| `GET` | `/notifications` | Navigator / cases | Session |
| `GET` | `/emergency-resources` | Public / directory / analytics | Public |
| `GET` | `/county-resources` | Public / directory / analytics | Public |
| `POST` | `/feedback` | Navigator / cases | Public / validated |
| `GET` | `/cases/:caseId/events` | Navigator / cases | Session |
| `GET` | `/staff/cases` | Staff / field operations | Staff guard |
| `PATCH` | `/staff/cases/:caseId` | Staff / field operations | Staff guard |
| `POST` | `/staff/navigator-events` | Staff / field operations | Staff guard |
| `GET` | `/staff/yellowbook/cases/:caseId` | Staff / field operations | Staff guard |
| `POST` | `/staff/yellowbook` | Staff / field operations | Staff guard |
| `GET` | `/staff/yellowbook/:encounterId/events` | Staff / field operations | Staff guard |
| `GET` | `/staff/yellowbook/:encounterId/export.pdf` | Staff / field operations | Staff guard |
| `PATCH` | `/staff/yellowbook/:encounterId` | Staff / field operations | Staff guard |
| `GET` | `/staff/reports/summary` | Staff / field operations | Staff guard |
| `GET` | `/staff/reports/export` | Staff / field operations | Staff guard |
| `GET` | `/intake-library` | Public / directory / analytics | Care guard |
| `POST` | `/intake-library/assemble` | Public / directory / analytics | Care guard |
| `GET` | `/care-portal/cases/:caseId/documents` | Care coordination | Care guard |
| `POST` | `/care-portal/cases/:caseId/files` | Care coordination | Care guard |
| `GET` | `/care-portal/files/:fileId/download` | Care coordination | Care guard |
| `PATCH` | `/care-portal/files/:fileId/status` | Care coordination | Care guard |
| `POST` | `/care-portal/files/:fileId/signatures` | Care coordination | Care guard |
| `GET` | `/care-portal/milestones` | Care coordination | Care guard |
| `POST` | `/care-portal/cases/:caseId/milestones` | Care coordination | Care guard |
| `PATCH` | `/care-portal/milestones/:milestoneId` | Care coordination | Care guard |
| `GET` | `/care-portal/milestones/:milestoneId/audit` | Care coordination | Care guard |
| `GET` | `/care-portal/tasks` | Care coordination | Care guard |
| `POST` | `/care-portal/cases/:caseId/tasks` | Care coordination | Care guard |
| `PATCH` | `/care-portal/tasks/:taskId` | Care coordination | Care guard |
| `GET` | `/care-portal/queue` | Care coordination | Care guard |
| `GET` | `/care-portal/dashboard` | Care coordination | Care guard |
| `GET` | `/care-portal/cases/:caseId` | Care coordination | Care guard |
| `POST` | `/care-portal/cases/:caseId/documents` | Care coordination | Care guard |
| `PATCH` | `/care-portal/documents/:documentId` | Care coordination | Care guard |
| `POST` | `/care-portal/documents/:documentId/signatures` | Care coordination | Care guard |
| `POST` | `/care-portal/cases/:caseId/handoffs` | Care coordination | Care guard |
| `PATCH` | `/care-portal/handoffs/:handoffId` | Care coordination | Care guard |
| `GET` | `/admin/users` | Admin / configuration | Admin |
| `PATCH` | `/admin/users/:userId` | Admin / configuration | Admin |
| `POST` | `/admin/users/:userId/reset-password` | Admin / configuration | Admin |
| `GET` | `/admin/studies` | Admin / configuration | Admin |
| `POST` | `/admin/studies` | Admin / configuration | Admin |
| `PATCH` | `/admin/studies/:studyId` | Admin / configuration | Admin |
| `GET` | `/admin/studies/:studyId` | Admin / configuration | Admin |
| `POST` | `/admin/studies/:studyId/protocols` | Admin / configuration | Admin |
| `PATCH` | `/admin/protocols/:protocolId` | Admin / configuration | Admin |
| `POST` | `/admin/studies/:studyId/members` | Admin / configuration | Admin |
| `GET` | `/admin/studies/:studyId/research-config` | Admin / configuration | Admin |
| `GET` | `/research/studies/:studyId/research-config` | Research operations | Admin / researcher + study access |
| `POST` | `/admin/studies/:studyId/dictionaries` | Admin / configuration | Admin |
| `GET` | `/admin/dictionaries/:dictionaryId` | Admin / configuration | Admin |
| `PATCH` | `/admin/dictionaries/:dictionaryId` | Admin / configuration | Admin |
| `POST` | `/admin/dictionaries/:dictionaryId/variables` | Admin / configuration | Admin |
| `PATCH` | `/admin/dictionary-variables/:variableId` | Admin / configuration | Admin |
| `POST` | `/admin/studies/:studyId/instruments` | Admin / configuration | Admin |
| `GET` | `/admin/instruments/:instrumentId` | Admin / configuration | Admin |
| `PATCH` | `/admin/instruments/:instrumentId` | Admin / configuration | Admin |
| `POST` | `/admin/instruments/:instrumentId/items` | Admin / configuration | Admin |
| `PATCH` | `/admin/instrument-items/:itemId` | Admin / configuration | Admin |
| `POST` | `/admin/studies/:studyId/consent-documents` | Admin / configuration | Admin |
| `PATCH` | `/admin/consent-documents/:documentId` | Admin / configuration | Admin |
| `GET` | `/research/studies` | Research operations | Admin / researcher + study access |
| `GET` | `/research/studies/:studyId/participant-controls` | Research operations | Admin / researcher + study access |
| `POST` | `/research/studies/:studyId/participant-controls` | Research operations | Admin / researcher + study access |
| `PATCH` | `/research/participant-controls/:controlId/retention` | Research operations | Admin / researcher + study access |
| `POST` | `/research/participant-controls/:controlId/withdraw` | Research operations | Admin / researcher + study access |
| `GET` | `/research/participant-controls/:controlId/assessments` | Research operations | Admin / researcher + study access |
| `POST` | `/research/participant-controls/:controlId/assessments` | Research operations | Admin / researcher + study access |
| `GET` | `/research/studies/:studyId/export.csv` | Research operations | Admin / researcher + study access |
| `GET` | `/profile/consents` | Identity / profile | Client |
| `POST` | `/profile/consents` | Identity / profile | Client |
| `GET` | `/global-settings` | Runtime / setup / CMS | Session |
| `GET` | `/admin/global-settings` | Admin / configuration | Admin |
| `PATCH` | `/admin/global-settings` | Admin / configuration | Admin |
| `POST` | `/admin/global-settings/undo` | Admin / configuration | Admin |
| `GET` | `/admin/audit` | Admin / configuration | Admin |
| `GET` | `/admin/pages` | Admin / configuration | Admin |
| `GET` | `/pages/:slug` | Runtime / setup / CMS | Public |
| `POST` | `/admin/pages` | Admin / configuration | Admin |
| `PATCH` | `/admin/pages/:pageId` | Admin / configuration | Admin |
| `POST` | `/staff/users` | Staff / field operations | Staff guard |
| `POST` | `/events` | Navigator / cases | Session + case access |
<!-- ROUTE_INVENTORY_END -->
